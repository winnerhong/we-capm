"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import { fmtClockKstAlways } from "@/lib/datetime/kst";
import { useLightbox, type LightboxItem } from "@/components/photo-lightbox";
import { deletePhotoFromWallAction } from "../actions";
import styles from "../control-room.module.css";

type Props = {
  items: ControlRoomSnapshot["photoWall"];
  isTvMode: boolean;
};

/**
 * 📸 사진 월 — 최근 제출된 사진을 갤러리로 표시.
 * - 행사 진행 중 운영자가 한눈에 "지금 어떤 사진들이 올라오고 있나" 볼 수 있게.
 * - 각 사진 hover/tap 시 미션·가족·시각 메타정보 노출.
 * - 사진 클릭 시 확대 모달.
 * - TV 모드: 더 큰 그리드.
 */
export function PhotoWallTile({ items, isTvMode }: Props) {
  const router = useRouter();
  const limit = isTvMode ? 18 : 12;
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // 미션별 필터 — null = 전체. 디폴트는 null (모든 사진).
  const [filterMissionId, setFilterMissionId] = useState<string | null>(null);

  // 미션 칩 — 사진이 있는 미션만, count desc 로 정렬.
  const missionChips = useMemo(() => {
    const map = new Map<
      string,
      { id: string; title: string; icon: string | null; count: number }
    >();
    for (const p of items) {
      const cur = map.get(p.missionId);
      if (cur) cur.count += 1;
      else {
        map.set(p.missionId, {
          id: p.missionId,
          title: p.missionTitle,
          icon: p.missionIcon,
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [items]);

  // 필터링: 미션 선택 시 그 미션 사진만, 아니면 전체.
  // 미션이 deselect 됐는데 filterMissionId 가 사진월에 더이상 없으면 자동 리셋.
  const filteredItems = useMemo(() => {
    if (!filterMissionId) return items;
    const exists = items.some((p) => p.missionId === filterMissionId);
    if (!exists) return items;
    return items.filter((p) => p.missionId === filterMissionId);
  }, [items, filterMissionId]);

  const list = filteredItems.slice(0, limit);

  const lightboxItems: LightboxItem[] = useMemo(
    () =>
      list.map((p) => ({
        url: p.url,
        caption: `${p.missionIcon ?? "📷"} ${p.missionTitle}`,
        subCaption: `${p.userDisplayName} · ${fmtClockKstAlways(p.submittedAt)}`,
      })),
    [list]
  );
  const { openAt, lightbox } = useLightbox(lightboxItems);

  function handleDelete(p: (typeof list)[number]) {
    if (
      !window.confirm(
        `이 사진을 사진 월에서 삭제할까요?\n\n` +
          `${p.missionTitle}\n${p.userDisplayName} · ${fmtClockKstAlways(p.submittedAt)}\n\n` +
          `삭제하면 관제실·결과 화면에 더 이상 노출되지 않아요. (도토리는 회수되지 않음)`
      )
    ) {
      return;
    }
    setDeletingId(p.submissionId);
    startTransition(async () => {
      const result = await deletePhotoFromWallAction(p.submissionId);
      setDeletingId(null);
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className={`${styles.surface} flex flex-col p-4`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base" aria-hidden>
          📸
        </span>
        <h2 className="text-xs font-semibold tracking-[0.15em] text-[#a8b8d0]">
          사진 월
        </h2>
        <span className="ml-auto font-mono text-xs text-[#a8b8d0]">
          {filterMissionId
            ? `${filteredItems.length} / ${items.length}`
            : items.length}
        </span>
      </div>

      {/* 미션별 필터 칩 — 사진이 있는 미션만, 활성 칩이 강조. 미션 1개 이하면 숨김. */}
      {missionChips.length > 1 && (
        <div
          role="tablist"
          aria-label="미션별 사진 필터"
          className="mb-3 flex flex-wrap gap-1.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filterMissionId === null}
            onClick={() => setFilterMissionId(null)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${
              filterMissionId === null
                ? "bg-emerald-400 text-[#0B1538] shadow-md shadow-emerald-500/30"
                : "border border-[#1a2a52] bg-[#0a1839] text-[#a8b8d0] hover:bg-[#0e1f4d] hover:text-[#f4ecd8]"
            }`}
          >
            전체 {items.length}
          </button>
          {missionChips.map((m) => {
            const active = filterMissionId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilterMissionId(active ? null : m.id)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${
                  active
                    ? "bg-amber-400 text-[#0B1538] shadow-md shadow-amber-500/30"
                    : "border border-[#1a2a52] bg-[#0a1839] text-[#a8b8d0] hover:bg-[#0e1f4d] hover:text-[#f4ecd8]"
                }`}
                title={`${m.title} — ${m.count}장`}
              >
                <span aria-hidden className="mr-1">{m.icon ?? "📷"}</span>
                <span className="max-w-[120px] truncate align-middle">
                  {m.title}
                </span>
                <span className={`ml-1 font-mono ${active ? "" : "text-[#7a89a8]"}`}>
                  {m.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {list.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
          <div className="text-5xl" aria-hidden>
            🌲
          </div>
          <div className="text-sm text-[#a8b8d0]">
            아직 올라온 사진이 없어요
          </div>
        </div>
      ) : (
        <ul
          className={`grid gap-1.5 ${
            isTvMode ? "grid-cols-6" : "grid-cols-3 md:grid-cols-4"
          }`}
        >
          {list.map((p, i) => (
            <li
              key={p.submissionId}
              className="group relative aspect-square overflow-hidden rounded-md border border-[#1a2a52] bg-[#0a1839]"
              title={`${p.userDisplayName} · ${p.missionTitle} · ${fmtClockKstAlways(p.submittedAt)}`}
            >
              <button
                type="button"
                onClick={() => openAt(i)}
                aria-label="사진 확대 보기"
                className="block h-full w-full cursor-zoom-in"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.missionTitle}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              </button>
              {/* hover/tap overlay */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="truncate text-[10px] font-bold text-[#f4ecd8]">
                  {p.missionIcon ?? "📷"} {p.missionTitle}
                </div>
                <div className="truncate text-[9px] text-[#cad3e0]">
                  {p.userDisplayName}
                </div>
                <div className="font-mono text-[9px] text-[#a8b8d0]">
                  {fmtClockKstAlways(p.submittedAt)}
                </div>
              </div>
              {p.status === "PENDING_REVIEW" && (
                <span className="pointer-events-none absolute right-1 top-1 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[8px] font-bold text-white">
                  검수
                </span>
              )}
              {p.status === "REJECTED" && (
                <span className="pointer-events-none absolute right-1 top-1 rounded-full bg-rose-500/90 px-1.5 py-0.5 text-[8px] font-bold text-white">
                  반려
                </span>
              )}
              {/* 운영자 삭제 버튼 — TV 모드에서는 숨김 */}
              {!isTvMode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(p);
                  }}
                  disabled={deletingId === p.submissionId}
                  aria-label="사진 삭제"
                  title="사진을 사진 월에서 삭제 (운영자 전용)"
                  className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-rose-600 group-hover:opacity-100 disabled:opacity-50"
                >
                  {deletingId === p.submissionId ? "⏳" : "🗑"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {lightbox}
    </div>
  );
}
