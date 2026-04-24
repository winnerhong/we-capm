"use client";

import { useEffect, useState } from "react";

type Props = {
  expiresAt: string; // ISO
  onExpire?: () => void;
};

function computeRemaining(expiresAtIso: string): number {
  const end = new Date(expiresAtIso).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.floor((end - Date.now()) / 1000));
}

function formatMMSS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Live MM:SS 카운트다운 위젯.
 * 남은 시간 30초 이하일 때 빨갛게 강조.
 */
export function BroadcastCountdown({ expiresAt, onExpire }: Props) {
  const [remaining, setRemaining] = useState(() => computeRemaining(expiresAt));

  useEffect(() => {
    const timer = setInterval(() => {
      const next = computeRemaining(expiresAt);
      setRemaining(next);
      if (next <= 0) {
        clearInterval(timer);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpire]);

  const expired = remaining <= 0;
  const urgent = !expired && remaining <= 30;

  const cls = expired
    ? "bg-zinc-100 text-zinc-500 border-zinc-300"
    : urgent
      ? "bg-rose-100 text-rose-800 border-rose-300 animate-pulse"
      : "bg-amber-100 text-amber-900 border-amber-300";

  return (
    <span
      role="timer"
      aria-live="polite"
      aria-label={
        expired
          ? "종료됨"
          : `남은 시간 ${Math.floor(remaining / 60)}분 ${remaining % 60}초`
      }
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-sm font-bold ${cls}`}
    >
      <span aria-hidden>⏱</span>
      <span>{expired ? "종료" : formatMMSS(remaining)}</span>
    </span>
  );
}
