import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgNameById } from "@/lib/org-partner";
import { loadOrgNavBadges } from "@/lib/org-nav/badges";
import { OrgNav } from "./_nav/org-nav";
import { loadTopMenuTools } from "@/lib/org-tools/pins";
import { loadOrgAcornGuide } from "@/lib/scoring/guide-queries";
import {
  canUse,
  loadOrgFeatureFlags,
  lockReason,
} from "@/lib/features/org-switches";
import { F } from "@/lib/features/codes";
import {
  ORG_TOOL_GROUPS,
  ORG_TOOL_GROUP_ORDER,
  toolHref,
  toolsInGroup,
} from "@/lib/org-tools/registry";
import { isLocked, sortUsableFirst } from "@/lib/org-tools/order";

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

  // [내 행사] 하나에 걸 신호 배지 (검수 대기 / 시작 안 한 행사 / FM LIVE).
  // 지사 표시명은 더 안 쓴다 — 그 라벨을 달던 메뉴가 행사 ④ 진행으로 들어갔다.
  // 배지와 상단 도구는 서로를 필요로 하지 않는다 — 기관 화면 **전부**가 이
  // 레이아웃을 지나므로 줄줄이 기다리면 그 지연을 매 화면에서 다시 문다.
  //
  // 기관명도 여기 넣는다. 예전엔 위에서 혼자 await 했는데, 나머지 넷 중 어느
  // 것도 기관명을 필요로 하지 않는다. 계측해 보니 그 한 줄이 **혼자 하나의
  // 물결**이었다 — 모든 기관 화면이 다른 질의를 시작하기도 전에 80ms 를 먼저
  // 물고 들어갔다. 레이아웃은 기관 화면 전부가 지나는 길이라 그 값이 매번 붙는다.
  const [orgName, badges, pinned, acornGuide, flags] = await Promise.all([
    loadOrgNameById(orgId, org.orgName ?? "기관"),
    loadOrgNavBadges(orgId),
    loadTopMenuTools(orgId),
    loadOrgAcornGuide(orgId),
    // 요청당 한 번만 읽힌다(cache()) — 다른 로더가 이미 불렀으면 왕복이 없다.
    loadOrgFeatureFlags(orgId),
  ]);

  // 「⋯ 전체」 서랍이 그릴 것. 홈 「모든 기능」 카드와 같은 레지스트리를 읽으니
  // 목록이 갈라질 수 없다. 잠긴 칸은 지우지 않고 **그룹 안에서 뒤로** 보낸다 —
  // 쓸 수 있는 것 사이에 섞여 있으면 매번 자물쇠를 걸러 읽어야 한다.
  const allToolGroups = ORG_TOOL_GROUP_ORDER.map((g) => ({
    key: g,
    title: ORG_TOOL_GROUPS[g].title,
    hint: ORG_TOOL_GROUPS[g].hint,
    tools: sortUsableFirst(toolsInGroup(g), flags).map((t) => ({
      key: t.key,
      label: t.label,
      icon: t.icon,
      href: toolHref(t, orgId),
      newTab: t.newTab,
      locked: isLocked(t, flags),
      why: t.featureCode ? lockReason(flags, t.featureCode) : null,
    })),
  }));

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
        allToolGroups={allToolGroups}
      />
      <main>{children}</main>
    </div>
  );
}
