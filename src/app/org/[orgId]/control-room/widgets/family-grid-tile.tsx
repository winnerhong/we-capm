"use client";

import { useMemo, useState } from "react";
import type {
  ControlRoomFamilyRow,
  ControlRoomFamilyGrid,
  ControlRoomPhotoItem,
  FamilyMissionCellState,
} from "@/lib/control-room/types";
import { fmtClockKstAlways } from "@/lib/datetime/kst";
import { useLightbox, type LightboxItem } from "@/components/photo-lightbox";
import styles from "../control-room.module.css";

type Props = {
  grid: ControlRoomFamilyGrid;
  /** 가족 클릭 시 그 가족의 사진을 모아 보여주기 위해 photoWall 도 함께 받음 */
  photos: ControlRoomPhotoItem[];
  isTvMode: boolean;
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
export function FamilyGridTile({ grid, photos, isTvMode }: Props) {
  // 클릭으로 "고정" 한 가족. ✕ 누를 때까지 유지.
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  // 마우스 호버로 "미리보기" — 행 이름 위에 올리면 우측 패널이 그 가족으로.
  // 클릭으로 고정된 가족이 있으면 hover 미리보기는 무시 (의도된 고정 보호).
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
  // 반별 필터 — null=전체, 그 외는 정확한 class_name 매칭(혹은 "없음" 가상값).
  const [classFilter, setClassFilter] = useState<string | null>(null);

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

  // 반 필터 적용. null=전체, "__no_class__"=반 없음, 그 외는 정확한 매칭.
  const rowsToShow = useMemo(() => {
    if (!classFilter) return grid.rows;
    if (classFilter === "__no_class__") {
      return grid.rows.filter((r) => r.classNames.length === 0);
    }
    return grid.rows.filter((r) => r.classNames.includes(classFilter));
  }, [grid.rows, classFilter]);

  return (
    <div className={`${styles.surface} flex h-full flex-col p-5`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base" aria-hidden>
          👥
        </span>
        <h2 className="text-xs font-semibold tracking-[0.15em] text-[#7FA892]">
          가족별 진행
        </h2>
        <span className="ml-auto font-mono text-xs text-[#7FA892]">
          {classFilter
            ? `${rowsToShow.length}/${grid.rows.length}`
            : grid.rows.length}
        </span>
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
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
          <div className="text-5xl" aria-hidden>
            🌱
          </div>
          <div className="text-sm text-[#7FA892]">
            {grid.missions.length === 0
              ? "활성 미션이 없어요"
              : "참가자가 없어요"}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          {/* 좌측: 그리드 — 가족 많아도 모두 노출. 일정 높이 넘으면 내부 스크롤. */}
          <div
            className="min-w-0 flex-1 overflow-auto rounded-lg border border-[#1a2320]"
            style={{ maxHeight: isTvMode ? 720 : 520 }}
          >
            <table className="w-full border-collapse text-[11px]">
              <thead className="sticky top-0 z-20 bg-[#0e1513]">
                <tr>
                  <th className="sticky left-0 z-30 bg-[#0e1513] px-2 py-1.5 text-left font-semibold text-[#7FA892]">
                    가족
                  </th>
                  {grid.missions.map((m) => (
                    <th
                      key={m.id}
                      title={m.title}
                      className="bg-[#0e1513] px-1 py-1.5 text-center font-semibold text-[#7FA892]"
                    >
                      <span className="text-base" aria-hidden>
                        {m.icon ?? "🌱"}
                      </span>
                    </th>
                  ))}
                  <th className="bg-[#0e1513] px-2 py-1.5 text-right font-semibold text-[#7FA892]">
                    🌰
                  </th>
                </tr>
              </thead>
              <tbody>
                {rowsToShow.map((r) => {
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
                      className={`cursor-pointer border-t border-[#1a2320] transition hover:bg-[#0e1513] ${
                        isSelected
                          ? "bg-[#11251c]"
                          : isHovered
                            ? "bg-[#0e1513]"
                            : ""
                      }`}
                    >
                      <td className="sticky left-0 bg-inherit px-2 py-1.5 font-semibold text-[#e8f0e4]">
                        <span className="block max-w-[110px] truncate">
                          {r.displayName}
                        </span>
                        <span className="text-[9px] font-normal text-[#7FA892]">
                          ✓ {r.doneCount}/{grid.missions.length}
                        </span>
                      </td>
                      {grid.missions.map((m) => {
                        const state = r.perMission[m.id];
                        if (!state) {
                          return (
                            <td
                              key={m.id}
                              className="px-1 py-1 text-center text-[#3a4a44]"
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
              className={`w-full shrink-0 rounded-lg border bg-[#0e1513] p-3 lg:sticky lg:top-2 lg:w-[260px] ${
                isPinned
                  ? "border-emerald-500/40 ring-1 ring-emerald-500/20"
                  : "border-[#1f2a24] opacity-95"
              }`}
              onMouseEnter={() => {
                // 패널 위에 마우스 올린 동안엔 hover 유지 (행을 떠도 사라지지 않게).
                if (!isPinned) setHoveredUserId(previewRow.userId);
              }}
              onMouseLeave={() => {
                if (!isPinned) setHoveredUserId(null);
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-[#e8f0e4]">
                    {previewRow.displayName}
                  </h3>
                  <span
                    className={`text-[9px] font-semibold ${
                      isPinned ? "text-emerald-300" : "text-[#7FA892]"
                    }`}
                  >
                    {isPinned ? "📌 고정됨" : "👁 미리보기 (클릭 = 고정)"}
                  </span>
                </div>
                {isPinned && (
                  <button
                    type="button"
                    onClick={() => setSelectedUserId(null)}
                    className="rounded-full px-1.5 text-[10px] text-[#7FA892] hover:bg-[#1a2320]"
                    aria-label="고정 해제"
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="text-[10px] text-[#7FA892]">
                ✓ {previewRow.doneCount}/{grid.missions.length} 미션 완료 ·{" "}
                <span className={styles.neonAmber}>
                  🌰 {previewRow.totalAcorns}
                </span>
              </p>
              {previewRow.classNames.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {previewRow.classNames.map((cn) => (
                    <span
                      key={cn}
                      className="inline-flex items-center rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 ring-1 ring-emerald-500/30"
                    >
                      🐰 {cn}
                    </span>
                  ))}
                </div>
              )}

              {/* 미션별 상태 리스트 */}
              <ul className="mt-3 space-y-1">
                {grid.missions.map((m) => {
                  const state = previewRow.perMission[m.id];
                  return (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-[10px] text-[#a8c3b3]"
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
                        <span className="shrink-0 text-[9px] text-[#3a4a44]">
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
                  <div className="mt-3 text-[10px] font-semibold text-[#7FA892]">
                    📸 올린 사진 ({previewPhotos.length})
                    <span className="ml-1 font-normal text-[#5e7a6c]">
                      · 클릭하면 확대
                    </span>
                  </div>
                  <ul className="mt-1 grid grid-cols-3 gap-1">
                    {previewPhotos.slice(0, 6).map((p, i) => (
                      <li
                        key={p.submissionId}
                        className="aspect-square overflow-hidden rounded border border-[#1a2320]"
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
          ) : (
            // 아무 행도 hover/click 안 됐을 때 자리 차지용 안내 카드 (lg+ 만).
            <aside className="hidden w-full shrink-0 rounded-lg border border-dashed border-[#1f2a24] bg-[#0e1513]/60 p-3 lg:sticky lg:top-2 lg:block lg:w-[260px]">
              <p className="text-center text-[10px] text-[#5e7a6c]">
                👈 왼쪽 가족 이름 위에 마우스를 올리면
                <br />
                미리보기가 표시됩니다.
                <br />
                <span className="text-[#7FA892]">클릭하면 고정됩니다.</span>
              </p>
            </aside>
          )}
        </div>
      )}
      {lightbox}
    </div>
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
          : "border-[#1f2a24] bg-[#0e1513] text-[#7FA892] hover:border-[#2d4439] hover:text-[#a8c3b3]"
      }`}
    >
      <span>{label}</span>
      <span className="font-mono text-[9px] tabular-nums opacity-80">
        {count}
      </span>
    </button>
  );
}
