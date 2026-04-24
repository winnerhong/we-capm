"use client";

import { useEffect, useState } from "react";
import styles from "../control-room.module.css";

function formatHMS(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function ServerClock({ serverNowIso }: { serverNowIso: string }) {
  // 서버시각과 클라이언트 시각의 delta 를 한번 구해두고, 이후 1초마다 tick.
  const [now, setNow] = useState<Date>(() => new Date(serverNowIso));

  useEffect(() => {
    const base = new Date(serverNowIso).getTime();
    const clientBase = Date.now();
    const tick = () => setNow(new Date(base + (Date.now() - clientBase)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [serverNowIso]);

  return (
    <div className="flex flex-col items-end leading-none">
      <span className="text-[10px] tracking-[0.15em] text-[#7FA892]">
        서버 시각
      </span>
      <span
        className={`${styles.neonCyan} font-mono text-2xl font-bold`}
        suppressHydrationWarning
      >
        {formatHMS(now)}
      </span>
    </div>
  );
}
