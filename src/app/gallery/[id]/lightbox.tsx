"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

export interface GalleryPhoto {
  id: string;
  photo_url: string;
  caption: string | null;
  slot_name: string;
  slot_icon: string | null;
  created_at: string;
}

interface Props {
  photos: GalleryPhoto[];
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function Lightbox({ photos }: Props) {
  const params = useSearchParams();
  const initialId = params.get("photo");

  const [activeId, setActiveId] = useState<string | null>(initialId);

  // initial sync — if ?photo= param exists and points to valid photo
  useEffect(() => {
    if (initialId && photos.some((p) => p.id === initialId)) {
      setActiveId(initialId);
    }
  }, [initialId, photos]);

  const activeIdx = useMemo(
    () => photos.findIndex((p) => p.id === activeId),
    [photos, activeId]
  );
  const active = activeIdx >= 0 ? photos[activeIdx] : null;

  const updateUrl = (photoId: string | null) => {
    const next = new URLSearchParams(Array.from(params.entries()));
    if (photoId) next.set("photo", photoId);
    else next.delete("photo");
    const qs = next.toString();
    const url = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;
    window.history.replaceState(null, "", url);
  };

  const open = (id: string) => {
    setActiveId(id);
    updateUrl(id);
  };
  const close = () => {
    setActiveId(null);
    updateUrl(null);
  };
  const prev = () => {
    if (activeIdx <= 0) return;
    const id = photos[activeIdx - 1].id;
    setActiveId(id);
    updateUrl(id);
  };
  const next = () => {
    if (activeIdx < 0 || activeIdx >= photos.length - 1) return;
    const id = photos[activeIdx + 1].id;
    setActiveId(id);
    updateUrl(id);
  };

  // 키보드 제어
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, activeIdx, photos.length]);

  // 터치 스와이프
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    touchStart.current = null;
    // 수평 스와이프 (수직 움직임이 작을 때만)
    if (Math.abs(dx) > 50 && Math.abs(dy) < 80) {
      if (dx > 0) prev();
      else next();
    }
  };

  return (
    <>
      {/* Masonry-like grid (CSS columns) */}
      <div className="columns-2 gap-2 md:columns-3 md:gap-3 lg:columns-4">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => open(photo.id)}
            className="group mb-2 block w-full overflow-hidden rounded-xl bg-neutral-200 md:mb-3 focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label={`${photo.slot_name} 사진 자세히 보기`}
          >
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.photo_url}
                alt={photo.caption || photo.slot_name}
                loading="lazy"
                className="w-full transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-2 py-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="truncate text-[10px] font-semibold text-white">
                  <span aria-hidden="true">{photo.slot_icon || "🏞️"}</span>{" "}
                  {photo.slot_name}
                </div>
                {photo.caption && (
                  <div className="truncate text-[10px] text-white/90">
                    {photo.caption}
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-0 sm:p-4"
          onClick={close}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          role="dialog"
          aria-modal="true"
          aria-label={`${active.slot_name} 사진 상세 보기`}
        >
          {/* Close */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white backdrop-blur hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white/60"
            aria-label="닫기"
          >
            ✕
          </button>

          {/* Prev */}
          {activeIdx > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/60 p-3 text-xl text-white backdrop-blur hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white/60 sm:block"
              aria-label="이전 사진"
            >
              ‹
            </button>
          )}
          {/* Next */}
          {activeIdx < photos.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/60 p-3 text-xl text-white backdrop-blur hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white/60 sm:block"
              aria-label="다음 사진"
            >
              ›
            </button>
          )}

          <div
            className="relative w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.photo_url}
              alt={active.caption || active.slot_name}
              className="max-h-[75vh] w-full object-contain"
            />
            <div className="bg-[#FEFCF8] p-4 sm:rounded-b-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
                  <span aria-hidden="true">{active.slot_icon || "🏞️"}</span>
                  {active.slot_name}
                </div>
                <div className="text-[11px] text-[#6B6560]">
                  {activeIdx + 1} / {photos.length}
                </div>
              </div>
              {active.caption && (
                <p className="mt-1.5 text-sm text-[#2C2C2C]">{active.caption}</p>
              )}
              <p className="mt-1 text-[11px] text-[#6B6560]">
                {fmtDate(active.created_at)}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
