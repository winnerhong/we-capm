"use client";

// 행사 상세 개요의 「초대장」 카드.
//
// 예전엔 한 카드가 여섯 줄이었다: 제목 + 발행 배지 + 설명문 + 발행 버튼 +
// URL 전체가 든 입력칸 + 복사 버튼 + 아래 버튼 세 개. 링크 텍스트가 화면을
// 가로로 다 먹고, 설명문("참가자가 받은 링크를 클릭 → 로그인 → …")은 한 번
// 읽으면 그만인 문장인데 매번 자리를 지켰다.
//
// 링크는 **읽으라고 있는 게 아니라 복사하라고 있다.** 그래서 /invitations 목록이
// 쓰던 ShareLinkRow 를 여기서도 쓴다 — 앞부분만 보이고, 누르면 바로 복사된다.
// 같은 일을 하는 화면이 둘인데 생김새가 다르면 그 자체가 배울 거리가 된다.
//
// ⚠ /invitations 쪽에도 같은 이름의 컴포넌트가 있다. 합치지 않은 이유는 동적
//   라우트 대괄호가 든 경로를 다른 라우트에서 상대 import 하면 Turbopack 이
//   멈추기 때문이다(그쪽 파일 머리 주석 참고). 생김새만 맞춰 둔다.

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
      .catch(() => {
        /* 사용자 취소 무시 */
      });
  }

  function onTogglePublish() {
    if (isPending) return;
    setError(null);
    const next = !isPublished;
    // 되돌릴 수 있는 조작이지만 참가자에게 보이고 안 보이고가 갈리므로 한 번 묻는다.
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

  return (
    <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>📨</span>
          <span>초대장</span>
          {isPublished ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              발행됨
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              초안
            </span>
          )}
        </h3>

        {/* 발행 전에는 할 일이 하나뿐이라 눈에 띄는 버튼으로, 발행 뒤에는
            되돌리기라서 조용한 글자 링크로. 같은 자리에 두되 무게를 바꾼다. */}
        {isPublished ? (
          <button
            type="button"
            onClick={onTogglePublish}
            disabled={isPending}
            className="shrink-0 text-[11px] font-semibold text-[#8B7F75] underline-offset-2 transition hover:text-rose-700 hover:underline disabled:opacity-50"
          >
            {isPending ? "처리 중…" : "발행 취소"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onTogglePublish}
            disabled={isPending}
            className="shrink-0 rounded-xl bg-[#2D5A3D] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#3A7A52] disabled:opacity-50"
          >
            {isPending ? "처리 중…" : "🚀 발행"}
          </button>
        )}
      </div>

      {isPublished ? (
        <ShareLinkRow
          className="mt-3"
          url={url}
          onShare={onShare}
          qr={<InvitationQrButton url={url} eventName={eventName} />}
        />
      ) : (
        <p className="mt-2 text-[11px] text-[#8B7F75]">
          발행해야 참가자에게 보여요. 그전엔 링크를 눌러도 &quot;준비 중&quot;
          안내만 나옵니다.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
        >
          ⚠️ {error}
        </p>
      )}
    </section>
  );
}
