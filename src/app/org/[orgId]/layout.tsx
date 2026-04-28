import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { loadOrgNavBadges } from "@/lib/org-nav/badges";
import { OrgNav } from "./_nav/org-nav";

type OrgRow = { id: string; org_name: string };

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const org = await requireOrg();

  if (org.orgId !== orgId) {
    redirect("/manager");
  }

  const supabase = await createClient();
  const { data: orgRow } = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: OrgRow | null }>;
        };
      };
    }
  )
    .select("id, org_name")
    .eq("id", orgId)
    .maybeSingle()) as { data: OrgRow | null };

  const orgName: string = orgRow?.org_name ?? org.orgName ?? "기관";

  // 5 그룹 dropdown 의 실시간 신호 배지 (검수 대기 / FM LIVE / 서류 미완료)
  const badges = await loadOrgNavBadges(orgId);

  return (
    <div className="min-h-dvh bg-[#FFF8F0]">
      <OrgNav orgId={orgId} orgName={orgName} badges={badges} />
      <main>{children}</main>
    </div>
  );
}
