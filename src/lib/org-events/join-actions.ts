"use server";

// 참가자(app_user) 가 초대 URL 을 통해 기관 행사에 자가 등록하는 서버 액션.
//
// 흐름:
//  1) campnic_user 쿠키에서 세션 로드 (없으면 join 페이지로 돌려보냄)
//  2) org_events 조회 + 현재 사용자 orgId 와 일치하는지 검증
//  3) org_event_participants 에 upsert (PK: event_id, user_id)
//  4) /home?event_id=... 로 redirect (Next redirect 는 throw — try/catch 바깥에서 호출)
//
// 주의: Next 16 cookies() 는 async. redirect() 는 내부적으로 throw 하므로
//       에러 흐름이 아닌 정상 흐름으로 간주해야 한다. 그래서 try/catch 로
//       감싸지 않는다 (감싸면 redirect 가 에러로 취급됨).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

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

  // 3) 소속 기관 체크 — 타 기관 행사는 자가 등록 불가
  if (evt.org_id !== session.orgId) {
    throw new Error(
      "다른 기관의 행사에는 참여할 수 없어요. 기관에 문의해 주세요."
    );
  }

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

  // 5) 홈으로 리다이렉트
  revalidatePath("/home");
  redirect(`/home?event_id=${eventId}`);
}
