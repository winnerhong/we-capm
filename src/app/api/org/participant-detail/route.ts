// 관제실 참가자 상세 — 활동/도토리/행사/자녀 등 모든 정보를 온디맨드로 반환.
//   참가자 모달에서 가족을 선택하면 이 API 로 상세를 불러와 한눈에 표시.
//   보안: campnic_org 세션 검증 + loadOrgMemberDetail 이 org 소유까지 재검증.

import { NextRequest, NextResponse } from "next/server";
import { getOrg } from "@/lib/org-auth-guard";
import { loadOrgMemberDetail } from "@/lib/org-members/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const org = await getOrg();
  if (!org) {
    return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  }
  const sp = request.nextUrl.searchParams;
  const orgId = sp.get("org") ?? org.orgId;
  const userId = sp.get("userId") ?? "";
  if (orgId !== org.orgId) {
    return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });
  }
  if (!userId) {
    return NextResponse.json({ error: "userId 가 필요해요" }, { status: 400 });
  }

  const detail = await loadOrgMemberDetail(orgId, userId);
  if (!detail) {
    return NextResponse.json({ error: "참가자를 찾을 수 없어요" }, { status: 404 });
  }
  return NextResponse.json(detail, {
    headers: { "Cache-Control": "no-store" },
  });
}
