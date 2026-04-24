"use client";

import { useEffect, useMemo, useState } from "react";

interface Props {
  startedAt: string | null;
}

export function ScreenTimer({ startedAt }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const startedMs = useMemo(() => {
    if (!startedAt) return null;
    const t = new Date(startedAt).getTime();
    return Number.isNaN(t) ? null : t;
  }, [startedAt]);

  const elapsedSec = startedMs
    ? Math.max(0, Math.floor((now - startedMs) / 1000))
    : null;

  const clock = new Date(now).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <div className="flex items-center gap-6 font-mono text-[#C4956A]">
      <time
        suppressHydrationWarning
        className="text-base font-semibold tracking-wide md:text-lg"
      >
        🕐 {clock}
      </time>
      {elapsedSec != null && (
        <span
          suppressHydrationWarning
          className="text-base font-semibold tracking-wide tabular-nums md:text-lg"
        >
          ⏱ {formatHMS(elapsedSec)}
        </span>
      )}
    </div>
  );
}

function formatHMS(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(r)}`;
}
