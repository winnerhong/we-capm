import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { loadOrgNavBadges } from "@/lib/org-nav/badges";
import { OrgNav } from "./_nav/org-nav";
import { loadTopMenuTools } from "@/lib/org-tools/pins";
import { toolHref } from "@/lib/org-tools/registry";

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
  // 배지와 상단 도구는 서로를 필요로 하지 않는다 — 기관 화면 **전부**가 이
  // 레이아웃을 지나므로 줄줄이 기다리면 그 지연을 매 화면에서 다시 문다.
  const [badges, pinned] = await Promise.all([
    loadOrgNavBadges(orgId),
    loadTopMenuTools(orgId),
  ]);

  const tools = pinned.map((t) => ({
    key: t.key,
    label: t.label,
    icon: t.icon,
    href: toolHref(t, orgId),
    newTab: t.newTab,
  }));

  return (
    <div className="min-h-dvh bg-[#FFF8F0]">
      <OrgNav
        orgId={orgId}
        orgName={orgName}
        badges={badges}
        tools={tools}
      />
      <main>{children}</main>
    </div>
  );
}
