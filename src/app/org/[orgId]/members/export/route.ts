// org 매니저 가족 명단 CSV 내보내기.
//  - requireOrg → 본인 orgId 만. URL path orgId 와 다르면 거부.

import { NextResponse, type NextRequest } from "next/server";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgMembers } from "@/lib/org-members/queries";
import {
  buildMembersCsv,
  parseCsvFilters,
} from "@/lib/org-members/csv";

type RouteParams = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, ctx: RouteParams) {
  const session = await requireOrg();
  const { orgId } = await ctx.params;
  if (orgId !== session.orgId) {
    return NextResponse.json(
      { error: "다른 기관의 명단은 내보낼 수 없어요" },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const { view, filters } = parseCsvFilters(url.searchParams);

  const data = await loadOrgMembers(orgId);
  const csv = buildMembersCsv(data.families, view, filters);

  const today = new Date().toISOString().slice(0, 10);
  const filename = `members-${view}-${today}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
