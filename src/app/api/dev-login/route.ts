import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// DEV 전용 - 프로덕션에서는 동작 안함
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const role = request.nextUrl.searchParams.get("role");
  const cookieStore = await cookies();
  const cookieOpts = {
    httpOnly: true,
    secure: false,
    sameSite: "lax" as const,
    maxAge: 86400,
    path: "/",
  };

  // 기존 쿠키 전부 제거
  cookieStore.delete("campnic_admin");
  cookieStore.delete("campnic_manager");
  cookieStore.delete("campnic_participant");

  if (role === "admin") {
    cookieStore.set("campnic_admin", JSON.stringify({
      id: "admin", role: "ADMIN", loginAt: new Date().toISOString(),
    }), cookieOpts);
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (role === "manager") {
    // 테스트 캠프닉 행사 (ACTIVE 상태)
    cookieStore.set("campnic_manager", JSON.stringify({
      eventId: "aca98cdb-e727-4feb-a537-3b48375a5438",
      eventName: "테스트 윙크",
      managerId: "테스트기관",
      loginAt: new Date().toISOString(),
    }), cookieOpts);
    return NextResponse.redirect(new URL("/manager/aca98cdb-e727-4feb-a537-3b48375a5438", request.url));
  }

  if (role === "participant") {
    cookieStore.set("campnic_participant", JSON.stringify({
      eventId: "aca98cdb-e727-4feb-a537-3b48375a5438",
      phone: "010-1234-5678",
      name: "테스트가족",
      participantId: "dev-test",
    }), cookieOpts);
    return NextResponse.redirect(new URL("/event/aca98cdb-e727-4feb-a537-3b48375a5438", request.url));
  }

  return NextResponse.json({ error: "role required: admin | manager | participant" }, { status: 400 });
}
