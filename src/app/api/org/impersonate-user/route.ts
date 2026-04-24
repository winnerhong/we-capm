import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";

/**
 * 기관 전용 — 자기 기관 참가자(app_user)로 즉시 로그인 전환.
 *
 * 사용: /api/org/impersonate-user?id={appUserId}
 *
 * - requireOrg() 로 기관 세션 검증
 * - 대상 app_user 의 org_id 가 현재 기관과 일치하는지 검증 (타 기관 참가자 임의 로그인 차단)
 * - 기존 campnic_org 쿠키는 유지 → 기관으로 되돌아갈 수 있음
 * - campnic_user 쿠키 세팅 후 참가자 홈(/home)으로 이동
 */
export async function GET(request: NextRequest) {
  const org = await requireOrg();

  const userId = request.nextUrl.searchParams.get("id");
  if (!userId) {
    return NextResponse.json(
      { error: "id가 필요합니다. (예: ?id=userUuid)" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

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
              status: string;
            } | null;
          }>;
        };
      };
    }
  )
    .select("id, phone, parent_name, org_id, status")
    .eq("id", userId)
    .maybeSingle();

  if (!user) {
    return NextResponse.json(
      { error: "해당 참가자를 찾을 수 없어요" },
      { status: 404 }
    );
  }

  // 소유권 검증: 이 기관의 참가자여야 함
  if (user.org_id !== org.orgId) {
    return NextResponse.json(
      { error: "이 참가자는 이 기관에 속하지 않아요" },
      { status: 403 }
    );
  }

  if (user.status !== "ACTIVE") {
    return NextResponse.json(
      { error: `이 참가자는 현재 ${user.status} 상태예요` },
      { status: 403 }
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

  cookieStore.delete("campnic_user");
  cookieStore.set(
    "campnic_user",
    JSON.stringify({
      id: user.id,
      phone: user.phone,
      parentName: user.parent_name,
      orgId: user.org_id,
      orgName: org.orgName,
      loginAt: new Date().toISOString(),
    }),
    cookieOpts
  );

  return new NextResponse(
    `<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=/home">
  <title>로그인 전환</title>
</head>
<body style="font-family:sans-serif;text-align:center;padding:40px;background:#FFF8F0;color:#2D5A3D">
  <div style="font-size:48px">👨‍👩‍👧</div>
  <p style="font-size:18px;margin-top:16px">${user.parent_name}님으로 전환 중...</p>
  <p style="margin-top:8px"><a href="/home" style="color:#3A7A52">이동 중...</a></p>
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
