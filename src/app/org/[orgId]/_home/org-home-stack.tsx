import type { OrgHomeDashboard } from "@/lib/org-home/types";
import { HeroCard } from "./hero-card";
import { NextActionCard } from "./next-action-card";
import { ControlRoomBanner } from "./control-room-banner";
import { ToriFmCard } from "./tori-fm-card";
import { AllToolsCard } from "./all-tools-card";
import { ResourceFamilyCard } from "./resource-family-card";
import { PartnerNewCard } from "./partner-new-card";
import { FooterLinksCard } from "./footer-links-card";
import { CollapsibleCard } from "./collapsible-card";

type Props = {
  snapshot: OrgHomeDashboard;
  orgId: string;
};

// 「현재 행사」·「최근 가입 가족」 카드는 여기서 뺐다.
//   현재 행사 = 행사 목록 탭이 같은 걸 더 잘 보여준다(전부, 상태 전환까지).
//   최근 가입 가족 = 참가자 탭이 그 자리다.
// 홈에 다시 그려 봐야 "어느 쪽이 진짜지" 만 생기고, 그 두 카드가 조회 세 번을
// 더 걸어 홈이 그만큼 늦게 떴다.
export function OrgHomeStack({ snapshot, orgId }: Props) {
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-4 pb-24">
      {/* 핵심 카드: 접기 불가 */}
      <HeroCard dashboard={snapshot} orgId={orgId} />
      <NextActionCard action={snapshot.nextAction} orgId={orgId} />

      {/* 핵심 카드: 관제실 배너 — 접기 불가 */}
      <ControlRoomBanner preview={snapshot.controlRoomPreview} orgId={orgId} />

      {/* 토리FM — 카드는 진작 만들어져 있었는데 여기 붙지 않아 홈에서 들어갈 길이 없었다.
          (행사 상세의 운영 도구를 거쳐야만 갈 수 있었다) 방송중이면 빨간 점이 뜬다. */}
      <ToriFmCard fm={snapshot.fm} orgId={orgId} />

      {/* 모든 기능 목록판 — 행사 상세 안에만 있던 도구들까지 여기서 전부 간다. */}
      <CollapsibleCard storageKey="all-tools" title="모든 기능" icon="🧭">
        <AllToolsCard orgId={orgId} />
      </CollapsibleCard>

      {/* 부가 카드 3: 자료실 */}
      <CollapsibleCard
        storageKey="resource-family"
        title="자료실"
        icon="📚"
      >
        <ResourceFamilyCard resources={snapshot.resources} orgId={orgId} />
      </CollapsibleCard>

      {/* 부가 카드 5: 파트너 신규 */}
      <CollapsibleCard
        storageKey="partner-new"
        title="파트너 신규"
        icon="🆕"
      >
        <PartnerNewCard partnerNew={snapshot.partnerNew} orgId={orgId} />
      </CollapsibleCard>

      {/* 핵심 카드: 푸터 링크 — 접기 불가 */}
      <FooterLinksCard documents={snapshot.documents} orgId={orgId} />
    </div>
  );
}
