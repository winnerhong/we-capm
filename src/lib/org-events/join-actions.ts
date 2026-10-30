"use server";

// 참가자(app_user) 가 초대 URL 을 통해 기관 행사에 자가 등록하는 서버 액션.
//
// 흐름:
//  1) campnic_user 쿠키에서 세션 로드 (없으면 join 페이지로 돌려보냄)
//  2) org_events 조회 (기관 소속은 만들지 않는다 — 참가 ≠ 소속)
//  3) org_event_participants 에 upsert (PK: event_id, user_id)
//  4) /home?event_id=... 로 redirect (Next redirect 는 throw — try/catch 바깥에서 호출)
//
// 기관 벽 없음: 예전에는 session.orgId 와 event.org_id 가 다르면 거부했다.
// 한 보호자가 여러 기관 초대장을 받는 게 정상이므로 참가 기록만 남긴다.
//
// 주의: Next 16 cookies() 는 async. redirect() 는 내부적으로 throw 하므로
//       에러 흐름이 아닌 정상 흐름으로 간주해야 한다. 그래서 try/catch 로
//       감싸지 않는다 (감싸면 redirect 가 에러로 취급됨).

import { revalidatePath } from "next/cache";
import { openSession } from "@/lib/session-cookie";
import { redirect } from "next/navigation";
import { resolveEventAccess } from "@/lib/org-events/event-access";
import { isEventParticipant } from "@/lib/org-events/queries";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { switchActiveOrg } from "@/lib/app-user/session";

type SbErr = { message: string; code?: string } | null;

type OrgEventLite = {
  id: string;
  org_id: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  /** 접수·승인제. true 면 신청서를 거치지 않은 자가 참가를 막는다. */
  applications_enabled: boolean | null;
};

type UserSession = { id: string; orgId: string };

/**
 * 쿠키에서 app_user 세션 로드. 파싱 실패/필드 누락 시 null.
 */
async function loadUserSessionFromCookie(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const parsed = await openSession<{ id?: unknown; orgId?: unknown }>(
    cookieStore.get("campnic_user")?.value
  );
  if (!parsed) return null;
  const id = typeof parsed.id === "string" ? parsed.id : "";
  const orgId = typeof parsed.orgId === "string" ? parsed.orgId : "";
  if (!id || !orgId) return null;
  return { id, orgId };
}

/**
 * 참가 처리의 알맹이 — **화면 이동 방법을 모르는** 순수 절차.
 *
 * 부르는 곳이 둘이다:
 *   서버 액션(joinOrgEventAction)  — 폼·버튼에서. redirect() 로 이동한다.
 *   라우트 핸들러(/api/user/join-event) — 링크로 들어올 때. 303 으로 이동한다.
 *
 * 둘이 각자 검사하면 "버튼으로는 막히는데 링크로는 들어가지는" 종류의 구멍이
 * 생긴다. 판단은 여기 한 곳에서만 하고, 어디로 보낼지만 결과로 돌려준다.
 */
export type JoinOutcome =
  /** 참가 완료 — 이 주소로 보내면 된다. */
  | { kind: "OK"; to: string }
  /** 참가는 못 했지만 갈 곳이 있다 (로그인·신청 필요 등). */
  | { kind: "REDIRECT"; to: string }
  /** 참가할 수 없다. 사람이 읽을 이유. */
  | { kind: "ERROR"; message: string };

