// 초대링크 수신자가 미등록 전화번호로 직접 가입하는 플로우.
//
// 호출자: `/api/auth/user-login` POST 핸들러 — phone 으로 app_users 에서 못 찾았고
//         body/form 에 event_id 가 포함된 경우에만 진입.
//
// 정책:
//  - event.allow_self_register = true AND event.status = 'LIVE' 인 행사만 허용.
//  - parent_name 은 1~50자, 공백 제거 후 검증 (빈 값이면 NEEDS_NAME).
//  - password_hash 는 app_users 테이블 NOT NULL 컬럼 — 벌크임포트 규약대로
//    전화번호 뒷 4자리 평문을 bcrypt 해시해 저장 (기존 createAppUserAccountFromPhone 과 동일).
//  - phone UNIQUE 충돌(23505) 시 이미 존재하는 row 재조회 — 아주 드문 경합.
//  - org_event_participants 는 `event_id,user_id` 복합키 멱등 upsert.
//
// 반환:
//  - SUCCESS       : 신규/기존 user 확보 + participants upsert 성공. 호출자가 쿠키/리다이렉트 처리.
//  - NEEDS_NAME    : 이름이 비어있거나 길이 초과 — 호출자는 UI에 이름 입력 유도.
//  - NOT_ALLOWED   : 행사가 없거나 self-register off 또는 status != LIVE — 기존 notfound 흐름으로 fall-through.

import type { createClient } from "@/lib/supabase/server";
import { hashPassword } from "@/lib/password";
import { addOrgMembership } from "@/lib/app-user/orgs";

type Supa = Awaited<ReturnType<typeof createClient>>;

export type SelfRegisterInput = {
  phone: string;
  parentName: string; // 빈 문자열 가능 — 검증은 내부에서.
  childName: string; // 빈 문자열 가능 — 보호자 이름과 함께 필수.
  eventId: string;
};

export type SelfRegisterResult =
  | {
      kind: "SUCCESS";
      userId: string;
      orgId: string;
      orgName: string;
      parentName: string;
    }
  /** 보호자 이름 또는 원아 이름이 없거나 길이 위반. UI 가 두 입력칸을 모두 노출해야 함. */
  | { kind: "NEEDS_NAME" }
  | { kind: "NOT_ALLOWED" };

/**
 * 초대 받은 미등록 참가자의 자가 가입.
 * 성공 시 app_users row 생성 + org_event_participants 멱등 upsert.
 *
 * @param _meta 추후 audit-log 연동용 placeholder — 현재는 호출자가 logAccess 로 별도 기록.
 */
