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

  // [내 행사] 하나에 걸 신호 배지 (검수 대기 / 시작 안 한 행사 / FM LIVE).
  // 지사 표시명은 더 안 쓴다 — 그 라벨을 달던 메뉴가 행사 ④ 진행으로 들어갔다.
  const badges = await loadOrgNavBadges(orgId);

  return (
    <div className="min-h-dvh bg-[#FFF8F0]">
      <OrgNav
        orgId={orgId}
        orgName={orgName}
        badges={badges}
      />
      <main>{children}</main>
    </div>
  );
}
