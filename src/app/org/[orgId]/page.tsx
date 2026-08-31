import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgHomeDashboard } from "@/lib/org-home/queries";
import { loadOrgNameById } from "@/lib/org-partner";
import { OrgHomeStack } from "./_home/org-home-stack";

export const dynamic = "force-dynamic";

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const org = await requireOrg();

  // orgName 조회 — 세션에 이름이 비어있는 엣지 케이스 대비.
  // 레이아웃도 같은 이름이 필요해 같은 행을 읽는다. 공용 로더가 요청당 한 번으로
  // 합쳐 주므로 여기서 직접 질의하지 않는다.
  const orgName = await loadOrgNameById(orgId, org.orgName ?? "기관");

  const snapshot = await loadOrgHomeDashboard(orgId, orgName, org.managerId);

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-4">
      </div>
      <OrgHomeStack snapshot={snapshot} orgId={orgId} />
    </>
  );
}
