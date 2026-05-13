"use client";

// 클릭 시 사진을 확대해 보여주는 모달 — 배경 어둡게, ESC/바깥 클릭으로 닫힘.
// items 가 여러 장이면 ← → 화살표(키보드 좌우키 포함) 로 탐색.

import { useCallback, useEffect, useMemo, useState } from "react";

export type LightboxItem = {
  url: string;
  caption?: string;
  subCaption?: string;
};

type Props = {
  items: LightboxItem[];
  /** 최초 열 때 어떤 인덱스로 시작할지. */
  startIndex: number;
  /** 모달 닫기 콜백. null 로 들어오면 닫힘 상태. */
  onClose: () => void;
};

export function PhotoLightbox({ items, startIndex, onClose }: Props) {
  const [idx, setIdx] = useState(startIndex);

  useEffect(() => {
    setIdx(startIndex);
  }, [startIndex]);

  const total = items.length;
  const current = items[idx] ?? null;

  const next = useCallback(() => {
    if (total === 0) return;
    setIdx((i) => (i + 1) % total);
  }, [total]);
  const prev = useCallback(() => {
    if (total === 0) return;
    setIdx((i) => (i - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    document.addEventListener("keydown", onKey);
    // 페이지 스크롤 lock
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [next, prev, onClose]);

  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="사진 확대 보기"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      {/* 상단 메타·닫기 */}
      <div
        className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          {current.caption && (
            <p className="truncate text-sm font-bold">{current.caption}</p>
          )}
          {current.subCaption && (
            <p className="truncate text-[11px] text-white/70">
              {current.subCaption}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {total > 1 && (
            <span className="font-mono text-xs tabular-nums text-white/80">
              {idx + 1} / {total}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-white transition hover:bg-white/20"
          >
            ✕ 닫기
          </button>
        </div>
      </div>

      {/* 이미지 — 클릭 시 모달 닫기 (외부 onClick 그대로 버블링) */}
      <div className="flex max-h-[85vh] max-w-[95vw] items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={current.caption ?? "사진"}
          onClick={onClose}
          className="max-h-[85vh] max-w-[95vw] cursor-zoom-out rounded-lg object-contain shadow-2xl"
        />
      </div>

      {/* 좌우 화살표 — 2장 이상일 때만 */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label="이전 사진"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-3 text-2xl text-white transition hover:bg-white/20 sm:left-6"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label="다음 사진"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-3 text-2xl text-white transition hover:bg-white/20 sm:right-6"
          >
            ›
          </button>
        </>
      )}

      {/* 힌트 */}
      <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-white/50">
        사진/바깥 클릭 · ESC = 닫기{total > 1 ? " · ← → 키 = 이전/다음" : ""}
      </p>
    </div>
  );
}

/**
 * 편의 훅 — 컴포넌트에서 한 줄로 lightbox 상태 + open 함수 + Element 받기.
 * 사용 예:
 *   const { openAt, lightbox } = useLightbox(items);
 *   <img onClick={() => openAt(idx)} />
 *   {lightbox}
 */
export function useLightbox(items: LightboxItem[]) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const memoItems = useMemo(() => items, [items]);
  const openAt = useCallback((i: number) => setOpenIdx(i), []);
  const close = useCallback(() => setOpenIdx(null), []);
  const lightbox =
    openIdx !== null && memoItems.length > 0 ? (
      <PhotoLightbox items={memoItems} startIndex={openIdx} onClose={close} />
    ) : null;
  return { openAt, lightbox, isOpen: openIdx !== null };
}
