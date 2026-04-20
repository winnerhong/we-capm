import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const EVENT_ID = "aca98cdb-e727-4feb-a537-3b48375a5438";
const TEST_PHONE = "010-1111-0001";

function htmlRedirect(url: string, message: string) {
  return new NextResponse(
    `<html><head><meta http-equiv="refresh" content="0;url=${url}"></head>
     <body style="font-family:sans-serif;text-align:center;padding:40px">
       <p>${message}</p><p><a href="${url}">이동 중...</a></p>
     </body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

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
  cookieStore.delete("campnic_partner");

  if (role === "admin") {
    cookieStore.set("campnic_admin", JSON.stringify({
      id: "admin", role: "ADMIN", loginAt: new Date().toISOString(),
    }), cookieOpts);
    return htmlRedirect("/admin", "👨‍💼 관리자로 로그인 중...");
  }

  if (role === "manager") {
    cookieStore.set("campnic_manager", JSON.stringify({
      eventId: EVENT_ID,
      eventName: "테스트 토리로",
      managerId: "테스트기관",
      loginAt: new Date().toISOString(),
    }), cookieOpts);
    return htmlRedirect(`/manager/${EVENT_ID}`, "🏢 기관으로 로그인 중...");
  }

  if (role === "partner") {
    const supabase = await createClient();
    const { data: partner } = await (supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            limit: (n: number) => {
              maybeSingle: () => Promise<{
                data: { id: string; name: string; username: string } | null;
              }>;
            };
          };
        };
      };
    })
      .from("partners")
      .select("id, name, username")
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle();

    if (!partner) {
      return NextResponse.json(
        { error: "ACTIVE 상태의 partner가 없습니다. 먼저 숲지기 가입 후 관리자에서 승인하세요." },
        { status: 404 }
      );
    }

    cookieStore.set("campnic_partner", JSON.stringify({
      id: partner.id,
      name: partner.name,
      username: partner.username,
      loginAt: new Date().toISOString(),
    }), cookieOpts);
    return htmlRedirect("/partner/dashboard", "🏡 숲지기로 로그인 중...");
  }

  if (role === "participant") {
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
    return htmlRedirect(`/event/${EVENT_ID}`, "👨‍👩‍👧 이용자로 로그인 중...");
  }

  return NextResponse.json({ error: "role required: admin | manager | partner | participant" }, { status: 400 });
}
