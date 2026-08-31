import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgNameById } from "@/lib/org-partner";
import { loadOrgNavBadges } from "@/lib/org-nav/badges";
import { OrgNav } from "./_nav/org-nav";
import { loadTopMenuTools } from "@/lib/org-tools/pins";
import { loadOrgAcornGuide } from "@/lib/scoring/guide-queries";
import { canUse, loadOrgFeatureFlags } from "@/lib/features/org-switches";
import { F } from "@/lib/features/codes";
import { toolHref } from "@/lib/org-tools/registry";

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

  // 페이지도 같은 이름을 읽는다 — 공용 로더가 요청당 한 번으로 합쳐 준다.
  const orgName = await loadOrgNameById(orgId, org.orgName ?? "기관");

  // [내 행사] 하나에 걸 신호 배지 (검수 대기 / 시작 안 한 행사 / FM LIVE).
  // 지사 표시명은 더 안 쓴다 — 그 라벨을 달던 메뉴가 행사 ④ 진행으로 들어갔다.
  // 배지와 상단 도구는 서로를 필요로 하지 않는다 — 기관 화면 **전부**가 이
  // 레이아웃을 지나므로 줄줄이 기다리면 그 지연을 매 화면에서 다시 문다.
  const [badges, pinned, acornGuide, flags] = await Promise.all([
    loadOrgNavBadges(orgId),
    loadTopMenuTools(orgId),
    loadOrgAcornGuide(orgId),
    // 요청당 한 번만 읽힌다(cache()) — 다른 로더가 이미 불렀으면 왕복이 없다.
    loadOrgFeatureFlags(orgId),
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
        acornGuide={acornGuide}
        showStampbook={canUse(flags, F.STAMPBOOK)}
        showStats={canUse(flags, F.MISSION_LIB)}
      />
      <main>{children}</main>
    </div>
  );
}
