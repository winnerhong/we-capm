"use client";

import { useMemo, useState } from "react";
import type {
  ControlRoomFamilyRow,
  ControlRoomFamilyGrid,
  ControlRoomPhotoItem,
  FamilyMissionCellState,
} from "@/lib/control-room/types";
import { fmtClockKstAlways } from "@/lib/datetime/kst";
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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const selectedRow = useMemo(
    () => (selectedUserId ? grid.rows.find((r) => r.userId === selectedUserId) ?? null : null),
    [selectedUserId, grid.rows]
  );

  const selectedPhotos = useMemo(() => {
    if (!selectedRow) return [];
    // photo wall 에 그 가족의 사진들만 필터 — userDisplayName 매칭.
    // (display name 이 같은 다른 가족이 거의 없다는 가정. 정확한 매칭 위해
    //  앞으로 photoWall row 에 userId 를 추가하는 게 더 안전하지만 일단 표시명 기준)
    return photos.filter((p) => p.userDisplayName === selectedRow.displayName);
  }, [selectedRow, photos]);

  const rowsToShow = grid.rows;

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
          {grid.rows.length}
        </span>
      </div>

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
          {/* 좌측: 그리드 */}
          <div className="min-w-0 flex-1 overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-[#0e1513] px-2 py-1.5 text-left font-semibold text-[#7FA892]">
                    가족
                  </th>
                  {grid.missions.map((m) => (
                    <th
                      key={m.id}
                      title={m.title}
                      className="px-1 py-1.5 text-center font-semibold text-[#7FA892]"
                    >
                      <span className="text-base" aria-hidden>
                        {m.icon ?? "🌱"}
                      </span>
                    </th>
                  ))}
                  <th className="px-2 py-1.5 text-right font-semibold text-[#7FA892]">
                    🌰
                  </th>
                </tr>
              </thead>
              <tbody>
                {rowsToShow.slice(0, isTvMode ? 20 : 14).map((r) => {
                  const isSelected = r.userId === selectedUserId;
                  return (
                    <tr
                      key={r.userId}
                      onClick={() =>
                        setSelectedUserId(isSelected ? null : r.userId)
                      }
                      className={`cursor-pointer border-t border-[#1a2320] transition hover:bg-[#0e1513] ${
                        isSelected ? "bg-[#11251c]" : ""
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

          {/* 우측: 드릴다운 */}
          {selectedRow && (
            <aside className="w-full shrink-0 rounded-lg border border-[#1f2a24] bg-[#0e1513] p-3 lg:w-[260px]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="truncate text-sm font-bold text-[#e8f0e4]">
                  {selectedRow.displayName}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedUserId(null)}
                  className="rounded-full px-1.5 text-[10px] text-[#7FA892] hover:bg-[#1a2320]"
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>
              <p className="text-[10px] text-[#7FA892]">
                ✓ {selectedRow.doneCount}/{grid.missions.length} 미션 완료 ·{" "}
                <span className={styles.neonAmber}>
                  🌰 {selectedRow.totalAcorns}
                </span>
              </p>

              {/* 미션별 상태 리스트 */}
              <ul className="mt-3 space-y-1">
                {grid.missions.map((m) => {
                  const state = selectedRow.perMission[m.id];
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

              {/* 이 가족의 사진 */}
              {selectedPhotos.length > 0 && (
                <>
                  <div className="mt-3 text-[10px] font-semibold text-[#7FA892]">
                    📸 올린 사진 ({selectedPhotos.length})
                  </div>
                  <ul className="mt-1 grid grid-cols-3 gap-1">
                    {selectedPhotos.slice(0, 6).map((p) => (
                      <li
                        key={p.submissionId}
                        className="aspect-square overflow-hidden rounded border border-[#1a2320]"
                        title={`${p.missionTitle} · ${fmtClockKstAlways(p.submittedAt)}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt={p.missionTitle}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
