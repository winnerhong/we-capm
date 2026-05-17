"use client";

// 포토월 + 짝꿍 세션 가로 반반 row.
// 짝꿍 세션의 자연 height 를 ResizeObserver 로 측정해서 포토월 wrapper 에 동일하게 적용.
// → 포토월은 짝꿍 "다음" 페이지네이션까지의 높이 안에서 내부 스크롤로 동작.

import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  isTvMode: boolean;
  photoWall: ReactNode;
  coopSessions: ReactNode;
}

export function PhotoCoopRow({ isTvMode, photoWall, coopSessions }: Props) {
  const coopRef = useRef<HTMLDivElement | null>(null);
  const [coopHeight, setCoopHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (isTvMode || !coopRef.current) return;
    const el = coopRef.current;
    const obs = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (h && h > 0) setCoopHeight(h);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [isTvMode]);

  // TV 모드는 동기화 없이 자연 stack (lg+ 와 동일 동작 유지).
  if (isTvMode) {
    return (
      <div className="grid grid-cols-1 items-start gap-[1.25em] md:grid-cols-2">
        <div>{photoWall}</div>
        <div>{coopSessions}</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
      {/* 포토월 — 짝꿍 측정 height 에 cap, 내부 wrapper flex-1 scroll. */}
      <div
        className="overflow-hidden"
        style={coopHeight ? { height: coopHeight } : undefined}
      >
        {photoWall}
      </div>
      {/* 짝꿍 — 자연 height, ref 로 측정. */}
      <div ref={coopRef}>{coopSessions}</div>
    </div>
  );
}
