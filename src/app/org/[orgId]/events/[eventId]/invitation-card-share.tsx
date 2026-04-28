"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setInvitationPublishedAction } from "@/lib/org-events/actions";

type Props = {
  eventId: string;
  eventName: string;
  publishedAt: string | null;
};

/**
 * 행사 상세 페이지의 "📨 초대장 공유" 카드.
 * - 발행 / 발행취소 토글
 * - 링크 복사 / 공유
 * - 새 탭에서 미리보기
 */
export function InvitationCardShare({
  eventId,
  eventName,
  publishedAt,
}: Props) {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = origin
    ? `${origin}/invitation/${eventId}`
    : `/invitation/${eventId}`;
  const isPublished = !!publishedAt;

  function onCopy() {
    if (!isPublished) return;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        window.prompt("아래 링크를 복사하세요", url);
      });
  }

  function onShare() {
    if (!isPublished) return;
    if (!navigator.share) {
      onCopy();
      return;
    }
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
    if (next) {
      const ok = window.confirm(
        `초대장을 발행할까요?\n\n` +
          `발행하면 링크를 받은 참가자가 로그인 후 본인 이름이 들어간 초대장을 볼 수 있어요.\n` +
          `이후에 인사말·장소·준비물을 수정해도 자동으로 반영됩니다.`
      );
      if (!ok) return;
    } else {
      const ok = window.confirm(
        `초대장 발행을 취소할까요?\n\n` +
          `취소 후엔 링크 클릭해도 "준비 중" 안내만 보여요.`
      );
      if (!ok) return;
    }
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
    <section className="rounded-3xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/40 via-white to-[#FAE7D0]/30 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>📨</span>
            <span>초대장 공유</span>
            {isPublished ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                <span>발행됨</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                ⏸ 초안
              </span>
            )}
          </h3>
          <p className="mt-1 text-[11px] text-[#6B6560]">
            참가자가 받은 링크를 클릭 → 로그인 → 본인 이름이 들어간 초대장을
            받아요.
          </p>
        </div>
        <button
          type="button"
          onClick={onTogglePublish}
          disabled={isPending}
          className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold shadow-sm transition disabled:opacity-50 ${
            isPublished
              ? "border border-amber-300 bg-white text-amber-800 hover:bg-amber-50"
              : "bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] text-white hover:from-[#234a30] hover:to-[#2D5A3D]"
          }`}
        >
          {isPending
            ? "⏳"
            : isPublished
              ? "⏸ 발행 취소"
              : "🚀 초대장 발행"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
        >
          ⚠️ {error}
        </div>
      )}

      {isPublished && (
        <div className="mt-4 space-y-2">
          <div className="flex items-stretch gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-xs text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none"
            />
            <button
              type="button"
              onClick={onCopy}
              className="shrink-0 rounded-lg bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white hover:bg-[#234a30]"
            >
              {copied ? "✓ 복사됨" : "📋 복사"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onShare}
              className="inline-flex items-center gap-1.5 rounded-xl bg-yellow-400 px-3 py-2 text-xs font-bold text-yellow-900 shadow-sm hover:bg-yellow-500"
            >
              <span aria-hidden>💬</span>
              <span>카톡으로 공유</span>
            </button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] hover:bg-[#F5F1E8]"
            >
              <span aria-hidden>🔗</span>
              <span>새 탭에서 미리보기</span>
            </a>
          </div>
        </div>
      )}

      {!isPublished && (
        <p className="mt-4 rounded-xl border border-dashed border-[#E5D3B8] bg-[#FFFDF8] px-3 py-3 text-[11px] text-[#6B4423]">
          💡 초대장은 행사 편집 페이지에서 인사말·장소·준비물을 채운 뒤,
          위 <b>🚀 초대장 발행</b> 버튼을 눌러야 참가자에게 노출돼요. 발행 전엔
          링크 클릭해도 &quot;준비 중&quot; 안내만 보여 안전해요.
        </p>
      )}
    </section>
  );
}