export async function trySelfRegister(
  supabase: Supa,
  input: SelfRegisterInput,
  _meta: Record<string, unknown>
): Promise<SelfRegisterResult> {
  const { phone, eventId } = input;
  const parentName = (input.parentName ?? "").trim();
  const childName = (input.childName ?? "").trim();

  // ---- 1) 행사 로드 + 자가가입 허용 여부 ----
  const evtResp = (await (
    supabase.from("org_events" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: {
              id: string;
              org_id: string;
              allow_self_register: boolean | null;
              applications_enabled: boolean | null;
              status: string;
            } | null;
            error: unknown;
          }>;
        };
      };
    }
  )
    // "*" 인 이유: applications_enabled 는 나중에 실행될 마이그레이션 컬럼이라,
    // 명시 열거하면 SQL 적용 전 배포 창에서 undefined column 으로 가입이 막힌다.
    .select("*")
    .eq("id", eventId)
    .maybeSingle()) as {
    data: {
      id: string;
      org_id: string;
      allow_self_register: boolean | null;
      applications_enabled: boolean | null;
      status: string;
    } | null;
    error: unknown;
  };

  const evt = evtResp.data;
  if (!evt) return { kind: "NOT_ALLOWED" };
  if (!evt.allow_self_register) return { kind: "NOT_ALLOWED" };
  if (evt.status !== "LIVE") return { kind: "NOT_ALLOWED" };
  // 접수·승인제가 켜진 행사는 자가 가입을 막는다 — 신청서를 내고 기관이
  // 수락해야만 계정과 참가 기록이 생긴다(approveEventApplicationAction).
  if (evt.applications_enabled) return { kind: "NOT_ALLOWED" };

  // ---- 2) 이름 검증 (보호자 + 원아 모두 필수) ----
  if (!parentName || parentName.length < 1 || parentName.length > 50) {
    return { kind: "NEEDS_NAME" };
  }
  if (!childName || childName.length < 1 || childName.length > 50) {
    return { kind: "NEEDS_NAME" };
  }

  // ---- 3) app_users 생성 (password_hash NOT NULL — phone 뒷 4자리 해시) ----
  const userId = crypto.randomUUID();
  const plaintext = phone.slice(-4);
  const passwordHash = await hashPassword(plaintext);

  const insertResp = (await (
    supabase.from("app_users" as never) as unknown as {
      insert: (r: unknown) => {
        select: (c: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: { message: string; code?: string } | null;
          }>;
        };
      };
    }
  )
    .insert({
      id: userId,
      phone,
      password_hash: passwordHash,
      parent_name: parentName,
      org_id: evt.org_id,
      status: "ACTIVE",
      notification_consent: true,
      acorn_balance: 0,
      created_via: "self_register",
    })
    .select("id")
    .single()) as {
    data: { id: string } | null;
    error: { message: string; code?: string } | null;
  };

  // 23505 = unique_violation. phone 이 전역 UNIQUE 라 두 경우가 여기로 온다.
  //   (a) 찰나에 다른 경로로 같은 phone 이 가입된 경합
  //   (b) 이 학부모가 이미 "다른 기관" 계정을 갖고 있는 흔한 케이스
  // 어느 쪽이든 기존 row 를 재사용한다. (b) 에서 app_users.org_id 는 원래
  // 기관(홈 기관)으로 남고, 이 행사 기관 소속은 아래 app_user_orgs 로 추가된다.
  let finalUserId = insertResp.data?.id;
  if (insertResp.error && insertResp.error.code === "23505") {
    const existResp = (await (
      supabase.from("app_users" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: { id: string; parent_name: string | null } | null;
            }>;
          };
        };
      }
    )
      .select("id, parent_name")
      .eq("phone", phone)
      .maybeSingle()) as {
      data: { id: string; parent_name: string | null } | null;
    };
    if (existResp.data) {
      finalUserId = existResp.data.id;
    }
  }

  if (!finalUserId) {
    console.error("[self-register] insert failed", {
      code: insertResp.error?.code,
    });
    return { kind: "NOT_ALLOWED" };
  }

  // ---- 3-b) 이 행사 기관의 소속 확보 (멱등).
  //   신규 가입이면 홈 기관과 동일하고, 위 (b) 케이스면 두 번째 소속이 된다.
  //   이걸 빼먹으면 "참가는 했는데 기관 명단엔 없는" 유령 참가자가 생긴다.
  await addOrgMembership(finalUserId, evt.org_id, "self_register");

  // ---- 4) 원아 등록 — 같은 이름 자녀가 이미 있으면 skip (재제출 멱등성).
  //   app_children 에는 (user_id, name) UNIQUE 제약이 없으므로 직접 조회 후 분기.
  const existingChildResp = (await (
    supabase.from("app_children" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: { id: string } | null;
            }>;
          };
        };
      };
    }
  )
    .select("id")
    .eq("user_id", finalUserId)
    .eq("name", childName)
    .maybeSingle()) as { data: { id: string } | null };

  if (!existingChildResp.data) {
    await (
      supabase.from("app_children" as never) as unknown as {
        insert: (r: unknown) => Promise<{ error: unknown }>;
      }
    ).insert({
      user_id: finalUserId,
      name: childName,
      is_enrolled: true,
    });
  }

  // ---- 5) org_event_participants 멱등 upsert ----
  await (
    supabase.from("org_event_participants" as never) as unknown as {
      upsert: (
        r: unknown,
        opts: { onConflict: string }
      ) => Promise<{ error: unknown }>;
    }
  ).upsert(
    {
      event_id: eventId,
      user_id: finalUserId,
      joined_at: new Date().toISOString(),
    },
    { onConflict: "event_id,user_id" }
  );

  // ---- 6) 쿠키용 org_name 조회 ----
  const orgResp = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { org_name: string | null } | null;
          }>;
        };
      };
    }
  )
    .select("org_name")
    .eq("id", evt.org_id)
    .maybeSingle()) as {
    data: { org_name: string | null } | null;
  };

  return {
    kind: "SUCCESS",
    userId: finalUserId,
    orgId: evt.org_id,
    orgName: orgResp.data?.org_name ?? "",
    parentName,
  };
}
