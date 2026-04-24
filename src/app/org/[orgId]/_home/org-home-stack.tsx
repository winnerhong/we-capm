import type { OrgHomeDashboard } from "@/lib/org-home/types";
import { HeroCard } from "./hero-card";
import { NextActionCard } from "./next-action-card";
import { LiveEventCard } from "./live-event-card";
import { RecentParticipantsCard } from "./recent-participants-card";
import { ControlRoomBanner } from "./control-room-banner";
import { ResourceFamilyCard } from "./resource-family-card";
import { ToriFmCard } from "./tori-fm-card";
import { PartnerNewCard } from "./partner-new-card";
import { FooterLinksCard } from "./footer-links-card";
import { CollapsibleCard } from "./collapsible-card";

type Props = {
  snapshot: OrgHomeDashboard;
  orgId: string;
};

export function OrgHomeStack({ snapshot, orgId }: Props) {
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-4 pb-24">
      {/* 핵심 카드: 접기 불가 */}
      <HeroCard dashboard={snapshot} orgId={orgId} />
      <NextActionCard action={snapshot.nextAction} orgId={orgId} />

      {/* 부가 카드 1: 현재 행사 */}
      <CollapsibleCard storageKey="live-event" title="현재 행사" icon="🌲">
        <LiveEventCard event={snapshot.liveEvent} orgId={orgId} />
      </CollapsibleCard>

      {/* 부가 카드 2: 최근 참가자 */}
      <CollapsibleCard
        storageKey="recent-participants"
        title="최근 참가자"
        icon="👨‍👩‍👧"
      >
        <RecentParticipantsCard
          participants={snapshot.recentParticipants}
          thisWeekSubmissions={snapshot.thisWeekSubmissions}
          totalParticipants={snapshot.todayStats.participantsTotal}
          orgId={orgId}
        />
      </CollapsibleCard>

      {/* 핵심 카드: 관제실 배너 — 접기 불가 */}
      <ControlRoomBanner preview={snapshot.controlRoomPreview} orgId={orgId} />

      {/* 부가 카드 3: 자료실 */}
      <CollapsibleCard
        storageKey="resource-family"
        title="자료실"
        icon="📚"
      >
        <ResourceFamilyCard resources={snapshot.resources} orgId={orgId} />
      </CollapsibleCard>

      {/* 부가 카드 4: 토리FM */}
      <CollapsibleCard storageKey="tori-fm" title="토리FM" icon="📻">
        <ToriFmCard fm={snapshot.fm} orgId={orgId} />
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
