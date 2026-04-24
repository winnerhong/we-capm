import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

/**
 * 지사 전용 — 자기 기관 고객으로 즉시 로그인 전환.
 *
 * 사용: /api/partner/impersonate-org?id={orgId}
 *
 * - requirePartner() 로 지사 세션 검증
 * - 대상 org 의 partner_id 가 현재 지사와 일치하는지 검증 (타 지사 기관 임의 로그인 차단)
 * - 기존 campnic_partner 쿠키는 유지 (지사로 되돌아갈 수 있음)
 * - campnic_org 쿠키 세팅 후 기관 포털 홈으로 이동
 */
export async function GET(request: NextRequest) {
  const partner = await requirePartner();

  const orgId = request.nextUrl.searchParams.get("id");
  if (!orgId) {
    return NextResponse.json(
      { error: "id가 필요합니다. (예: ?id=orgUuid)" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: org } = await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: {
              id: string;
              org_name: string;
              partner_id: string;
              auto_username: string | null;
            } | null;
          }>;
        };
      };
    }
  )
    .select("id, org_name, partner_id, auto_username")
    .eq("id", orgId)
    .maybeSingle();

  if (!org) {
    return NextResponse.json(
      { error: "해당 기관을 찾을 수 없어요" },
      { status: 404 }
    );
  }

  // 소유권 검증: 이 지사의 기관이어야 함
  if (org.partner_id !== partner.id) {
    return NextResponse.json(
      { error: "이 기관은 이 지사에 속하지 않아요" },
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

  cookieStore.delete("campnic_org");
  cookieStore.delete("campnic_manager");
  cookieStore.set(
    "campnic_org",
    JSON.stringify({
      orgId: org.id,
      orgName: org.org_name,
      managerId: org.auto_username ?? "partner-impersonate",
      loginAt: new Date().toISOString(),
    }),
    cookieOpts
  );

  return new NextResponse(
    `<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=/org/${org.id}">
  <title>로그인 전환</title>
</head>
<body style="font-family:sans-serif;text-align:center;padding:40px;background:#FFF8F0;color:#2D5A3D">
  <div style="font-size:48px">🏫</div>
  <p style="font-size:18px;margin-top:16px">${org.org_name}(으)로 전환 중...</p>
  <p style="margin-top:8px"><a href="/org/${org.id}" style="color:#3A7A52">이동 중...</a></p>
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
