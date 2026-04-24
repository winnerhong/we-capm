import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgHomeDashboard } from "@/lib/org-home/queries";
import { createClient } from "@/lib/supabase/server";
import { OrgHomeStack } from "./_home/org-home-stack";

export const dynamic = "force-dynamic";

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const org = await requireOrg();

  // orgName 조회 — 세션에 이름이 비어있는 엣지 케이스 대비
  const supabase = await createClient();
  const { data: orgRow } = await (supabase
    .from("partner_orgs" as never) as any)
    .select("id, org_name")
    .eq("id", orgId)
    .maybeSingle();
  const orgName: string = orgRow?.org_name ?? org.orgName ?? "기관";

  const snapshot = await loadOrgHomeDashboard(orgId, orgName, org.managerId);

  return <OrgHomeStack snapshot={snapshot} orgId={orgId} />;
}
