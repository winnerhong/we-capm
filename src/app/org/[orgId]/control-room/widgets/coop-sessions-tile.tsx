"use client";

// 👫 짝꿍 세션 — COOP 미션의 매칭/진행 상태를 사진월처럼 그리드로.
//  - 미션별 칩 필터 (스템프북 순서)
//  - 상태 칩 (활성/완료/만료/취소) — 카운트 0 이면 칩 숨김
//  - 페이지네이션 12장씩 (TV 는 전체)
//  - 카드: 짝꿍 페어 + 상태 + (있을 때) 공유 사진

import { useMemo, useRef, useState } from "react";
import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import { fmtClockKstAlways } from "@/lib/datetime/kst";
import { useLightbox, type LightboxItem } from "@/components/photo-lightbox";
import styles from "../control-room.module.css";

type CoopItem = ControlRoomSnapshot["coopSessions"][number];

type Props = {
  items: ControlRoomSnapshot["coopSessions"];
  isTvMode: boolean;
};

const STATE_LABEL: Record<string, { label: string; color: string }> = {
  WAITING: { label: "⏳ 짝꿍 대기", color: "bg-amber-500/20 text-amber-200 ring-amber-400/40" },
  PAIRED: { label: "👫 매칭됨", color: "bg-sky-500/20 text-sky-200 ring-sky-400/40" },
  A_DONE: { label: "✓ A 완료", color: "bg-sky-500/20 text-sky-200 ring-sky-400/40" },
  B_DONE: { label: "✓ B 완료", color: "bg-sky-500/20 text-sky-200 ring-sky-400/40" },
  COMPLETED: { label: "✅ 완료", color: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/40" },
  EXPIRED: { label: "⌛ 만료", color: "bg-stone-500/20 text-stone-300 ring-stone-400/40" },
  CANCELLED: { label: "✕ 취소", color: "bg-rose-500/20 text-rose-200 ring-rose-400/40" },
};

function isActive(state: string) {
  return state === "WAITING" || state === "PAIRED" || state === "A_DONE" || state === "B_DONE";
}
function isCompletedSt(state: string) {
  return state === "COMPLETED";
}
function isClosed(state: string) {
  return state === "EXPIRED" || state === "CANCELLED";
}

export function CoopSessionsTile({ items, isTvMode }: Props) {
  const [filterMissionId, setFilterMissionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "completed" | "closed"
  >("all");

  // 미션 칩 (스템프북 순서)
  const missionChips = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        title: string;
        icon: string | null;
        count: number;
        displayOrder: number;
      }
    >();
    for (const it of items) {
      const cur = map.get(it.missionId);
      if (cur) cur.count += 1;
      else {
        map.set(it.missionId, {
          id: it.missionId,
          title: it.missionTitle,
          icon: it.missionIcon,
          count: 1,
          displayOrder: it.missionDisplayOrder,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return a.id.localeCompare(b.id);
    });
  }, [items]);

  const missionFiltered = useMemo(() => {
    if (!filterMissionId) return items;
    const exists = items.some((p) => p.missionId === filterMissionId);
    if (!exists) return items;
    return items.filter((p) => p.missionId === filterMissionId);
  }, [items, filterMissionId]);

  const statusCounts = useMemo(() => {
    let active = 0;
    let completed = 0;
    let closed = 0;
    for (const it of missionFiltered) {
      if (isActive(it.state)) active++;
      else if (isCompletedSt(it.state)) completed++;
      else if (isClosed(it.state)) closed++;
    }
    return { all: missionFiltered.length, active, completed, closed };
  }, [missionFiltered]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return missionFiltered;
    if (statusFilter === "active") {
      return missionFiltered.filter((it) => isActive(it.state));
    }
    if (statusFilter === "completed") {
      return missionFiltered.filter((it) => isCompletedSt(it.state));
    }
    return missionFiltered.filter((it) => isClosed(it.state));
  }, [missionFiltered, statusFilter]);

  // 페이지네이션 — 가로 4칸 × 세로 3칸 = 12개씩 (사진월과 동일, TV 모드는 전체)
  const PAGE_SIZE = 12;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const list = isTvMode
    ? filtered
    : filtered.slice(pageStart, pageStart + PAGE_SIZE);

  // 사진 있는 세션만 lightbox 큐에 → 사진 클릭 시 그 인덱스로 오픈.
  const photoSessions = useMemo(
    () => list.filter((it) => it.sharedPhotoUrl),
    [list]
  );
  const lightboxItems: LightboxItem[] = useMemo(
    () =>
      photoSessions.map((it) => ({
        url: it.sharedPhotoUrl!,
        caption: `${it.missionIcon ?? "👫"} ${it.missionTitle}`,
        subCaption: `${it.initiatorDisplayName}${
          it.partnerDisplayName ? ` · ${it.partnerDisplayName}` : ""
        }`,
      })),
    [photoSessions]
  );
  const { openAt, lightbox } = useLightbox(lightboxItems);
  const photoIndexBySession = useMemo(() => {
    const map = new Map<string, number>();
    photoSessions.forEach((it, i) => map.set(it.sessionId, i));
    return map;
  }, [photoSessions]);

  // 헤더 클릭 → 섹션을 화면 최상단으로 스크롤 (자석 정렬).
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const snapToTop = () => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      ref={sectionRef}
      className={`${styles.surface} scroll-mt-24 flex h-full min-h-0 flex-col p-4`}
    >
      <button
        type="button"
        onClick={snapToTop}
        title="클릭하면 자석처럼 최상단에 붙어요"
        className="mb-3 flex w-full items-center gap-2 rounded text-left transition hover:bg-white/[0.03]"
      >
        <span className="text-base" aria-hidden>
          👫
        </span>
        <h2 className="text-xs font-semibold tracking-[0.15em] text-[#a8b8d0]">
          짝꿍 세션
        </h2>
        <span aria-hidden className="text-[10px] text-[#7a8aa8]">
          🧲
        </span>
        <span className="ml-auto font-mono text-xs text-[#a8b8d0]">
          {filterMissionId
            ? `${filtered.length} / ${items.length}`
            : items.length}
        </span>
      </button>

      {/* 미션별 필터 칩 — 사진월과 동일 패턴 */}
      {missionChips.length > 1 && (
        <div
          role="tablist"
          aria-label="미션별 짝꿍 필터"
          className="mb-3 flex flex-wrap gap-1.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filterMissionId === null}
            onClick={() => {
              setFilterMissionId(null);
              setStatusFilter("all");
              setCurrentPage(1);
            }}
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
                onClick={() => {
                  setFilterMissionId(active ? null : m.id);
                  setStatusFilter("all");
                  setCurrentPage(1);
                }}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${
                  active
                    ? "bg-amber-400 text-[#0B1538] shadow-md shadow-amber-500/30"
                    : "border border-[#1a2a52] bg-[#0a1839] text-[#a8b8d0] hover:bg-[#0e1f4d] hover:text-[#f4ecd8]"
                }`}
              >
                <span aria-hidden className="mr-1">
                  {m.icon ?? "👫"}
                </span>
                <span className="max-w-[120px] truncate align-middle">
                  {m.title}
                </span>
                <span
                  className={`ml-1 font-mono ${active ? "" : "text-[#7a89a8]"}`}
                >
                  {m.count}
                </span>
                {active && (
                  <span
                    aria-hidden
                    className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#0B1538]/15 text-[10px] font-bold"
                  >
                    ✕
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 상태 필터 + 페이지네이션 */}
      {missionFiltered.length > 0 && !isTvMode && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold">
          <div
            role="tablist"
            aria-label="짝꿍 상태 필터"
            className="flex items-center gap-1.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "all"}
              onClick={() => {
                setStatusFilter("all");
                setCurrentPage(1);
              }}
              className={`rounded-full px-2 py-0.5 transition ${
                statusFilter === "all"
                  ? "bg-white/20 text-[#f4ecd8] ring-1 ring-white/40"
                  : "text-[#a8b8d0] ring-1 ring-white/10 hover:bg-white/10"
              }`}
            >
              전체 {statusCounts.all}
            </button>
            {statusCounts.active > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === "active"}
                onClick={() => {
                  setStatusFilter(statusFilter === "active" ? "all" : "active");
                  setCurrentPage(1);
                }}
                className={`rounded-full px-2 py-0.5 transition ${
                  statusFilter === "active"
                    ? "bg-amber-500/40 text-amber-50 ring-1 ring-amber-300/60"
                    : "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30 hover:bg-amber-500/25"
                }`}
              >
                ⏳ 진행중 {statusCounts.active}
              </button>
            )}
            {statusCounts.completed > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === "completed"}
                onClick={() => {
                  setStatusFilter(
                    statusFilter === "completed" ? "all" : "completed"
                  );
                  setCurrentPage(1);
                }}
                className={`rounded-full px-2 py-0.5 transition ${
                  statusFilter === "completed"
                    ? "bg-emerald-500/40 text-emerald-50 ring-1 ring-emerald-300/60"
                    : "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30 hover:bg-emerald-500/25"
                }`}
              >
                ✓ 완료 {statusCounts.completed}
              </button>
            )}
            {statusCounts.closed > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === "closed"}
                onClick={() => {
                  setStatusFilter(statusFilter === "closed" ? "all" : "closed");
                  setCurrentPage(1);
                }}
                className={`rounded-full px-2 py-0.5 transition ${
                  statusFilter === "closed"
                    ? "bg-rose-500/40 text-rose-50 ring-1 ring-rose-300/60"
                    : "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30 hover:bg-rose-500/25"
                }`}
              >
                ✕ 종료 {statusCounts.closed}
              </button>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                aria-label="이전 페이지"
                className="rounded-md border border-[#1a2a52] bg-[#0a1839] px-2 py-1 text-[#a8b8d0] transition hover:bg-[#0e1f4d] disabled:cursor-not-allowed disabled:opacity-30"
              >
                ‹
              </button>
              <span className="font-mono text-[#cad3e0]">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={safePage >= totalPages}
                aria-label="다음 페이지"
                className="rounded-md border border-[#1a2a52] bg-[#0a1839] px-2 py-1 text-[#a8b8d0] transition hover:bg-[#0e1f4d] disabled:cursor-not-allowed disabled:opacity-30"
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}

      {list.length === 0 ? (
        <div className="py-1 text-[12px] text-[#a8b8d0]">
          🌲 아직 짝꿍 세션이 없어요
        </div>
      ) : (
        <ul
          className={`grid gap-2 ${
            isTvMode ? "grid-cols-6" : "grid-cols-3 md:grid-cols-4"
          }`}
        >
          {list.map((it) => {
            const photoIdx = photoIndexBySession.get(it.sessionId);
            return (
              <CoopCard
                key={it.sessionId}
                item={it}
                onPhotoClick={
                  photoIdx !== undefined ? () => openAt(photoIdx) : undefined
                }
              />
            );
          })}
        </ul>
      )}
      {lightbox}

      {/* 하단 페이지네이션 */}
      {!isTvMode && totalPages > 1 && list.length > 0 && (
        <div className="mt-3 flex items-center justify-center gap-3 text-[11px]">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="rounded-lg border border-[#1a2a52] bg-[#0a1839] px-3 py-1.5 font-semibold text-[#a8b8d0] transition hover:bg-[#0e1f4d] disabled:cursor-not-allowed disabled:opacity-30"
          >
            ‹ 이전
          </button>
          <span className="font-mono text-[#cad3e0]">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 font-bold text-amber-200 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-30"
          >
            다음 ›
          </button>
        </div>
      )}
    </div>
  );
}

function CoopCard({
  item,
  onPhotoClick,
}: {
  item: CoopItem;
  onPhotoClick?: () => void;
}) {
  const meta = STATE_LABEL[item.state] ?? {
    label: item.state,
    color: "bg-stone-500/20 text-stone-300 ring-stone-400/40",
  };
  const showPhoto = !!item.sharedPhotoUrl;

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-[#1a2a52] bg-[#0a1839] p-2">
      {/* 사진 (있을 때만) — 클릭 시 lightbox 확대 */}
      {showPhoto &&
        (onPhotoClick ? (
          <button
            type="button"
            onClick={onPhotoClick}
            aria-label="사진 확대 보기"
            className="block w-full overflow-hidden rounded-md"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.sharedPhotoUrl!}
              alt={item.missionTitle}
              loading="lazy"
              className="aspect-[4/3] w-full cursor-zoom-in object-cover transition-transform hover:scale-105"
            />
          </button>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.sharedPhotoUrl!}
            alt={item.missionTitle}
            loading="lazy"
            className="aspect-[4/3] w-full rounded-md object-cover"
          />
        ))}

      {/* 상태 + 페어코드 */}
      <div className="flex items-center justify-between gap-1">
        <span
          className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ring-1 ${meta.color}`}
        >
          {meta.label}
        </span>
        <span className="font-mono text-[10px] tracking-widest text-[#a8b8d0]">
          {item.pairCode}
        </span>
      </div>

      {/* 미션 */}
      <div className="truncate text-[11px] font-semibold text-[#f4ecd8]">
        {item.missionIcon ?? "👫"} {item.missionTitle}
      </div>

      {/* 짝꿍 페어 */}
      <div className="space-y-0.5 text-[10px] leading-tight">
        <p className="truncate text-[#cad3e0]">A · {item.initiatorDisplayName}</p>
        <p
          className={`truncate ${
            item.partnerDisplayName ? "text-[#cad3e0]" : "text-[#7a8aa8]"
          }`}
        >
          B · {item.partnerDisplayName ?? "(대기 중)"}
        </p>
      </div>

      {/* 시각 */}
      <div className="font-mono text-[9px] text-[#7a8aa8]">
        {item.completedAt
          ? `완료 ${fmtClockKstAlways(item.completedAt)}`
          : item.pairedAt
            ? `매칭 ${fmtClockKstAlways(item.pairedAt)}`
            : `생성 ${fmtClockKstAlways(item.createdAt)}`}
      </div>
    </li>
  );
}
