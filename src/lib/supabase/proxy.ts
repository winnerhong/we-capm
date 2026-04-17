import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  const isApiRoute = pathname.startsWith("/api");
  const isJoinRoute = pathname.startsWith("/join");
  const isLoginRoute = pathname === "/login";
  const isAdminRoute = pathname.startsWith("/admin");
  const isEventRoute = pathname.startsWith("/event");

  // API, 입장, 로그인 → 무조건 통과
  if (isApiRoute || isJoinRoute || isLoginRoute || pathname === "/offline") return response;

  // 참가자: campnic_participant 쿠키
  const participantCookie = request.cookies.get("campnic_participant");
  if (isEventRoute && participantCookie?.value) return response;

  // 관리자: campnic_admin 쿠키
  const adminCookie = request.cookies.get("campnic_admin");
  if (isAdminRoute && adminCookie?.value) return response;

  // 관리자 페이지인데 쿠키 없음 → 로그인
  if (isAdminRoute && !adminCookie?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 이벤트 페이지인데 쿠키 없음 → 입장
  if (isEventRoute && !participantCookie?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/join";
    return NextResponse.redirect(url);
  }

  return response;
}
