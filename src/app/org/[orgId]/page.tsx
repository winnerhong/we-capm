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
  //
  // 나란히 부르는 이유 — 대시보드 12개 로더 중 기관명을 필요로 하는 건 하나도
  // 없다. 줄줄이 기다리면 그 한 왕복만큼 12개가 전부 늦게 출발한다.
  // (이름은 결과에 얹기만 한다. 그래서 fallback 을 넘겨 두고 나중에 덮어쓴다)
  const [orgName, base] = await Promise.all([
    loadOrgNameById(orgId, org.orgName ?? "기관"),
    loadOrgHomeDashboard(orgId, org.orgName ?? "기관", org.managerId),
  ]);
  const snapshot = { ...base, orgName };

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-4">
      </div>
      <OrgHomeStack snapshot={snapshot} orgId={orgId} />
    </>
  );
}
