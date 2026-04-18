import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const EVENT_ID = "aca98cdb-e727-4feb-a537-3b48375a5438";
const TEST_PHONE = "010-1111-0001";

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
    cookieStore.set("campnic_manager", JSON.stringify({
      eventId: EVENT_ID,
      eventName: "테스트 윙크",
      managerId: "테스트기관",
      loginAt: new Date().toISOString(),
    }), cookieOpts);
    return NextResponse.redirect(new URL(`/manager/${EVENT_ID}`, request.url));
  }

  if (role === "participant") {
    // DB에서 실제 참가자 ID 가져오기
    const supabase = await createClient();
    const { data: participant } = await supabase
      .from("participants")
      .select("id")
      .eq("event_id", EVENT_ID)
      .eq("phone", TEST_PHONE)
      .maybeSingle();

    const { data: reg } = await supabase
      .from("event_registrations")
      .select("name")
      .eq("event_id", EVENT_ID)
      .eq("phone", TEST_PHONE)
      .maybeSingle();

    const name = reg?.name?.replace(/^\[.+?\]\s*/, "") ?? "테스트가족";

    cookieStore.set("campnic_participant", JSON.stringify({
      eventId: EVENT_ID,
      phone: TEST_PHONE,
      name,
      participantId: participant?.id ?? "dev-test",
    }), cookieOpts);
    return NextResponse.redirect(new URL(`/event/${EVENT_ID}`, request.url));
  }

  return NextResponse.json({ error: "role required: admin | manager | participant" }, { status: 400 });
}
