// 행사 참가 — 링크 한 번으로 참가까지 끝내고 홈으로 보낸다.
//
// 왜 생겼나:
//   연락처를 넣고 로그인하면 /join/event/{id} 로 돌아와 "○○ 학부모님 반가워요!
//   이 행사에 참가하시겠어요? [행사 참가하기]" 가 떴다. 방금 **이 행사의**
//   연락처 입력을 끝낸 사람에게 같은 질문을 한 번 더 한 셈이다. 초대장에서
//   「이 행사 참가하기」 를 누르고 온 사람도 같은 화면을 또 만났다.
//   이미 한 말은 다시 묻지 않는다.
//
// 왜 라우트 핸들러인가:
//   참가는 쿠키를 쓴다(활성 기관 전환). Server Component 렌더 중에는 쿠키를
//   쓸 수 없어서, 링크로 들어오는 경로는 라우트 핸들러가 맡는다.
//   (같은 패턴: /api/user/enter-event, /api/invitation/enter)
//
// enter-event 와의 차이:
//   enter-event = **이미 참가자**를 들여보낸다(미참가면 참가 화면으로).
//   join-event  = 참가까지 시킨다. 판단은 performEventJoin 한 곳에서 한다.
//
// 사용: <Link href="/api/user/join-event?event_id={uuid}">
//       로그인 redirect 대상으로도 쓴다(?redirect=/api/user/join-event?...).

import { NextResponse } from "next/server";
import { performEventJoin } from "@/lib/org-events/join-actions";

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

  const result = await performEventJoin(eventId);

  // 참가할 수 없는 경우 — 에러 페이지 대신 참가 화면으로 돌려보낸다.
  // 그 화면이 "마감됐어요 / 신청이 필요해요" 를 이미 제대로 말한다.
  if (result.kind === "ERROR") {
    console.error("[api/user/join-event]", result.message);
    return to(request, `/join/event/${eventId}`);
  }

  return to(request, result.to);
}
