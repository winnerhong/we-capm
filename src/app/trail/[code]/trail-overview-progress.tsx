"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  trailId: string;
  totalStops: number;
  slug: string | null;
  className?: string;
};

// 숲길 전체 보기 페이지 — 진행률 + "완주 인증 받기" 버튼
export function TrailOverviewProgress({
  trailId,
  totalStops,
  slug,
  className = "",
}: Props) {
  const [cleared, setCleared] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`trail-progress-${trailId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { stops_cleared?: string[] };
        setCleared(parsed.stops_cleared ?? []);
      }
    } catch {
      /* ignore */
    }
  }, [trailId]);

  const allDone = totalStops > 0 && cleared.length >= totalStops;
  const pct =
    totalStops > 0 ? Math.min(100, Math.round((cleared.length / totalStops) * 100)) : 0;

  return (
    <div className={`rounded-2xl bg-white shadow p-4 ${className}`}>
      <div className="flex items-center justify-between text-sm font-bold text-[#2D5A3D] mb-2">
        <span>🥾 내 진행 상황</span>
        <span>
          {cleared.length} / {totalStops || "?"} · {pct}%
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-[#E8F0E4] overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#4A7C59] to-[#2D5A3D] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {allDone && slug && (
        <Link
          href={`/trail/${slug}/complete`}
          className="mt-3 block h-12 rounded-xl bg-[#FFD700] text-[#2D5A3D] font-extrabold text-center leading-[3rem] shadow hover:brightness-95"
        >
          🏆 완주 인증 받기
        </Link>
      )}
      {!allDone && totalStops > 0 && (
        <p className="mt-2 text-xs text-zinc-500 text-center">
          앞으로 {totalStops - cleared.length}개 지점 남았어요!
        </p>
      )}
    </div>
  );
}
