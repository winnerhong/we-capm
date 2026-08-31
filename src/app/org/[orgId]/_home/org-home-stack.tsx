import type { OrgHomeDashboard } from "@/lib/org-home/types";
import { isOnboarding } from "@/lib/org-home/onboarding";
import { HeroCard } from "./hero-card";
import { OnboardingCard } from "./onboarding-card";
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
//
// 홈은 두 얼굴을 갖는다 — **행사를 한 번이라도 열었나** 하나로 갈린다.
//
//   준비 모드: 세 걸음 → 모든 기능 → (비어 있는 카드들)
//   운영 모드: 지금까지의 홈. 프로필이 덜 찼으면 세 걸음 카드가 접을 수 있는
//             모습으로 아래쪽에 남는다.
//
// 준비 모드에서 관제실·토리FM·자료실을 **숨기지는 않는다.** 아직 쓸 게 없을
// 뿐이지 없는 기능이 아니고, 숨기면 "그런 게 있는 줄도 몰랐다" 가 다시 생긴다.
// 순서만 뒤로 민다.
export function OrgHomeStack({ snapshot, orgId }: Props) {
  const onboarding = isOnboarding(snapshot.eventCount);
  const profileDone = snapshot.profileCompleteness.percent >= 100;

  const steps = (
    <OnboardingCard
      orgId={orgId}
      groups={snapshot.profileCompleteness.groups}
      eventCount={snapshot.eventCount}
    />
  );

  const allTools = (
    <AllToolsCard orgId={orgId} />
  );

  const controlRoom = (
    <ControlRoomBanner preview={snapshot.controlRoomPreview} orgId={orgId} />
  );

  // 토리FM — 카드는 진작 만들어져 있었는데 여기 붙지 않아 홈에서 들어갈 길이
  // 없었다(행사 상세의 운영 도구를 거쳐야만 갈 수 있었다). 방송중이면 빨간 점.
  const fm = <ToriFmCard fm={snapshot.fm} orgId={orgId} />;

  const extras = (
    <>
      <CollapsibleCard storageKey="resource-family" title="자료실" icon="📚">
        <ResourceFamilyCard resources={snapshot.resources} orgId={orgId} />
      </CollapsibleCard>

      <CollapsibleCard storageKey="partner-new" title="파트너 신규" icon="🆕">
        <PartnerNewCard partnerNew={snapshot.partnerNew} orgId={orgId} />
      </CollapsibleCard>
    </>
  );

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-4 pb-24">
      <HeroCard dashboard={snapshot} orgId={orgId} />

      {onboarding ? (
        <>
          {/* 아직 행사가 없다. 지금 화면의 주인공은 "무엇부터 하나" 다.
              NextActionCard 를 여기서 빼도 잃는 게 없다 — 행사가 0 이면 그
              카드의 후보 넷 중 셋(검수 대기·초안 행사·서류 지연)은 애초에
              뜰 수가 없고, 남은 하나(참가자 0)는 ③ 첫 행사가 대신 말한다.
              서류 지연은 required=5 가 여기 ② 와 같은 다섯 종이라 겹친다. */}
          {steps}

          {/* 안내판을 바로 뒤에 둔다. 예전엔 다섯 번째였고, 그 앞 네 카드가
              새 기관이면 전부 0 이라 빈 카드가 안내판을 밀어내고 있었다. */}
          {allTools}

          {controlRoom}
          {fm}
          {extras}
        </>
      ) : (
        <>
          {/* 운영 중 — 지금까지의 홈 그대로. */}
          <NextActionCard action={snapshot.nextAction} orgId={orgId} />
          {controlRoom}
          {fm}

          {/* 서류 승인은 지사가 하는 일이라 며칠 걸린다. 행사를 치르는 동안에도
              남은 항목은 남은 것이라 계속 보이되, 접을 수 있게 둔다. */}
          {!profileDone && (
            <CollapsibleCard
              storageKey="onboarding"
              title="문 열기까지 세 걸음"
              icon="🌱"
            >
              {steps}
            </CollapsibleCard>
          )}

          <CollapsibleCard storageKey="all-tools" title="모든 기능" icon="🧭">
            {allTools}
          </CollapsibleCard>

          {extras}
        </>
      )}

      <FooterLinksCard documents={snapshot.documents} orgId={orgId} />
    </div>
  );
}
