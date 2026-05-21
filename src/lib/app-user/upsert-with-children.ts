// 보호자(app_users) + 자녀(app_children) upsert 공용 헬퍼.
//   /org/[orgId]/users/new/actions.ts 의 로직을 추출 — 단일 추가 / 행사별 추가
//   양쪽에서 재사용. redirect 는 호출자가 담당.
//
// 동작:
//   1) 핸드폰 번호로 기존 유저 조회 — 다른 기관 충돌이면 throw
//   2) 같은 기관에 있으면 → userId 반환 (merged=true)
//   3) 없으면 새 app_users + auto 계정(생성·hash) → userId 반환 (merged=false)
//   4) 자녀 이름 dedup 후 추가 (이미 있는 이름은 skip)

import { createClient } from "@/lib/supabase/server";
import {
  createAppUserAccountFromPhone,
  normalizeUserPhone,
} from "@/lib/app-user/account";

type SbErr = { message: string } | null;
type SbOne<T> = { data: T | null; error: SbErr };
type SbMany<T> = { data: T[] | null; error: SbErr };

export interface UpsertResult {
  userId: string;
  merged: boolean;
}

export type UpsertChild = {
  name: string;
  birth_date: string | null;
  is_enrolled: boolean;
  class_name: string | null;
};

export function parseChildrenFromFormData(formData: FormData): UpsertChild[] {
  const names = formData.getAll("child_name").map((v) => String(v).trim());
  const births = formData.getAll("child_birth").map((v) => String(v).trim());
  const enrolled = formData
    .getAll("child_enrolled")
    .map((v) => String(v).trim());
  const classes = formData
    .getAll("child_class")
    .map((v) => String(v).trim());
  const out: UpsertChild[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (!name) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    const birthRaw = births[i] ?? "";
    const birth = /^\d{4}-\d{2}-\d{2}$/.test(birthRaw) ? birthRaw : null;
    const enrolledRaw = enrolled[i];
    const isEnrolled =
      enrolledRaw === undefined
        ? out.length === 0
        : enrolledRaw === "1" || enrolledRaw === "true";
    const className = (classes[i] ?? "").trim() || null;
    out.push({
      name,
      birth_date: birth,
      is_enrolled: isEnrolled,
      class_name: className,
    });
  }
  return out;
}

/**
 * 보호자 + 자녀 upsert.
 * @throws 핸드폰 형식 오류 / 다른 기관 충돌 / DB 오류 시
 */
