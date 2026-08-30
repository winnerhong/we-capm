import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  const isApiRoute = pathname.startsWith("/api");
  const isJoinRoute = pathname.startsWith("/join");
  const isLoginRoute = pathname === "/login";
  const isAdminRoute = pathname.startsWith("/admin");
  const isManagerLogin = pathname === "/manager";
  const isManagerRoute = pathname.startsWith("/manager/");
  // 구 참가자 화면(/event/{id}/…) 전용 관문.
  //
  // startsWith("/event") 였다. 그러면 **"/event" 로 시작하는 모든 경로**가
  // 걸린다 — 공개 행사 목록(/events)도, 종료 안내(/event-closed/…)도 로그인
  // 없는 방문자에게는 /join 으로 튕겨 나갔다. 경계를 슬래시까지 맞춘다.
  const isEventRoute =
    pathname === "/event" || pathname.startsWith("/event/");

  // 공개 라우트
  if (isApiRoute || isJoinRoute || isLoginRoute || isManagerLogin || pathname === "/offline") return response;
  if (pathname.includes("/qr")) return response;

  // 참가자
  const participantCookie = request.cookies.get("campnic_participant");
  if (isEventRoute && participantCookie?.value) return response;

  // 매니저
  const managerCookie = request.cookies.get("campnic_manager");
  if (isManagerRoute && managerCookie?.value) return response;
  if (isManagerRoute && !managerCookie?.value) {
    return NextResponse.redirect(new URL("/manager", request.url));
  }

  // 관리자
  const adminCookie = request.cookies.get("campnic_admin");

  if (isAdminRoute) {
    // 슈퍼 관리자 → 모든 admin 접근 가능
    if (adminCookie?.value) return response;

    // 매니저 → 자기 행사만 접근 가능
    if (managerCookie?.value) {
      try {
        const data = JSON.parse(managerCookie.value);
        const managerEventId = data.eventId ?? "";

        // 매니저 차단: 행사 목록, 전체 통계, 새 행사 생성
        if (pathname === "/admin" || pathname === "/admin/events" || pathname === "/admin/stats" || pathname === "/admin/events/new") {
          return NextResponse.redirect(new URL(`/manager/${managerEventId}`, request.url));
        }

        // 매니저: URL의 eventId와 쿠키의 eventId 비교
        const urlMatch = pathname.match(/\/admin\/events\/([^/]+)/);
        if (urlMatch) {
          const urlEventId = urlMatch[1];
          if (urlEventId !== managerEventId) {
            return NextResponse.redirect(new URL(`/manager/${managerEventId}`, request.url));
          }
        }

        return response;
      } catch {
        return NextResponse.redirect(new URL("/manager", request.url));
      }
    }

    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 이벤트 페이지 쿠키 없음
  if (isEventRoute && !participantCookie?.value) {
    return NextResponse.redirect(new URL("/join", request.url));
  }

  return response;
}
