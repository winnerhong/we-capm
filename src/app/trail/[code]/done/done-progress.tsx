"use client";

import { useEffect, useState } from "react";

type Props = {
  trailId: string;
  totalStops: number;
  className?: string;
};

export function DoneProgress({ trailId, totalStops, className = "" }: Props) {
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

  const pct =
    totalStops > 0 ? Math.min(100, Math.round((cleared.length / totalStops) * 100)) : 0;

  return (
    <div className={`rounded-2xl bg-white shadow p-4 ${className}`}>
      <div className="flex items-center justify-between text-xs font-semibold text-[#2D5A3D] mb-1">
        <span>🌲 숲길 진행률</span>
        <span>
          {cleared.length} / {totalStops || "?"} · {pct}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-[#E8F0E4] overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#4A7C59] to-[#2D5A3D] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
