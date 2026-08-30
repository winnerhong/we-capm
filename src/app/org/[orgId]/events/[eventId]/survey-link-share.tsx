"use client";

// 설문 링크 공유 — 초대장과 같은 부품(ShareLinkRow)을 그대로 쓴다.
// 링크를 보내는 일은 초대장이든 설문이든 같은 동작이라, 화면도 같아야 다시 배울
// 게 없다.

import { InvitationQrButton } from "@/components/invitation-qr-button";
import { ShareLinkRow } from "@/components/share/share-link-row";
import { useAbsoluteUrl } from "@/lib/use-origin";

export function SurveyLinkShare({ eventId }: { eventId: string }) {
  const url = useAbsoluteUrl(`/e/${eventId}/survey`);

  function onShare() {
    if (!navigator.share) return;
    navigator
      .share({
        title: "행사 어떠셨나요?",
        text: "짧은 설문에 답해 주세요 (30초)",
        url,
      })
      .catch(() => {});
  }

  return (
    <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h3 className="text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden className="mr-1.5">
            🔗
          </span>
          설문 링크
        </h3>
        <span className="text-[11px] text-[#8B7F75]">
          단톡방에 보내면 바로 답할 수 있어요
        </span>
      </div>
      <ShareLinkRow
        url={url}
        onShare={onShare}
        qr={<InvitationQrButton url={url} eventName="행사설문" compact />}
        className="mt-2"
      />
    </section>
  );
}
