// admin 가족 명단 CSV 내보내기.
//  - requireAdmin → 모든 org 데이터 접근 가능
//  - query string: view=family|child, q, class, enrolled

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { loadOrgMembers } from "@/lib/org-members/queries";
import {
  buildMembersCsv,
  parseCsvFilters,
} from "@/lib/org-members/csv";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteParams) {
  await requireAdmin();
  const { id: orgId } = await ctx.params;
  if (!orgId) {
    return NextResponse.json({ error: "missing orgId" }, { status: 400 });
  }

  const url = new URL(req.url);
  const { view, filters } = parseCsvFilters(url.searchParams);

  const data = await loadOrgMembers(orgId);
  const csv = buildMembersCsv(data.families, view, filters);

  const today = new Date().toISOString().slice(0, 10);
  const filename = `members-${view}-${orgId.slice(0, 8)}-${today}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
