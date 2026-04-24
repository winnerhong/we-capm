"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  trailName: string;
  stopName: string;
  score: number;
  slug: string | null;
  className?: string;
};

export function DoneActions({
  trailName,
  stopName,
  score,
  slug,
  className = "",
}: Props) {
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    const shareText = `🌲 ${trailName}에서 "${stopName}" 미션 완료! (+${score}점)`;
    const shareUrl = slug
      ? `${window.location.origin}/trail/${slug}`
      : window.location.origin;

    if (
      typeof navigator !== "undefined" &&
      "share" in navigator &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({
          title: trailName,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        /* 취소 시 fallback */
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      <button
        type="button"
        onClick={onShare}
        className="h-12 rounded-xl bg-white border-2 border-[#2D5A3D] text-[#2D5A3D] font-bold"
      >
        {copied ? "✅ 복사됨" : "🔗 공유하기"}
      </button>
      <Link
        href={slug ? `/trail/${slug}` : "/"}
        className="h-12 rounded-xl bg-[#2D5A3D] text-white font-bold text-center leading-[3rem]"
      >
        🏠 숲길로
      </Link>
    </div>
  );
}
