"use client";

import { useEffect, useRef, useState } from "react";

export type BannerEvent = {
  id: string;
  title: string;
  subtitle?: string;
  caption?: string;
  durationMs?: number;
};

interface Props {
  events: BannerEvent[];
}

/**
 * 상단 중앙 신청곡 배너.
 *  - 이벤트가 큐에 쌓이고, 한 번에 하나씩만 렌더
 *  - 진입: slide-down 400ms / 유지 3000ms / 종료: slide-up 400ms (총 3800ms)
 *  - 황동 그라디언트 + 빛나는 효과
 */
export function TopBanner({ events }: Props) {
  const seenIdsRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<BannerEvent[]>([]);
  const playingRef = useRef(false);
  const [current, setCurrent] = useState<BannerEvent | null>(null);

  useEffect(() => {
    for (const ev of events) {
      if (seenIdsRef.current.has(ev.id)) continue;
      seenIdsRef.current.add(ev.id);
      queueRef.current.push(ev);
    }
    if (seenIdsRef.current.size > 300) {
      seenIdsRef.current = new Set(Array.from(seenIdsRef.current).slice(-150));
    }
    tryPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  function tryPlay() {
    if (playingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    playingRef.current = true;
    setCurrent(next);
    const duration = next.durationMs ?? 3800;
    setTimeout(() => {
      playingRef.current = false;
      setCurrent(null);
      // 다음 프레임에 큐 소비
      setTimeout(() => tryPlay(), 50);
    }, duration);
  }

  if (!current) {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
      />
    );
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
    >
      <div
        key={current.id}
        className="vfx-banner mx-auto mt-6 w-[92%] max-w-3xl rounded-2xl border border-[#E5B88A]/60 bg-gradient-to-r from-[#C4956A] via-[#E5B88A] to-[#C4956A] px-5 py-4 text-center shadow-[0_0_40px_rgba(229,184,138,0.45)] md:mt-10 md:px-8 md:py-6"
      >
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#2a1f15]/80 md:text-sm">
          {current.title}
        </div>
        {current.subtitle && (
          <div className="mt-1 line-clamp-2 text-xl font-extrabold text-[#1a120a] drop-shadow md:mt-2 md:text-3xl">
            {current.subtitle}
          </div>
        )}
        {current.caption && (
          <div className="mt-1 text-xs italic text-[#3a2f27] md:mt-2 md:text-base">
            {current.caption}
          </div>
        )}
      </div>
    </div>
  );
}
