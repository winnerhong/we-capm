"use client";

import { useEffect, useState } from "react";

interface Props {
  expiresAt: string;
  /** 남은 초 < 이 값 일 때 urgent 스타일 */
  urgentSec?: number;
  /** 만료 시 표기 */
  expiredLabel?: string;
  className?: string;
}

function formatRemaining(sec: number): string {
  if (sec <= 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * expires_at 기준 남은 시간을 1초마다 갱신해 보여준다.
 * 사용처: Coop WAITING, Broadcast 참여 화면.
 */
export function Countdown({
  expiresAt,
  urgentSec = 30,
  expiredLabel = "시간이 다 됐어요",
  className,
}: Props) {
  const target = new Date(expiresAt).getTime();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remainSec = Math.max(0, Math.floor((target - now) / 1000));
  const isExpired = remainSec <= 0;
  const isUrgent = !isExpired && remainSec < urgentSec;

  const base =
    "inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold tabular-nums";
  const tone = isExpired
    ? "bg-zinc-100 text-zinc-500"
    : isUrgent
      ? "animate-pulse bg-rose-100 text-rose-700"
      : "bg-[#E8F0E4] text-[#2D5A3D]";

  return (
    <span
      className={`${base} ${tone} ${className ?? ""}`}
      aria-live={isUrgent ? "assertive" : "polite"}
    >
      <span aria-hidden>⏱</span>
      <span>{isExpired ? expiredLabel : formatRemaining(remainSec)}</span>
    </span>
  );
}
