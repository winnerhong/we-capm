// NOTE: Supabase Storage bucket `stamp-photos` should be created manually in the dashboard.
// 지금은 기존 `chat-files` bucket 을 사용합니다.
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState, useTransition, useEffect } from "react";
import { deleteStampPhotoAction } from "../stamps/photo-actions";

interface Photo {
  id: string;
  slot_id: string;
  slot_name: string;
  slot_icon: string | null;
  photo_url: string;
  caption: string | null;
  created_at: string;
}

interface Props {
  eventId: string;
  photos: Photo[];
  filterOptions: Array<{ id: string; name: string; icon: string | null }>;
}

export function AlbumGallery({ eventId, photos, filterOptions }: Props) {
  const params = useSearchParams();
  const router = useRouter();
  const initialPhotoId = params.get("photo");

  const [filter, setFilter] = useState<string | "all">("all");
  const [activePhotoId, setActivePhotoId] = useState<string | null>(initialPhotoId);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () => (filter === "all" ? photos : photos.filter((p) => p.slot_id === filter)),
    [photos, filter]
  );

  const activePhoto = useMemo(
    () => photos.find((p) => p.id === activePhotoId) ?? null,
    [photos, activePhotoId]
  );

  // ESC로 모달 닫기
  useEffect(() => {
    if (!activePhoto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActivePhotoId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activePhoto]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const onDelete = (albumId: string) => {
    if (!confirm("이 사진을 삭제할까요?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteStampPhotoAction(eventId, albumId);
        setActivePhotoId(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "삭제 실패");
      }
    });
  };

  return (
    <>
      {/* Filter chips */}
      {filterOptions.length > 1 && (
        <div
          className="mb-3 flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="장소 필터"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            onClick={() => setFilter("all")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === "all"
                ? "bg-violet-600 text-white"
                : "border border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#E8F0E4]"
            }`}
          >
            전체 ({photos.length})
          </button>
          {filterOptions.map((opt) => {
            const count = photos.filter((p) => p.slot_id === opt.id).length;
            const active = filter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(opt.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-violet-600 text-white"
                    : "border border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#E8F0E4]"
                }`}
              >
                <span aria-hidden="true">{opt.icon || "🏞️"}</span> {opt.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Masonry-ish grid (2 cols on mobile, 3 on md) */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {visible.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setActivePhotoId(photo.id)}
            className="group relative block aspect-square overflow-hidden rounded-xl bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label={`${photo.slot_name} 사진 자세히 보기`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.photo_url}
              alt={photo.caption || photo.slot_name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-2 py-1.5">
              <div className="truncate text-[10px] font-semibold text-white">
                <span aria-hidden="true">{photo.slot_icon || "🏞️"}</span> {photo.slot_name}
              </div>
              {photo.caption && (
                <div className="truncate text-[10px] text-white/90">{photo.caption}</div>
              )}
            </div>
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="py-8 text-center text-xs text-[#6B6560]">
          이 장소에는 아직 사진이 없어요
        </p>
      )}

      {/* Lightbox modal */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-0 sm:p-4"
          onClick={() => setActivePhotoId(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${activePhoto.slot_name} 사진`}
        >
          <div
            className="relative w-full max-w-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActivePhotoId(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white backdrop-blur hover:bg-black/80"
              aria-label="닫기"
            >
              ✕
            </button>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activePhoto.photo_url}
              alt={activePhoto.caption || activePhoto.slot_name}
              className="max-h-[70vh] w-full object-contain"
            />

            <div className="bg-[#FEFCF8] p-4 sm:rounded-b-2xl">
              <div className="flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
                <span aria-hidden="true">{activePhoto.slot_icon || "🏞️"}</span>
                {activePhoto.slot_name}
              </div>
              {activePhoto.caption && (
                <p className="mt-1 text-sm text-[#2C2C2C]">{activePhoto.caption}</p>
              )}
              <p className="mt-1 text-[11px] text-[#6B6560]">{fmtDate(activePhoto.created_at)}</p>

              {error && (
                <p className="mt-2 text-xs font-semibold text-red-600" role="alert">
                  {error}
                </p>
              )}

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => onDelete(activePhoto.id)}
                  disabled={pending}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  {pending ? "삭제 중…" : "🗑️ 삭제"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
