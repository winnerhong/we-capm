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
  const isEventRoute = pathname.startsWith("/event");

  // API, 입장, 로그인, 매니저 로그인 → 무조건 통과
  if (isApiRoute || isJoinRoute || isLoginRoute || isManagerLogin || pathname === "/offline") return response;

  // 참가자: campnic_participant 쿠키
  const participantCookie = request.cookies.get("campnic_participant");
  if (isEventRoute && participantCookie?.value) return response;

  // 매니저: campnic_manager 쿠키
  const managerCookie = request.cookies.get("campnic_manager");
  if (isManagerRoute && managerCookie?.value) return response;
  if (isManagerRoute && !managerCookie?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/manager";
    return NextResponse.redirect(url);
  }

  // QR 이미지는 누구나 접근 가능
  if (pathname.includes("/qr")) return response;

  // 관리자: campnic_admin 쿠키
  const adminCookie = request.cookies.get("campnic_admin");
  if (isAdminRoute && (adminCookie?.value || managerCookie?.value)) return response;

  if (isAdminRoute && !adminCookie?.value && !managerCookie?.value) {
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
