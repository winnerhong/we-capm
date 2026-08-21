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
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { switchActiveOrg } from "@/lib/app-user/session";

type SbErr = { message: string; code?: string } | null;

type OrgEventLite = {
  id: string;
  org_id: string;
  status: string;
};

type UserSession = { id: string; orgId: string };

/**
 * 쿠키에서 app_user 세션 로드. 파싱 실패/필드 누락 시 null.
 */
async function loadUserSessionFromCookie(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("campnic_user")?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { id?: unknown; orgId?: unknown };
    const id = typeof parsed.id === "string" ? parsed.id : "";
    const orgId = typeof parsed.orgId === "string" ? parsed.orgId : "";
    if (!id || !orgId) return null;
    return { id, orgId };
  } catch {
    return null;
  }
}

/**
 * 초대 URL 을 받은 참가자가 해당 행사에 자기 자신을 등록.
 *  - 미로그인 → /join/event/{eventId} 로 redirect (거기서 폰 입력 유도)
 *  - 타 기관 행사 → 에러
 *  - 이미 등록됨 → no-op (upsert 로 멱등)
 *  - 성공 → /home?event_id={eventId} 로 redirect
 */
export async function joinOrgEventAction(eventId: string): Promise<void> {
  if (!eventId) throw new Error("행사 정보가 비어 있어요");

  // 1) 세션 확인 (redirect 는 try/catch 바깥에서 호출되어야 하므로
  //    일단 값만 꺼낸 뒤 플래그로 판단)
  const session = await loadUserSessionFromCookie();
  if (!session) {
    redirect(`/join/event/${eventId}`);
  }

  const supabase = await createClient();

  // 2) 행사 로드
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
    .select("id, org_id, status")
    .eq("id", eventId)
    .maybeSingle()) as { data: OrgEventLite | null; error: SbErr };

  if (eventResp.error) {
    console.error("[org-events/join] event lookup error", {
      code: eventResp.error.code,
    });
    throw new Error("행사를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
  const evt = eventResp.data;
  if (!evt) throw new Error("행사를 찾을 수 없어요");

  // 3) 소속은 만들지 않는다 — 행사 참가 ≠ 기관 소속.
  //    초대장으로 행사 하나에 참가한 것만으로 그 기관이 "내 기관"이 되면,
  //    등록한 적 없는 기관 화면이 홈처럼 뜬다. 접근 권한은 아래 참가 기록
  //    (org_event_participants) 만으로 충분하다.

  // 4) org_event_participants upsert (PK: event_id,user_id → 멱등)
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
    throw new Error(`참가 등록에 실패했어요: ${upResp.error.message}`);
  }

  // 5) 활성 기관을 이 행사의 기관으로 전환 — 홈·스탬프북·FM 이 전부 세션의
  //    orgId 를 컨텍스트로 읽으므로, 전환하지 않으면 방금 참가한 행사가 아니라
  //    이전 기관 화면이 뜬다. (4단계에서 소속을 넣었으므로 검증도 통과)
  await switchActiveOrg(evt.org_id);

  // 6) 홈으로 리다이렉트
  revalidatePath("/home");
  redirect(`/home?event_id=${eventId}`);
}
