"use client";

// 기관 단위 "참가자 로그인 링크" — /user-login?org=<orgId>.
//
// 예전엔 이 카드가 **행사 카드마다** 들어가 있었다. 링크는 기관 하나에 하나뿐인데
// 행사가 10개면 같은 링크가 10번 나오는 셈이라, 화면 절반이 같은 말이었다.
// 지금은 목록 **아래**에 한 번만, 작게 둔다.
//
// 왜 아래이고 왜 작은가: 여기는 초대장 화면이다. 초대장과 이 링크가 같은 크기로
// 나란히 있으면 "행사 초대장을 보내려는데 어느 링크지" 로 헷갈린다. 성격도
// 다르다 — 초대장은 행사마다 하나씩, 이건 기관에 하나뿐이고 행사와 무관하다.
//
// 초대장과 달리 발행 토글이 없고 항상 활성이다. 로그인 페이지가 이 기관의 LIVE
// 행사만 노출하므로 다른 기관 행사는 새지 않는다.

import { InvitationQrButton } from "@/components/invitation-qr-button";
import { ShareLinkRow } from "@/components/share/share-link-row";
import { useAbsoluteUrl } from "@/lib/use-origin";

type Props = {
  orgId: string;
  orgName: string;
};

export function ParticipantLoginShare({ orgId, orgName }: Props) {
  const url = useAbsoluteUrl(`/user-login?org=${orgId}`);

  function onShare() {
    if (!navigator.share) return;
    navigator
      .share({
        title: `${orgName} — 참가자 로그인`,
        text: `${orgName} 행사에 참여하시려면 로그인해 주세요 📲`,
        url,
      })
      .catch(() => {});
  }

  return (
    <section className="border-t border-dashed border-[#E8DDC8] pt-5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 className="text-xs font-bold text-[#8B7F75]">
          <span aria-hidden className="mr-1">
            🔑
          </span>
          참가자 로그인 링크
        </h2>
        <span className="text-[11px] text-[#A89D94]">
          행사와 무관한 <b className="font-semibold">기관 공통</b> 링크 · 진행
          중인 행사만 보여요
        </span>
      </div>

      <ShareLinkRow
        url={url}
        onShare={onShare}
        variant="muted"
        qr={
          <InvitationQrButton
            url={url}
            eventName={`${orgName}_참가자로그인`}
            compact
          />
        }
        className="mt-2"
      />
    </section>
  );
}
