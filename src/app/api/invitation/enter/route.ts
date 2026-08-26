// 승인된 신청자의 원-클릭 입장 — 초대장 상태 카드의 [행사 입장하기].
//
// 왜 별도 라우트인가:
//   승인 카드를 보고 있는 사람은 **아직 로그인 상태가 아닐 수 있다.** 신청은
//   로그인 없이 받기 때문이다. 그런데 예전 링크는 /join/event/{id} 로 보내서,
//   "승인됐어요" 를 보고 눌렀는데 다시 연락처를 입력하라는 화면이 떴다.
//   승인까지 끝난 사람에게 한 단계 더 물을 이유가 없다.
//
// 신원 근거:
//   toriro_apply_{eventId} 쿠키(httpOnly)가 이 브라우저의 신청서를 가리킨다.
//   그 쿠키는 (a) 본인이 신청서를 제출했을 때, 또는 (b) 연락처 조회로 본인
//   확인을 했을 때만 심긴다. 기관이 그 신청서를 승인하면서 app_user 와 연결
//   됐으므로 "이 쿠키 보유자 = 그 계정" 으로 본다.
//   이 앱의 로그인 자체가 비밀번호 없는 연락처 입력이라, 신원 근거의 강도는
//   기존 로그인과 같은 수준이다(오히려 링크+쿠키 두 가지를 요구한다).
//
// 분기:
//   유효하지 않은 event_id            → /home
//   이미 로그인 + 그 행사 참가자      → 활성 기관 전환 후 입장
//   쿠키의 신청서가 APPROVED + 참가자 → 세션 발급 후 입장
//   그 외                             → /join/event/{id} (기존 연락처 확인 경로)

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { getAppUser } from "@/lib/user-auth-guard";
import { isEventParticipant } from "@/lib/org-events/queries";
import { setAppUserSession, switchActiveOrg } from "@/lib/app-user/session";
import {
  applicationCookieName,
  loadApplicationById,
} from "@/lib/org-events/application-queries";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

type SbOne<T> = { data: T | null };

function to(request: Request, path: string): NextResponse {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  return NextResponse.redirect(new URL(path, origin), { status: 303 });
}

export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get("event_id") ?? "";
  // eventId 를 그대로 경로에 되돌려주므로 형식 검증 필수 (open redirect 방지)
  if (!UUID_RE.test(eventId)) return to(request, "/home");

  const supabase = await createClient();

  const evtResp = (await (
    supabase.from("org_events" as never) as unknown as {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => {
          maybeSingle: () => Promise<SbOne<{ id: string; org_id: string }>>;
        };
      };
    }
  )
    .select("id, org_id")
    .eq("id", eventId)
    .maybeSingle()) as SbOne<{ id: string; org_id: string }>;

  const evt = evtResp.data;
  if (!evt) return to(request, "/home");

  // 1) 이미 로그인돼 있고 참가자면 그대로 입장 (기존 enter-event 와 동일 동작)
  const session = await getAppUser();
  if (session) {
    const joined = await isEventParticipant(eventId, session.id).catch(
      () => false
    );
    if (joined) {
      await switchActiveOrg(evt.org_id);
      return to(request, `/home?event_id=${eventId}`);
    }
  }

  // 2) 승인된 내 신청서로 세션 발급
  const store = await cookies();
  const applicationId = store.get(applicationCookieName(eventId))?.value;
  if (!applicationId) return to(request, `/join/event/${eventId}`);

  const app = await loadApplicationById(applicationId).catch(() => null);
  if (
    !app ||
    app.event_id !== eventId ||
    app.status !== "APPROVED" ||
    !app.approved_user_id
  ) {
    return to(request, `/join/event/${eventId}`);
  }

  // 승인 후 참가가 풀렸을 수 있다(관리자 제외·취소). 실제 참가 기록으로 다시 확인.
  const stillIn = await isEventParticipant(eventId, app.approved_user_id).catch(
    () => false
  );
  if (!stillIn) return to(request, `/join/event/${eventId}`);

  const userResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => {
          maybeSingle: () => Promise<
            SbOne<{
              id: string;
              phone: string;
              parent_name: string;
              status: string;
            }>
          >;
        };
      };
    }
  )
    .select("id, phone, parent_name, status")
    .eq("id", app.approved_user_id)
    .maybeSingle()) as SbOne<{
    id: string;
    phone: string;
    parent_name: string;
    status: string;
  }>;

  const user = userResp.data;
  // 정지·해지된 계정은 자동 입장시키지 않는다 — 일반 로그인과 같은 기준.
  if (!user || user.status !== "ACTIVE") {
    return to(request, `/join/event/${eventId}`);
  }

  // 활성 기관을 이 행사의 기관으로 바로 잡아 세션을 발급한다.
  // (앱 전역이 세션의 orgId 를 컨텍스트로 읽는다)
  await setAppUserSession({
    id: user.id,
    phone: user.phone,
    parentName: user.parent_name,
    orgId: evt.org_id,
  });

  return to(request, `/home?event_id=${eventId}`);
}
