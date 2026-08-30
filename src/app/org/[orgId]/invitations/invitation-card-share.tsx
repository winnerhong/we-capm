"use client";

// /invitations 목록의 행사별 초대장 줄.
//
// 동일 이름 컴포넌트가 events/[eventId] 에도 있지만 동적 라우트 대괄호가 들어간
// 경로를 다른 라우트에서 상대 import 하면 Turbopack 컴파일이 멈추는 이슈가 있어
// 분리돼 있다.
//
// 이 화면 전용으로 **틀을 벗겼다**: 예전엔 자체 테두리 + 그라데이션 + "초대장
// 공유" 제목 + 설명문을 갖고 있었는데, 감싸는 행사 카드가 이미 테두리와 행사
// 이름을 보여주고 있어 상자가 상자 안에 든 꼴이었다. 제목·설명은 목록 머리에서
// 한 번만 말한다.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setInvitationPublishedAction } from "@/lib/org-events/actions";
import { InvitationQrButton } from "@/components/invitation-qr-button";
import { ShareLinkRow } from "@/components/share/share-link-row";
import { useAbsoluteUrl } from "@/lib/use-origin";

type Props = {
  eventId: string;
  eventName: string;
  publishedAt: string | null;
};

export function InvitationCardShare({
  eventId,
  eventName,
  publishedAt,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const url = useAbsoluteUrl(`/invitation/${eventId}`);
  const isPublished = !!publishedAt;

  function onShare() {
    if (!isPublished || !navigator.share) return;
    navigator
      .share({
        title: `${eventName} — 초대장`,
        text: `${eventName} 행사에 초대합니다 💌`,
        url,
      })
      .catch(() => {});
  }

  function onTogglePublish() {
    if (isPending) return;
    setError(null);
    const next = !isPublished;
    const ok = window.confirm(
      next
        ? "초대장을 발행할까요?\n\n링크를 받은 참가자가 로그인 후 본인 이름이 들어간 초대장을 볼 수 있어요. 이후 인사말·장소·준비물을 수정해도 자동으로 반영됩니다."
        : '초대장 발행을 취소할까요?\n\n취소 후엔 링크를 눌러도 "준비 중" 안내만 보여요.'
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        await setInvitationPublishedAction(eventId, next);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "처리 실패");
      }
    });
  }

  // 발행 전 — 링크는 아직 의미가 없다. 할 일 하나만 남긴다.
  if (!isPublished) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] leading-relaxed text-[#6B6560]">
            발행하면 참가자에게 보여요. 그전엔 링크를 눌러도 &quot;준비 중&quot;
            안내만 나옵니다.
          </p>
          <button
            type="button"
            onClick={onTogglePublish}
            disabled={isPending}
            className="shrink-0 rounded-xl bg-[#2D5A3D] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#3A7A52] disabled:opacity-50"
          >
            {isPending ? "처리 중…" : "🚀 초대장 발행"}
          </button>
        </div>
        {error && <ErrorLine text={error} />}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ShareLinkRow
        url={url}
        onShare={onShare}
        qr={<InvitationQrButton url={url} eventName={eventName} />}
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onTogglePublish}
          disabled={isPending}
          className="text-[11px] font-semibold text-[#8B7F75] underline-offset-2 transition hover:text-rose-700 hover:underline disabled:opacity-50"
        >
          {isPending ? "처리 중…" : "발행 취소"}
        </button>
      </div>
      {error && <ErrorLine text={error} />}
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
    >
      ⚠️ {text}
    </p>
  );
}
