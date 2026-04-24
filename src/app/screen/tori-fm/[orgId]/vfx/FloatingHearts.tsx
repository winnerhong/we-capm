"use client";

import { useEffect, useRef, useState } from "react";

export type HeartEvent = {
  id: string;
  /** 하트 크기 px (24~56 권장) */
  size?: number;
  /** 왼쪽 오프셋 px (화면 중앙 기준 ± 랜덤) */
  offsetX?: number;
  /** 이모지 (❤ 기본) */
  emoji?: string;
};

interface Props {
  /** 외부에서 주입되는 하트 이벤트. 새 id 들어오면 spawn. */
  events: HeartEvent[];
  /** 동시 최대 파티클 수 (기본 80) */
  max?: number;
}

/**
 * 화면 하단 중앙에서 위로 떠오르는 하트 파티클.
 *  - 각 파티클: 1.8~2.8초 비행, sway + scale + fade
 *  - DOM manipulation으로 React state 충돌 최소화
 *  - will-change: transform 으로 GPU 가속
 */
export function FloatingHearts({ events, max = 80 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const activeCountRef = useRef(0);

  useEffect(() => {
    for (const ev of events) {
      if (seenIdsRef.current.has(ev.id)) continue;
      seenIdsRef.current.add(ev.id);
      spawnHeart(ev);
    }
    // 메모리 — 1000개 초과 시 앞에서 자름
    if (seenIdsRef.current.size > 1000) {
      seenIdsRef.current = new Set(
        Array.from(seenIdsRef.current).slice(-500)
      );
    }
  }, [events]);

  function spawnHeart(ev: HeartEvent) {
    const container = containerRef.current;
    if (!container) return;
    if (activeCountRef.current >= max) return;

    const size = ev.size ?? 24 + Math.random() * 32;
    const offsetX = ev.offsetX ?? (Math.random() - 0.5) * 400;
    const drift = (Math.random() - 0.5) * 160; // 상승 중 좌우 유동
    const duration = 1800 + Math.random() * 1200; // 1.8~3.0s
    const delay = Math.random() * 100;

    const el = document.createElement("span");
    el.className = "vfx-heart";
    el.textContent = ev.emoji ?? "❤";
    el.style.fontSize = `${size}px`;
    el.style.setProperty("--x-start", `${offsetX}px`);
    el.style.setProperty("--x-drift", `${drift}px`);
    el.style.setProperty("--duration", `${duration}ms`);
    el.style.setProperty("--delay", `${delay}ms`);
    // 빨강~분홍~주황 중 랜덤
    const hue = [340, 350, 0, 18, 32][Math.floor(Math.random() * 5)];
    el.style.color = `hsl(${hue}, 90%, ${55 + Math.random() * 10}%)`;
    el.style.filter = `drop-shadow(0 0 8px hsla(${hue}, 90%, 60%, 0.6))`;

    container.appendChild(el);
    activeCountRef.current += 1;

    const cleanup = () => {
      el.remove();
      activeCountRef.current = Math.max(0, activeCountRef.current - 1);
    };
    // animationend 로 제거
    el.addEventListener("animationend", cleanup, { once: true });
    // fallback 타이머
    setTimeout(cleanup, duration + delay + 300);
  }

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
    />
  );
}
