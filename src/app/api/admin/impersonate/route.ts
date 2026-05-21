import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

/**
 * 관리자 전용 — 특정 계정으로 즉시 로그인 (impersonate).
 *
 * 사용:
 *   /api/admin/impersonate?role=partner&id={partnerId}
 *   /api/admin/impersonate?role=org&id={orgId}
 *   /api/admin/impersonate?role=user&id={appUserId}
 *
 * - requireAdmin 으로 관리자 세션 검증
 * - 기존 섀도잉 쿠키는 유지 (campnic_admin) → 관리자로 되돌아갈 수 있음
 * - 대상 포털의 쿠키를 세팅 후 해당 포털 홈으로 리다이렉트
 */
export async function GET(request: NextRequest) {
  await requireAdmin();

  const role = request.nextUrl.searchParams.get("role");
  const id = request.nextUrl.searchParams.get("id");

  if (!role || !id) {
    return NextResponse.json(
      { error: "role과 id가 필요합니다. (예: ?role=partner&id=uuid)" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 86400,
    path: "/",
  };

  const supabase = await createClient();

  if (role === "partner") {
    const { data: partner } = await (
      supabase.from("partners" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: { id: string; name: string; username: string } | null;
            }>;
          };
        };
      }
    )
      .select("id, name, username")
      .eq("id", id)
      .maybeSingle();

    if (!partner) {
      return NextResponse.json(
        { error: "해당 지사를 찾을 수 없어요" },
        { status: 404 }
      );
    }

    cookieStore.delete("campnic_partner");
    cookieStore.set(
      "campnic_partner",
      JSON.stringify({
        id: partner.id,
        name: partner.name,
        username: partner.username,
        role: "OWNER",
        loginAt: new Date().toISOString(),
      }),
      cookieOpts
    );

    return htmlRedirect(
      "/partner/dashboard",
      `🏡 ${partner.name} 지사로 전환 중...`
    );
  }

  if (role === "org") {
    const { data: org } = await (
      supabase.from("partner_orgs" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: {
                id: string;
                org_name: string;
                auto_username: string | null;
              } | null;
            }>;
          };
        };
      }
    )
      .select("id, org_name, auto_username")
      .eq("id", id)
      .maybeSingle();

    if (!org) {
      return NextResponse.json(
        { error: "해당 기관을 찾을 수 없어요" },
        { status: 404 }
      );
    }

    // 다중 기관 동시 로그인 — 기관별 쿠키.
    cookieStore.delete("campnic_manager");
    cookieStore.set(
      `campnic_org_${org.id}`,
      JSON.stringify({
        orgId: org.id,
        orgName: org.org_name,
        managerId: org.auto_username ?? "admin-impersonate",
        loginAt: new Date().toISOString(),
      }),
      cookieOpts
    );

    return htmlRedirect(
      `/org/${org.id}`,
      `🏫 ${org.org_name}(으)로 전환 중...`
    );
  }

  if (role === "user") {
    const { data: user } = await (
      supabase.from("app_users" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: {
                id: string;
                phone: string;
                parent_name: string;
                org_id: string;
              } | null;
            }>;
          };
        };
      }
    )
      .select("id, phone, parent_name, org_id")
      .eq("id", id)
      .maybeSingle();

    if (!user) {
      return NextResponse.json(
        { error: "해당 참가자를 찾을 수 없어요" },
        { status: 404 }
      );
    }

    // orgName 로드
    const { data: org } = await (
      supabase.from("partner_orgs" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: { org_name: string } | null;
            }>;
          };
        };
      }
    )
      .select("org_name")
      .eq("id", user.org_id)
      .maybeSingle();

    cookieStore.delete("campnic_user");
    cookieStore.set(
      "campnic_user",
      JSON.stringify({
        id: user.id,
        phone: user.phone,
        parentName: user.parent_name,
        orgId: user.org_id,
        orgName: org?.org_name ?? "",
        loginAt: new Date().toISOString(),
      }),
      cookieOpts
    );

    return htmlRedirect("/home", `👨‍👩‍👧 ${user.parent_name}님으로 전환 중...`);
  }

  return NextResponse.json(
    { error: "role은 partner | org | user 중 하나여야 해요" },
    { status: 400 }
  );
}

function htmlRedirect(url: string, message: string) {
  return new NextResponse(
    `<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=${url}">
  <title>로그인 전환</title>
</head>
<body style="font-family:sans-serif;text-align:center;padding:40px;background:#FFF8F0;color:#2D5A3D">
  <div style="font-size:48px"><svg width="48" height="48" viewBox="0 0 64 64" fill="none" stroke="#2D5A3D" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M32 6 L32 14"/><path d="M14 22 Q14 14 32 14 Q50 14 50 22 L50 26 Q50 30 46 30 L18 30 Q14 30 14 26 Z"/><path d="M14 26 L50 26"/><path d="M18 30 Q18 52 32 58 Q46 52 46 30"/></svg></div>
  <p style="font-size:18px;margin-top:16px">${message}</p>
  <p style="margin-top:8px"><a href="${url}" style="color:#3A7A52">이동 중...</a></p>
</body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}
