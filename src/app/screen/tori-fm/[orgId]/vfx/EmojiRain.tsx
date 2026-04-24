"use client";

import { useEffect, useRef } from "react";

export type EmojiRainEvent = {
  id: string;
  emoji: string;
  /** viewport 비율 0~1, 미지정 시 랜덤 */
  startX?: number;
};

interface Props {
  events: EmojiRainEvent[];
  max?: number;
}

/**
 * 화면 상단에서 떨어지는 이모지 비.
 *  - 랜덤 x 위치, 3~5초 duration, sway + rotate
 *  - DOM manipulation 패턴 (FloatingHearts 참고)
 */
export function EmojiRain({ events, max = 100 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const activeCountRef = useRef(0);

  useEffect(() => {
    for (const ev of events) {
      if (seenIdsRef.current.has(ev.id)) continue;
      seenIdsRef.current.add(ev.id);
      spawnEmoji(ev);
    }
    if (seenIdsRef.current.size > 1000) {
      seenIdsRef.current = new Set(Array.from(seenIdsRef.current).slice(-500));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  function spawnEmoji(ev: EmojiRainEvent) {
    const container = containerRef.current;
    if (!container) return;
    if (activeCountRef.current >= max) return;

    const size = 24 + Math.random() * 24; // 24~48
    const startX = ev.startX ?? Math.random();
    const sway = (Math.random() - 0.5) * 120; // ±60px
    const rotMid = (Math.random() - 0.5) * 180;
    const rotEnd = (Math.random() - 0.5) * 360;
    const rotFinal = (Math.random() - 0.5) * 720;
    const duration = 3000 + Math.random() * 2000; // 3~5s

    const el = document.createElement("span");
    el.className = "vfx-emoji-rain";
    el.textContent = ev.emoji;
    el.style.fontSize = `${size}px`;
    el.style.left = `${startX * 100}%`;
    el.style.setProperty("--sway", `${sway}px`);
    el.style.setProperty("--rot-mid", `${rotMid}deg`);
    el.style.setProperty("--rot-end", `${rotEnd}deg`);
    el.style.setProperty("--rot-final", `${rotFinal}deg`);
    el.style.setProperty("--duration", `${duration}ms`);
    el.style.filter = "drop-shadow(0 2px 4px rgba(0,0,0,0.4))";

    container.appendChild(el);
    activeCountRef.current += 1;

    const cleanup = () => {
      el.remove();
      activeCountRef.current = Math.max(0, activeCountRef.current - 1);
    };
    el.addEventListener("animationend", cleanup, { once: true });
    setTimeout(cleanup, duration + 500);
  }

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
    />
  );
}
