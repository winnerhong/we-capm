"use client";

import { useMemo, useRef, useState } from "react";
import type {
  ControlRoomFamilyRow,
  ControlRoomFamilyGrid,
  ControlRoomMissionProgressRow,
  ControlRoomPhotoItem,
  FamilyMissionCellState,
} from "@/lib/control-room/types";
import { fmtClockKstAlways } from "@/lib/datetime/kst";
import { useLightbox, type LightboxItem } from "@/components/photo-lightbox";
import { AcornIcon } from "@/components/acorn-icon";
import { GiftGrantInline } from "./gift-grant-inline";
import styles from "../control-room.module.css";

export type FamilyGridGiftTemplate = {
  id: string;
  label: string;
  message: string | null;
  giftUrl: string | null;
  defaultExpiresDays: number;
};

type Props = {
  grid: ControlRoomFamilyGrid;
  /** 가족 클릭 시 그 가족의 사진을 모아 보여주기 위해 photoWall 도 함께 받음 */
  photos: ControlRoomPhotoItem[];
  /** 평시 우측 사이드(아무 가족도 hover 안 됨)에 컴팩트 미션 진행률을 표시. */
  missionProgress: ControlRoomMissionProgressRow[];
  isTvMode: boolean;
  /** 🎁 인라인 발급 시 셀렉터로 노출할 미리 저장 쿠폰 템플릿. */
  giftTemplates?: FamilyGridGiftTemplate[];
};

const STATE_META: Record<
  Exclude<FamilyMissionCellState, null>,
  { label: string; emoji: string; cls: string }
> = {
  DONE: {
    label: "완료",
    emoji: "✓",
    cls: "bg-emerald-500/80 text-white",
  },
  WAITING: {
    label: "검수",
    emoji: "⏳",
    cls: "bg-amber-500/80 text-white",
  },
  REJECTED: {
    label: "반려",
    emoji: "✕",
    cls: "bg-rose-500/80 text-white",
  },
};

/**
 * 👥 가족 × 미션 매트릭스 — 가족 진행 한눈에 + 클릭으로 드릴다운.
 * - 컬럼: 활성 미션. 행: 가족. 셀: 상태 칩.
 * - 가족 행 클릭 → 우측 패널에 그 가족의 사진/상태 자세히.
 */
