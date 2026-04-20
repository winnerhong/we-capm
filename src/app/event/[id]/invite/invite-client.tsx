"use client";

import { useEffect, useState, useTransition } from "react";
import { createReferralCodeAction } from "./actions";

interface InviteClientProps {
  eventId: string;
  initialCode: string | null;
}

export function InviteClient({ eventId, initialCode }: InviteClientProps) {
  const [code, setCode] = useState<string | null>(initialCode);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingCode, startLoadCode] = useTransition();

  // Bootstrap code on mount if we don't have one
  useEffect(() => {
    if (code) return;
    startLoadCode(async () => {
      try {
        const result = await createReferralCodeAction(eventId);
        if (result?.referral_code) setCode(result.referral_code);
      } catch (e) {
        setError(e instanceof Error ? e.message : "초대 코드 생성 실패");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Build share URL once code is known
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://toriro.com";
  const inviteUrl = code ? `${origin}/invite/${code}` : "";
  const displayUrl = code ? `toriro.com/invite/${code}` : "불러오는 중...";

  const shareText = "토리로에서 재미있는 이벤트에 초대합니다! 가입하면 🌰 도토리 20개 선물!";

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select-and-copy prompt
      window.prompt("아래 링크를 복사하세요", inviteUrl);
    }
  };

  const handleShare = async () => {
    if (!inviteUrl) return;
    const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : null;
    if (nav?.share) {
      try {
        await nav.share({
          title: "토리로 초대",
          text: shareText,
          url: inviteUrl,
        });
      } catch {
        // User cancelled — no-op
      }
    } else {
      handleCopy();
    }
  };

  return (
    <section aria-labelledby="invite-link-title">
      <h2 id="invite-link-title" className="mb-2 text-sm font-bold text-[#2D5A3D]">
        🔗 내 초대 링크
      </h2>
      <div className="rounded-2xl border-2 border-[#C4956A] bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] p-4 shadow-sm">
        {/* Big link display */}
        <div
          className="rounded-xl bg-white/80 border border-[#C4956A]/30 px-4 py-4 text-center break-all font-mono text-base font-bold text-[#2D5A3D]"
          aria-live="polite"
        >
          {displayUrl}
        </div>

        {error && (
          <p className="mt-2 text-center text-xs text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!code || loadingCode}
            className="flex-1 rounded-2xl bg-[#C4956A] py-4 text-base font-bold text-white shadow-sm hover:bg-[#A87A50] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#C4956A] focus:ring-offset-2 transition-colors"
            aria-label="초대 링크 복사"
          >
            {copied ? "✅ 복사됨!" : "📋 링크 복사"}
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={!code || loadingCode}
            className="flex-1 rounded-2xl bg-violet-600 py-4 text-base font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 transition-colors"
            aria-label="친구에게 공유하기"
          >
            📤 공유하기
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] text-[#6B6560]">
          친구가 가입 후 첫 미션을 완료하면 🌰 20개가 지급돼요
        </p>
      </div>
    </section>
  );
}