export async function upsertParticipantWithChildren(
  orgId: string,
  formData: FormData
): Promise<UpsertResult> {
  const parentNameRaw = String(formData.get("parent_name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();

  if (!phoneRaw) throw new Error("부모님 연락처를 입력해 주세요");

  const phoneDigits = normalizeUserPhone(phoneRaw);
  if (phoneDigits.length < 10 || phoneDigits.length > 11) {
    throw new Error("연락처 형식이 올바르지 않아요 (10~11자리 숫자)");
  }

  const children = parseChildrenFromFormData(formData);
  if (children.length === 0) {
    throw new Error("원생 이름을 입력해 주세요");
  }

  const parentName = parentNameRaw || `학부모_${phoneDigits.slice(-4)}`;

  const supabase = await createClient();

  // 1) 기존 유저
  const existingResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbOne<{ id: string; org_id: string; parent_name: string }>
          >;
        };
      };
    }
  )
    .select("id, org_id, parent_name")
    .eq("phone", phoneDigits)
    .maybeSingle()) as SbOne<{
    id: string;
    org_id: string;
    parent_name: string;
  }>;

  const existing = existingResp.data;

  // 같은 사람(전화번호)이면 다른 기관 소속이라도 재사용 — 한 사람이 여러 기관
  // 행사에 참여 가능. org_id(홈 기관)는 그대로 두고 행사 연결만 추가.

  let userId: string;
  let merged = false;

  if (existing) {
    merged = true;
    userId = existing.id;
  } else {
    let account;
    try {
      account = await createAppUserAccountFromPhone(
        phoneDigits,
        orgId,
        parentName
      );
    } catch (e) {
      console.error("[upsertParticipant] account create error", e);
      throw new Error(
        `계정 해시 생성 실패: ${e instanceof Error ? e.message : String(e)}`
      );
    }

    const insResp = (await (
      supabase.from("app_users" as never) as unknown as {
        insert: (p: unknown) => {
          select: (c: string) => {
            single: () => Promise<SbOne<{ id: string }>>;
          };
        };
      }
    )
      .insert({
        phone: phoneDigits,
        password_hash: account.hash,
        parent_name: parentName,
        org_id: orgId,
        status: "ACTIVE",
      })
      .select("id")
      .single()) as SbOne<{ id: string }>;

    if (insResp.error || !insResp.data) {
      console.error("[upsertParticipant] app_users insert error", {
        phoneDigits,
        orgId,
        parentName,
        error: insResp.error,
      });
      throw new Error(
        `보호자 등록 실패: ${insResp.error?.message ?? "알 수 없는 오류"}`
      );
    }
    userId = insResp.data.id;
  }

  // 2) 자녀 dedup 후 추가 — class_name 도 함께 저장.
  //    이미 있는 자녀 이름이 다시 들어오고 class_name 이 다르면 UPDATE.
  const existingChildrenResp = (await (
    supabase.from("app_children" as never) as unknown as {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => Promise<
          SbMany<{ id: string; name: string; class_name: string | null }>
        >;
      };
    }
  )
    .select("id, name, class_name")
    .eq("user_id", userId)) as SbMany<{
    id: string;
    name: string;
    class_name: string | null;
  }>;

  const existingByName = new Map(
    (existingChildrenResp.data ?? []).map((r) => [r.name, r])
  );
  const toInsert = children.filter((c) => !existingByName.has(c.name));
  const toUpdate = children.filter((c) => {
    const ex = existingByName.get(c.name);
    if (!ex) return false;
    const before = (ex.class_name ?? "").trim();
    const after = (c.class_name ?? "").trim();
    return after.length > 0 && after !== before;
  });

  if (toInsert.length > 0) {
    const childResp = (await (
      supabase.from("app_children" as never) as unknown as {
        insert: (p: unknown) => Promise<{ error: SbErr }>;
      }
    ).insert(
      toInsert.map((c) => ({
        user_id: userId,
        name: c.name,
        birth_date: c.birth_date,
        is_enrolled: c.is_enrolled,
        class_name: c.class_name,
      }))
    )) as { error: SbErr };

    if (childResp.error) {
      throw new Error(`자녀 등록 실패: ${childResp.error.message}`);
    }
  }

  for (const c of toUpdate) {
    const ex = existingByName.get(c.name);
    if (!ex) continue;
    await (
      supabase.from("app_children" as never) as unknown as {
        update: (p: unknown) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      }
    )
      .update({ class_name: c.class_name })
      .eq("id", ex.id);
  }

  // 3) 토리톡 자동 가입 — 이번 폼 자녀 + 기존 자녀 모두의 unique class_name
  const allClasses = [
    ...children.map((c) => c.class_name),
    ...Array.from(existingByName.values())
      .filter((ex) => !children.some((c) => c.name === ex.name))
      .map((ex) => ex.class_name),
  ];
  const uniqueClasses = Array.from(
    new Set(
      allClasses
        .map((c) => (c ?? "").trim())
        .filter((c) => c.length > 0)
    )
  );
  if (uniqueClasses.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    await Promise.all(
      uniqueClasses.map(async (cn) => {
        try {
          await sb.rpc("toritalk_ensure_room_membership", {
            p_org_id: orgId,
            p_class_name: cn,
            p_user_id: userId,
          });
        } catch {
          /* swallow */
        }
      })
    );
  }

  return { userId, merged };
}

/**
 * org_event_participants 멱등 INSERT — 이미 등록된 user 라도 에러 안 남.
 * UNIQUE(event_id, user_id) 충돌(23505)은 skip.
 */
export async function linkUsersToEvent(
  eventId: string,
  userIds: string[]
): Promise<void> {
  if (!eventId || userIds.length === 0) return;
  const supabase = await createClient();

  // 기존 등록자 조회
  const existingResp = (await (
    supabase.from("org_event_participants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          in: (k: string, v: string[]) => Promise<SbMany<{ user_id: string }>>;
        };
      };
    }
  )
    .select("user_id")
    .eq("event_id", eventId)
    .in("user_id", userIds)) as SbMany<{ user_id: string }>;

  const existing = new Set(
    (existingResp.data ?? []).map((r) => r.user_id)
  );
  const toInsert = userIds.filter((id) => !existing.has(id));
  if (toInsert.length === 0) return;

  const insResp = (await (
    supabase.from("org_event_participants" as never) as unknown as {
      insert: (p: unknown) => Promise<{ error: SbErr }>;
    }
  ).insert(
    toInsert.map((user_id) => ({
      event_id: eventId,
      user_id,
    }))
  )) as { error: SbErr };

  if (insResp.error) {
    console.error("[linkUsersToEvent] error", insResp.error);
    throw new Error(`행사 연결 실패: ${insResp.error.message}`);
  }
}