export function FamilyGridTile({
  grid,
  photos,
  missionProgress,
  isTvMode,
  giftTemplates = [],
}: Props) {
  // 클릭으로 "고정" 한 가족. ✕ 누를 때까지 유지.
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  // 마우스 호버로 "미리보기" — 행 이름 위에 올리면 우측 패널이 그 가족으로.
  // 클릭으로 고정된 가족이 있으면 hover 미리보기는 무시 (의도된 고정 보호).
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
  // 미션 헤더 hover/click → 우측 패널에 그 미션의 상세 진행 상황.
  // 가족(selectedUserId/hoveredUserId) 가 우선 — 가족이 활성이면 미션 상세는 무시.
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(
    null
  );
  const [hoveredMissionId, setHoveredMissionId] = useState<string | null>(
    null
  );
  // 반별 필터 — null=전체, 그 외는 정확한 class_name 매칭(혹은 "없음" 가상값).
  const [classFilter, setClassFilter] = useState<string | null>(null);
  // 검색어 — 이름/연락처/자녀 이름/반 부분 매칭. 비어있으면 필터 적용 안 함.
  const [searchQuery, setSearchQuery] = useState("");

  // 모든 반 이름 + 각 반의 가족 수 집계 (필터 칩 표시용).
  const classOptions = useMemo(() => {
    const counts = new Map<string, number>();
    let noClassCount = 0;
    for (const r of grid.rows) {
      if (r.classNames.length === 0) {
        noClassCount += 1;
        continue;
      }
      // 가족 1명이 여러 반에 속해 있으면 각 반에 한번씩 카운트.
      for (const cn of r.classNames) {
        counts.set(cn, (counts.get(cn) ?? 0) + 1);
      }
    }
    const list = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return { list, noClassCount };
  }, [grid.rows]);

  // 표시할 가족 결정 — 클릭 고정이 우선, 없으면 호버.
  const previewUserId = selectedUserId ?? hoveredUserId;

  const previewRow = useMemo(
    () =>
      previewUserId
        ? grid.rows.find((r) => r.userId === previewUserId) ?? null
        : null,
    [previewUserId, grid.rows]
  );

  const previewPhotos = useMemo(() => {
    if (!previewRow) return [];
    // photo wall 에 그 가족의 사진들만 필터 — userDisplayName 매칭.
    return photos.filter((p) => p.userDisplayName === previewRow.displayName);
  }, [previewRow, photos]);

  const isPinned = selectedUserId !== null;

  // 사진 클릭 → 확대 모달. 현재 previewRow 의 사진 시퀀스를 보여줌.
  const lightboxItems: LightboxItem[] = useMemo(
    () =>
      previewPhotos.map((p) => ({
        url: p.url,
        caption: previewRow?.displayName,
        subCaption: `${p.missionTitle} · ${fmtClockKstAlways(p.submittedAt)}`,
      })),
    [previewPhotos, previewRow]
  );
  const { openAt, lightbox } = useLightbox(lightboxItems);

  // 반 필터 + 검색어 필터 적용. 둘 다 비어있으면 전체.
  const rowsToShow = useMemo(() => {
    let rows = grid.rows;

    // 1) 반 필터
    if (classFilter === "__no_class__") {
      rows = rows.filter((r) => r.classNames.length === 0);
    } else if (classFilter) {
      rows = rows.filter((r) => r.classNames.includes(classFilter));
    }

    // 2) 검색어 — 보호자 이름 / 표시명 / 자녀 이름 / 반 이름 / 전화번호(숫자 부분 매칭).
    //    공백 split 으로 모든 토큰 AND.
    const q = searchQuery.trim();
    if (q) {
      const digits = q.replace(/\D/g, "");
      const tokens = q
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      rows = rows.filter((r) => {
        const haystack = [
          r.parentName,
          r.displayName,
          ...r.children.map((c) => c.name),
          ...r.classNames,
        ]
          .join(" ")
          .toLowerCase();
        // 텍스트 토큰 모두 매칭 OR 숫자만 입력했다면 전화번호 부분 매칭.
        const textMatch = tokens.every((t) => haystack.includes(t));
        const phoneMatch = digits.length >= 2 && r.phone.includes(digits);
        return textMatch || phoneMatch;
      });
    }

    return rows;
  }, [grid.rows, classFilter, searchQuery]);

  // 미션 헤더 hover/click → 상세 패널에 보여줄 데이터를 derivation.
  // 가족 미리보기가 활성이면 미션 상세는 무시 (가족 우선).
  const activeMissionId = selectedMissionId ?? hoveredMissionId;
  const isMissionPinned = selectedMissionId !== null;
  const missionDetail = useMemo(() => {
    if (selectedUserId || hoveredUserId) return null; // 가족 우선
    if (!activeMissionId) return null;
    const mission = grid.missions.find((x) => x.id === activeMissionId);
    const progress = missionProgress.find(
      (p) => p.missionId === activeMissionId
    );
    if (!mission || !progress) return null;
    const done: ControlRoomFamilyRow[] = [];
    const waiting: ControlRoomFamilyRow[] = [];
    const rejected: ControlRoomFamilyRow[] = [];
    const notStarted: ControlRoomFamilyRow[] = [];
    for (const r of grid.rows) {
      const s = r.perMission[activeMissionId];
      if (s === "DONE") done.push(r);
      else if (s === "WAITING") waiting.push(r);
      else if (s === "REJECTED") rejected.push(r);
      else notStarted.push(r);
    }
    const missionPhotos = photos
      .filter((p) => p.missionId === activeMissionId)
      .slice(0, 6);
    return { mission, progress, done, waiting, rejected, notStarted, missionPhotos };
  }, [
    activeMissionId,
    selectedUserId,
    hoveredUserId,
    grid.missions,
    grid.rows,
    missionProgress,
    photos,
  ]);

  // 헤더 클릭 → 섹션을 화면 최상단으로 스크롤 (자석 정렬).
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const snapToTop = () => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      ref={sectionRef}
      className={`${styles.surface} scroll-mt-24 flex flex-col p-4`}
    >
      <button
        type="button"
        onClick={snapToTop}
        title="화면 최상단으로 이동"
        className="mb-3 flex w-full items-center gap-2 rounded text-left transition hover:bg-white/[0.03]"
      >
        <span className="text-base" aria-hidden>
          👥
        </span>
        <h2 className="text-xs font-semibold tracking-[0.15em] text-[#a8b8d0]">
          가족별 진행
        </h2>
        <span
          aria-hidden
          title="클릭하면 자석처럼 최상단에 붙어요"
          className="text-[10px] text-[#7a8aa8]"
        >
          🧲
        </span>
        <span className="ml-auto font-mono text-xs text-[#a8b8d0]">
          {classFilter || searchQuery.trim()
            ? `${rowsToShow.length}/${grid.rows.length}`
            : grid.rows.length}
        </span>
      </button>

      {/* 검색 input — 이름/연락처/자녀/반 부분 매칭. 한글 IME composition 도중 onChange 가 잘게 떨어져도
          단순 substring 매칭이라 안전. */}
      <div className="mb-2 flex items-center gap-2">
        <div className="relative flex-1">
          <span
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#6b7c98]"
          >
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름 · 연락처 · 자녀 · 반 검색"
            aria-label="가족 검색"
            className="w-full rounded-lg border border-[#243366] bg-[#0d1530] py-1.5 pl-8 pr-8 text-[12px] text-white placeholder:text-[#6b7c98] outline-none focus:border-[#4a6db8] focus:ring-1 focus:ring-[#4a6db8]/40"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="검색 지우기"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[11px] text-[#7a8aa8] hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 반별 필터 칩 — 반 데이터가 하나도 없으면 숨김 */}
      {(classOptions.list.length > 0 || classOptions.noClassCount > 0) && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <ClassChip
            label="전체"
            count={grid.rows.length}
            active={classFilter === null}
            onClick={() => setClassFilter(null)}
          />
          {classOptions.list.map((c) => (
            <ClassChip
              key={c.name}
              label={`🐰 ${c.name}`}
              count={c.count}
              active={classFilter === c.name}
              onClick={() =>
                setClassFilter((prev) => (prev === c.name ? null : c.name))
              }
            />
          ))}
          {classOptions.noClassCount > 0 && (
            <ClassChip
              label="반 미지정"
              count={classOptions.noClassCount}
              active={classFilter === "__no_class__"}
              onClick={() =>
                setClassFilter((prev) =>
                  prev === "__no_class__" ? null : "__no_class__"
                )
              }
            />
          )}
        </div>
      )}

      {grid.rows.length === 0 || grid.missions.length === 0 ? (
        <div className="py-1 text-[12px] text-[#a8b8d0]">
          🌱{" "}
          {grid.missions.length === 0
            ? "활성 미션이 없어요"
            : "참가자가 없어요"}
        </div>
      ) : (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          {/* 좌측: 그리드 — 가족 많아도 모두 노출. 일정 높이 넘으면 내부 스크롤. */}
          <div
            className="scroll-dark min-w-0 flex-1 overflow-auto rounded-lg border border-[#16234a]"
            style={{
              // 한 화면(viewport) 안에 매트릭스 + 우측 패널 들어가도록.
              // 작은 노트북(768p)에서도 최소 480px 보장.
              maxHeight: isTvMode
                ? "calc(100vh - 200px)"
                : "calc(100vh - 240px)",
              minHeight: 480,
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.22) transparent",
            }}
          >
            <table className="w-full table-fixed border-collapse text-[11px]">
              <colgroup>
                <col style={{ width: 150 }} />
                {grid.missions.map((m) => (
                  <col key={m.id} />
                ))}
                <col style={{ width: 64 }} />
              </colgroup>
              <thead className="sticky top-0 z-20 bg-[#0a1839]">
                <tr>
                  <th className="sticky left-0 z-30 bg-[#0a1839] px-2 py-1.5 text-left font-semibold text-[#a8b8d0]">
                    가족
                  </th>
                  {grid.missions.map((m) => {
                    const isMissionActive =
                      selectedMissionId === m.id ||
                      (!selectedMissionId && hoveredMissionId === m.id);
                    return (
                      <th
                        key={m.id}
                        title={m.title}
                        onMouseEnter={() => setHoveredMissionId(m.id)}
                        onMouseLeave={() =>
                          setHoveredMissionId((prev) =>
                            prev === m.id ? null : prev
                          )
                        }
                        onClick={() =>
                          setSelectedMissionId((prev) =>
                            prev === m.id ? null : m.id
                          )
                        }
                        className={`cursor-pointer bg-[#0a1839] px-1 py-1.5 text-center font-semibold text-[#a8b8d0] transition hover:bg-[#16234a] ${
                          isMissionActive ? "bg-[#1e2b56]" : ""
                        }`}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-base leading-none" aria-hidden>
                            {m.icon ?? "🌱"}
                          </span>
                          <span className="block max-w-full truncate text-[9px] font-normal leading-tight text-[#a8b8d0]/85">
                            {m.title}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                  <th className={`bg-[#0a1839] px-2 py-1.5 text-right font-semibold ${styles.neonAmber}`}>
                    <AcornIcon size={14} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {rowsToShow.length === 0 && (
                  <tr>
                    <td
                      colSpan={grid.missions.length + 2}
                      className="px-3 py-6 text-center text-[12px] text-[#7a8aa8]"
                    >
                      🔍 검색 결과가 없어요
                    </td>
                  </tr>
                )}
                {rowsToShow.map((r, idx) => {
                  // 순위 — 반 필터 적용 시 필터된 그룹 안에서 재계산 (1-based).
                  const rank = idx + 1;
                  const isSelected = r.userId === selectedUserId;
                  const isHovered =
                    !selectedUserId && r.userId === hoveredUserId;
                  return (
                    <tr
                      key={r.userId}
                      onClick={() =>
                        setSelectedUserId(isSelected ? null : r.userId)
                      }
                      onMouseEnter={() => setHoveredUserId(r.userId)}
                      onMouseLeave={() =>
                        setHoveredUserId((prev) =>
                          prev === r.userId ? null : prev
                        )
                      }
                      className={`cursor-pointer border-t border-[#243a78] transition hover:bg-[#0a1839] ${
                        isSelected
                          ? "bg-[#1e2b56]"
                          : isHovered
                            ? "bg-[#0a1839]"
                            : ""
                      }`}
                    >
                      <td className="sticky left-0 bg-inherit px-2 py-1.5 font-semibold text-[#f4ecd8]">
                        <div className="flex items-start gap-1.5">
                          <RankBadge rank={rank} />
                          <div className="min-w-0 flex-1">
                            {r.classNames.length > 0 && (
                              <span className="mb-0.5 inline-flex max-w-full items-center truncate rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 ring-1 ring-emerald-500/30">
                                🐰 {r.classNames.join(" · ")}
                              </span>
                            )}
                            <span className="block max-w-[110px] truncate">
                              {r.displayName}
                            </span>
                            <span className="text-[9px] font-normal text-[#a8b8d0]">
                              ✓ {r.doneCount}/{grid.missions.length}
                            </span>
                          </div>
                        </div>
                      </td>
                      {grid.missions.map((m) => {
                        const state = r.perMission[m.id];
                        if (!state) {
                          return (
                            <td
                              key={m.id}
                              className="px-1 py-1 text-center text-[#3a4868]"
                            >
                              ·
                            </td>
                          );
                        }
                        const meta = STATE_META[state];
                        return (
                          <td key={m.id} className="px-1 py-1 text-center">
                            <span
                              className={`inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold leading-none ${meta.cls}`}
                              title={`${m.title}: ${meta.label}`}
                            >
                              {meta.emoji}
                            </span>
                          </td>
                        );
                      })}
                      <td
                        className={`px-2 py-1.5 text-right font-mono tabular-nums ${styles.neonAmber}`}
                      >
                        {r.totalAcorns}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 우측: 드릴다운 — hover 미리보기 + click 고정. lg+ 에서 sticky 로
              테이블이 길어 스크롤해도 따라온다. */}
          {previewRow ? (
            <aside
              className={`scroll-dark max-h-[calc(100vh-240px)] min-h-[480px] w-full shrink-0 overflow-y-auto rounded-lg border bg-[#0a1839] p-3 lg:sticky lg:top-2 lg:w-[340px] xl:w-[380px] ${
                isPinned
                  ? "border-emerald-500/40 ring-1 ring-emerald-500/20"
                  : "border-[#1a2a52] opacity-95"
              }`}
              onMouseEnter={() => {
                // 패널 위에 마우스 올린 동안엔 hover 유지 (행을 떠도 사라지지 않게).
                if (!isPinned) setHoveredUserId(previewRow.userId);
              }}
              onMouseLeave={() => {
                if (!isPinned) setHoveredUserId(null);
              }}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {/* 반명 칩 — 항상 같은 공간 확보 (칩 없을 때도 placeholder 로 높이 동일). */}
                  <div className="mb-1 flex min-h-[22px] flex-wrap gap-1">
                    {previewRow.classNames.map((cn) => (
                      <span
                        key={cn}
                        className="inline-flex items-center rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 ring-1 ring-emerald-500/30"
                      >
                        🐰 {cn}
                      </span>
                    ))}
                  </div>
                  <h3 className="truncate text-sm font-bold text-[#f4ecd8]">
                    {previewRow.displayName}
                  </h3>
                  <span
                    className={`text-[9px] font-semibold ${
                      isPinned ? "text-emerald-300" : "text-[#a8b8d0]"
                    }`}
                  >
                    {isPinned ? "📌 고정됨" : "👁 미리보기 (클릭 = 고정)"}
                  </span>
                </div>
                {isPinned && (
                  <button
                    type="button"
                    onClick={() => setSelectedUserId(null)}
                    className="rounded-full px-1.5 text-[10px] text-[#a8b8d0] hover:bg-[#16234a]"
                    aria-label="고정 해제"
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="text-[10px] text-[#a8b8d0]">
                ✓ {previewRow.doneCount}/{grid.missions.length} 미션 완료 ·{" "}
                <span className={`inline-flex items-center gap-1 ${styles.neonAmber}`}>
                  <AcornIcon size={11} /> {previewRow.totalAcorns}
                </span>
              </p>

              {/* 🎁 선물 증정 — 클릭 시 폼 펼침, 발급되면 그 가족 /gifts 에 즉시 노출 */}
              <GiftGrantInline
                userId={previewRow.userId}
                displayName={previewRow.displayName}
                templates={giftTemplates}
              />

              {/* 미션별 상태 리스트 */}
              <ul className="mt-3 space-y-1">
                {grid.missions.map((m) => {
                  const state = previewRow.perMission[m.id];
                  return (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-[10px] text-[#cad3e0]"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {m.icon ?? "🌱"} {m.title}
                      </span>
                      {state ? (
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${STATE_META[state].cls}`}
                        >
                          {STATE_META[state].emoji} {STATE_META[state].label}
                        </span>
                      ) : (
                        <span className="shrink-0 text-[9px] text-[#3a4868]">
                          미시작
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>

              {/* 이 가족의 사진 — 클릭 시 확대 모달 */}
              {previewPhotos.length > 0 && (
                <>
                  <div className="mt-3 text-[10px] font-semibold text-[#a8b8d0]">
                    📸 올린 사진 ({previewPhotos.length})
                    <span className="ml-1 font-normal text-[#7a8aa8]">
                      · 클릭하면 확대
                    </span>
                  </div>
                  <ul className="mt-1 grid grid-cols-3 gap-1">
                    {previewPhotos.slice(0, 6).map((p, i) => (
                      <li
                        key={p.submissionId}
                        className="aspect-square overflow-hidden rounded border border-[#16234a]"
                        title={`${p.missionTitle} · ${fmtClockKstAlways(p.submittedAt)}`}
                      >
                        <button
                          type="button"
                          onClick={() => openAt(i)}
                          className="block h-full w-full cursor-zoom-in transition hover:scale-105"
                          aria-label="사진 확대 보기"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.url}
                            alt={p.missionTitle}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </aside>
          ) : missionDetail ? (
            // 미션 헤더 hover/click → 그 미션의 상세 진행 상황 (가족 분류, 사진).
            <aside
              className={`scroll-dark hidden max-h-[calc(100vh-240px)] min-h-[480px] w-full shrink-0 overflow-y-auto rounded-lg border bg-[#0a1839] p-3 lg:sticky lg:top-2 lg:block lg:w-[340px] xl:w-[380px] ${
                isMissionPinned
                  ? "border-amber-400/40 ring-1 ring-amber-400/20"
                  : "border-[#1a2a52]"
              }`}
              onMouseEnter={() => {
                if (!isMissionPinned)
                  setHoveredMissionId(missionDetail.mission.id);
              }}
              onMouseLeave={() => {
                if (!isMissionPinned) setHoveredMissionId(null);
              }}
            >
              <header className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#f4ecd8]">
                    <span aria-hidden>{missionDetail.mission.icon ?? "🌱"}</span>
                    <span className="truncate">
                      {missionDetail.mission.title}
                    </span>
                  </h3>
                  <span
                    className={`text-[9px] font-semibold ${
                      isMissionPinned ? "text-amber-300" : "text-[#a8b8d0]"
                    }`}
                  >
                    {isMissionPinned
                      ? "📌 고정됨"
                      : "🎯 미션 진행 (클릭 = 고정)"}
                  </span>
                </div>
                {isMissionPinned && (
                  <button
                    type="button"
                    onClick={() => setSelectedMissionId(null)}
                    className="rounded-full px-1.5 text-[10px] text-[#a8b8d0] hover:bg-[#16234a]"
                    aria-label="고정 해제"
                  >
                    ✕
                  </button>
                )}
              </header>

              {/* 큰 진행률 */}
              <div className="mb-3 rounded-md bg-[#16234a]/60 p-2.5">
                <div className="flex items-baseline justify-between">
                  <span
                    className={`font-mono text-2xl font-extrabold tabular-nums ${styles.neonAmber}`}
                  >
                    {missionDetail.progress.completionPct}%
                  </span>
                  <span className="text-[10px] text-[#a8b8d0]">
                    {missionDetail.progress.completedCount} /{" "}
                    {missionDetail.progress.totalParticipants} 가족
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#0a1839]">
                  <div
                    className="h-full rounded-full bg-amber-400/85"
                    style={{
                      width: `${missionDetail.progress.completionPct}%`,
                    }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                  <span className="text-emerald-300">
                    ✓ 완료 {missionDetail.done.length}
                  </span>
                  {missionDetail.waiting.length > 0 && (
                    <span className="text-amber-300">
                      ⏳ 대기 {missionDetail.waiting.length}
                    </span>
                  )}
                  {missionDetail.rejected.length > 0 && (
                    <span className="text-rose-300">
                      ✕ 반려 {missionDetail.rejected.length}
                    </span>
                  )}
                  <span className="text-[#7a8aa8]">
                    · 미시작 {missionDetail.notStarted.length}
                  </span>
                </div>
              </div>

              {/* 최근 제출 사진 (사진 미션만 — photoWall 에 있을 때) */}
              {missionDetail.missionPhotos.length > 0 && (
                <div className="mb-3">
                  <div className="mb-1 text-[10px] font-semibold text-[#a8b8d0]">
                    📸 최근 제출 ({missionDetail.missionPhotos.length})
                  </div>
                  <ul className="grid grid-cols-3 gap-1">
                    {missionDetail.missionPhotos.map((p) => (
                      <li
                        key={p.submissionId}
                        className="aspect-square overflow-hidden rounded border border-[#16234a]"
                        title={`${p.userDisplayName} · ${fmtClockKstAlways(p.submittedAt)}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt={p.userDisplayName}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 가족 분류 — 완료/대기/반려/미시작 */}
              <MissionFamilyGroup
                label="✓ 완료"
                rows={missionDetail.done}
                color="emerald"
                onPickFamily={setSelectedUserId}
                defaultOpen
              />
              {missionDetail.waiting.length > 0 && (
                <MissionFamilyGroup
                  label="⏳ 검수 대기"
                  rows={missionDetail.waiting}
                  color="amber"
                  onPickFamily={setSelectedUserId}
                  defaultOpen
                />
              )}
              {missionDetail.rejected.length > 0 && (
                <MissionFamilyGroup
                  label="✕ 반려"
                  rows={missionDetail.rejected}
                  color="rose"
                  onPickFamily={setSelectedUserId}
                  defaultOpen
                />
              )}
              <MissionFamilyGroup
                label="· 미시작"
                rows={missionDetail.notStarted}
                color="slate"
                onPickFamily={setSelectedUserId}
                defaultOpen={false}
              />
            </aside>
          ) : (
            // 평시(아무 행도 hover/click 안 됨) — 컴팩트 미션 진행률 (lg+ 만).
            <aside className="scroll-dark hidden max-h-[calc(100vh-240px)] min-h-[480px] w-full shrink-0 overflow-y-auto rounded-lg border border-[#1a2a52] bg-[#0a1839]/60 p-3 lg:sticky lg:top-2 lg:block lg:w-[340px] xl:w-[380px]">
              <header className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-[11px] font-bold text-[#cad3e0]">
                  <span aria-hidden>🎯</span>
                  미션별 진행률
                </h3>
                <span className="text-[9px] text-[#7a8aa8]">
                  미션·가족 hover = 상세
                </span>
              </header>
              <ul className="space-y-1.5">
                {missionProgress.map((m) => {
                  const pct = Math.max(0, Math.min(100, m.completionPct));
                  return (
                    <li
                      key={m.missionId}
                      className="rounded-md bg-[#0a1839] px-2 py-1.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm leading-none" aria-hidden>
                          {m.icon ?? "🌱"}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-[#f4ecd8]">
                          {m.title}
                        </span>
                        <span
                          className={`shrink-0 font-mono text-[10px] font-bold tabular-nums ${styles.neonAmber}`}
                        >
                          {pct}%
                        </span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#16234a]">
                        <div
                          className="h-full rounded-full bg-amber-400/80"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[9px] text-[#a8b8d0]">
                        <span>
                          <span className="text-emerald-300">✓</span>{" "}
                          {m.completedCount}
                        </span>
                        {m.pendingCount > 0 && (
                          <span>
                            <span className="text-amber-300">⏳</span>{" "}
                            {m.pendingCount}
                          </span>
                        )}
                        {m.rejectedCount > 0 && (
                          <span>
                            <span className="text-rose-300">✕</span>{" "}
                            {m.rejectedCount}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </aside>
          )}
        </div>
      )}
      {lightbox}
    </div>
  );
}

/**
 * 순위 배지 — TOP 3 메달, 4위 이하 숫자.
 * 매트릭스 가족 컬럼 prefix 로 사용.
 */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span
        title="1위"
        aria-label="1위"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-base leading-none"
      >
        🥇
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span
        title="2위"
        aria-label="2위"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-base leading-none"
      >
        🥈
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span
        title="3위"
        aria-label="3위"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-base leading-none"
      >
        🥉
      </span>
    );
  }
  return (
    <span
      title={`${rank}위`}
      aria-label={`${rank}위`}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#16234a] font-mono text-[10px] font-bold tabular-nums text-[#a8b8d0]"
    >
      {rank}
    </span>
  );
}

function ClassChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${
        active
          ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
          : "border-[#1a2a52] bg-[#0a1839] text-[#a8b8d0] hover:border-[#2d4439] hover:text-[#cad3e0]"
      }`}
    >
      <span>{label}</span>
      <span className="font-mono text-[9px] tabular-nums opacity-80">
        {count}
      </span>
    </button>
  );
}

const GROUP_COLOR: Record<
  "emerald" | "amber" | "rose" | "slate",
  { header: string; chip: string }
> = {
  emerald: {
    header: "text-emerald-300",
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20",
  },
  amber: {
    header: "text-amber-300",
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20",
  },
  rose: {
    header: "text-rose-300",
    chip: "border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
  },
  slate: {
    header: "text-[#7a8aa8]",
    chip: "border-[#1a2a52] bg-[#0a1839] text-[#a8b8d0] hover:bg-[#16234a]",
  },
};

function MissionFamilyGroup({
  label,
  rows,
  color,
  onPickFamily,
  defaultOpen,
}: {
  label: string;
  rows: ControlRoomFamilyRow[];
  color: "emerald" | "amber" | "rose" | "slate";
  onPickFamily: (userId: string) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (rows.length === 0) return null;
  const palette = GROUP_COLOR[color];
  return (
    <section className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between rounded-md px-1.5 py-1 text-[10px] font-bold ${palette.header} hover:bg-[#16234a]`}
      >
        <span>
          {label} <span className="opacity-70">({rows.length})</span>
        </span>
        <span aria-hidden className="text-[9px] opacity-70">
          {open ? "▼" : "▶"}
        </span>
      </button>
      {open && (
        <ul className="mt-1 flex flex-wrap gap-1">
          {rows.map((r) => {
            // 자녀별 (이름, 반) 라벨 — "파랑반 김다민, 초록2반 김다나" 식.
            // 자녀 메타 없으면 displayName 에서 "학부모" suffix 떼고 fallback.
            const label =
              r.children.length > 0
                ? r.children
                    .map((c) =>
                      c.className ? `${c.className} ${c.name}` : c.name
                    )
                    .join(", ")
                : r.displayName.replace(/\s*학부모$/, "");
            return (
              <li key={r.userId}>
                <button
                  type="button"
                  onClick={() => onPickFamily(r.userId)}
                  title={`${r.displayName} · 클릭하면 가족 상세로`}
                  className={`inline-flex max-w-[240px] items-center gap-1 truncate rounded-full border px-1.5 py-0.5 text-[10px] font-semibold transition ${palette.chip}`}
                >
                  <span className="truncate">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