export async function performEventJoin(eventId: string): Promise<JoinOutcome> {
  if (!eventId) return { kind: "ERROR", message: "행사 정보가 비어 있어요" };

  const session = await loadUserSessionFromCookie();
  if (!session) {
    return { kind: "REDIRECT", to: `/join/event/${eventId}` };
  }

  const supabase = await createClient();

  // 행사 로드
  const eventResp = (await (
    supabase.from("org_events" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: OrgEventLite | null;
            error: SbErr;
          }>;
        };
      };
    }
  )
    // "*" 인 이유: applications_enabled 는 나중에 실행될 마이그레이션 컬럼이라,
    // 명시 열거하면 SQL 적용 전 배포 창에서 undefined column 으로 참가가 통째로
    // 막힌다. "*" 는 컬럼이 없으면 그냥 값이 안 올 뿐이다.
    .select("*")
    .eq("id", eventId)
    .maybeSingle()) as { data: OrgEventLite | null; error: SbErr };

  if (eventResp.error) {
    console.error("[org-events/join] event lookup error", {
      code: eventResp.error.code,
    });
    return {
      kind: "ERROR",
      message: "행사를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
    };
  }
  const evt = eventResp.data;
  if (!evt) return { kind: "ERROR", message: "행사를 찾을 수 없어요" };

  // 기관이 종료·보관한 행사에는 새로 들어올 수 없다.
  // 이미 참가자면 멱등 upsert 라 아무 일도 안 일어나므로 통과시킨다 —
  // 끝난 행사 링크를 다시 눌러도 사진·설문으로 이어져야 한다.
  const access = resolveEventAccess({
    status: evt.status,
    startsAt: evt.starts_at,
    endsAt: evt.ends_at,
  });
  if (!access.canJoin) {
    const joined = await isEventParticipant(eventId, session.id).catch(
      () => false
    );
    if (!joined) {
      return { kind: "ERROR", message: "참가 신청이 마감된 행사예요" };
    }
  }

  // 접수·승인제가 켜진 행사 — 신청서를 거치지 않은 자가 참가는 막는다.
  // 이미 참가자면(= 기관이 수락했거나 명단에 올렸으면) 그대로 통과.
  if (evt.applications_enabled) {
    const existingResp = (await (
      supabase.from("org_event_participants" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<{ data: { user_id: string } | null }>;
            };
          };
        };
      }
    )
      .select("user_id")
      .eq("event_id", eventId)
      .eq("user_id", session.id)
      .maybeSingle()) as { data: { user_id: string } | null };

    if (!existingResp.data) {
      return { kind: "REDIRECT", to: `/invitation/${eventId}#apply` };
    }
  }

  // 소속은 만들지 않는다 — 행사 참가 ≠ 기관 소속.
  //   초대장으로 행사 하나에 참가한 것만으로 그 기관이 "내 기관"이 되면,
  //   등록한 적 없는 기관 화면이 홈처럼 뜬다. 접근 권한은 아래 참가 기록
  //   (org_event_participants) 만으로 충분하다.

  // org_event_participants upsert (PK: event_id,user_id → 멱등)
  const upResp = (await (
    supabase.from("org_event_participants" as never) as unknown as {
      upsert: (
        p: unknown,
        opts: { onConflict: string }
      ) => Promise<{ error: SbErr }>;
    }
  ).upsert(
    {
      event_id: eventId,
      user_id: session.id,
      joined_at: new Date().toISOString(),
    },
    { onConflict: "event_id,user_id" }
  )) as { error: SbErr };

  // 23505(unique_violation) 는 ON CONFLICT 로 피해가지만 방어적으로 체크
  if (upResp.error && upResp.error.code !== "23505") {
    console.error("[org-events/join] upsert error", {
      code: upResp.error.code,
    });
    return {
      kind: "ERROR",
      message: `참가 등록에 실패했어요: ${upResp.error.message}`,
    };
  }

  // 활성 기관을 이 행사의 기관으로 전환 — 홈·스탬프북·FM 이 전부 세션의
  // orgId 를 컨텍스트로 읽으므로, 전환하지 않으면 방금 참가한 행사가 아니라
  // 이전 기관 화면이 뜬다.
  await switchActiveOrg(evt.org_id);

  return { kind: "OK", to: `/home?event_id=${eventId}` };
}

/**
 * 초대 URL 을 받은 참가자가 해당 행사에 자기 자신을 등록.
 *  - 미로그인 → /join/event/{eventId} 로 redirect (거기서 폰 입력 유도)
 *  - 접수제 미신청 → /invitation/{id}#apply
 *  - 이미 등록됨 → no-op (upsert 로 멱등)
 *  - 성공 → /home?event_id={eventId} 로 redirect
 */
export async function joinOrgEventAction(eventId: string): Promise<void> {
  const result = await performEventJoin(eventId);
  // redirect() 는 throw 다 — 에러 흐름이 아니므로 try/catch 로 감싸지 않는다.
  if (result.kind === "ERROR") throw new Error(result.message);
  if (result.kind === "OK") revalidatePath("/home");
  redirect(result.to);
}
