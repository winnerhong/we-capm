// 행사 입장 — 활성 기관을 그 행사의 기관으로 전환한 뒤 홈으로 보낸다.
//
// 왜 라우트 핸들러인가:
//   참가자 앱(홈·스탬프북·미션·토리FM·빙고·토리톡)은 전부 세션 쿠키의 orgId 를
//   컨텍스트로 읽는다. 두 기관에 소속된 보호자가 B기관 초대장에서 바로 들어오면
//   활성 기관이 A인 채라 엉뚱한 기관 화면이 뜬다. 그래서 진입 시 전환이 필요한데,
//   Server Component 렌더 중에는 쿠키를 쓸 수 없다(Next 제약). 서버 액션이 아닌
//   링크 진입 경로라서 라우트 핸들러로 처리한다.
//   (같은 패턴: /api/admin/impersonate, /api/partner/impersonate-org)
//
// 사용: <Link href="/api/user/enter-event?event_id={uuid}">
//
// 분기:
//   미로그인        → /join/event/{id} (연락처 확인 후 참가)
//   행사 없음       → /home
//   미참가          → /join/event/{id}
//   참가자          → 활성 기관 전환 → /home?event_id={id}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/user-auth-guard";
import { isEventParticipant } from "@/lib/org-events/queries";
import { switchActiveOrg } from "@/lib/app-user/session";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function to(request: Request, path: string): NextResponse {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  return NextResponse.redirect(new URL(path, origin), { status: 303 });
}

export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get("event_id") ?? "";
  // eventId 는 그대로 경로에 되돌려주므로 형식 검증 필수 (open redirect / 주입 방지)
  if (!UUID_RE.test(eventId)) return to(request, "/home");

  const session = await getAppUser();
  if (!session) return to(request, `/join/event/${eventId}`);

  const supabase = await createClient();
  const evtResp = (await (
    supabase.from("org_events" as never) as unknown as {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => {
          maybeSingle: () => Promise<{
            data: { id: string; org_id: string } | null;
          }>;
        };
      };
    }
  )
    .select("id, org_id")
    .eq("id", eventId)
    .maybeSingle()) as { data: { id: string; org_id: string } | null };

  const evt = evtResp.data;
  if (!evt) return to(request, "/home");

  // 참가자가 아니면 입장이 아니라 참가 플로우로.
  const joined = await isEventParticipant(eventId, session.id).catch(
    () => false
  );
  if (!joined) return to(request, `/join/event/${eventId}`);

  // 소속은 만들지 않는다 — 행사 참가 ≠ 기관 소속.
  // 활성 기관 전환은 참가자 자격만으로 허용된다(hasOrgAccess).
  await switchActiveOrg(evt.org_id);

  return to(request, `/home?event_id=${eventId}`);
}
