"use client";

// 내 빙고판 + 가족 피드.
//
// 인터랙션 모델 (드래그 없이 탭만으로):
//   1) 피드 카드 탭 → "어디로 옮길까요?" 모드 진입 → 내 판의 빈 칸 탭 → 배치
//   2) 내 판의 채운 칸 탭 → 메뉴(다른 칸으로 이동 / 피드로 빼기)
//   3) "다른 칸으로 이동" → 빈 칸 탭하면 거기로 이동, 채운 칸 탭하면 스왑
//
// 모바일 우선 (드래그는 phase 2 폴리시).

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { computeLineFlags } from "@/lib/bingo/lines";
import {
  placeEntryOnCellAction,
  removeEntryFromCellAction,
  swapBingoCellsAction,
} from "@/lib/bingo/participant-actions";
import type {
  BingoGridCellRow,
  BingoGridRow,
  BingoEntryRow,
  BingoSize,
} from "@/lib/bingo/types";
import type { BingoEntryWithUser } from "@/lib/bingo/queries";

type Props = {
  boardId: string;
  size: BingoSize;
  linesToWin: number;
  myUserId: string;
  myEntry: BingoEntryRow | null;
  entries: BingoEntryWithUser[];
  grid: BingoGridRow | null;
  cells: BingoGridCellRow[];
};

type SelectMode =
  | { kind: "idle" }
  | { kind: "place"; entryId: string } // 피드에서 카드 선택 → 빈 칸 클릭 대기
  | { kind: "move"; fromPos: number }; // 내 판 셀 선택 → 이동 대상 대기

export function PlayBoard({
  boardId,
  size,
  linesToWin,
  myUserId,
  myEntry,
  entries,
  grid,
  cells,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<SelectMode>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // position → entry 매핑.
  const cellByPosition = useMemo(() => {
    const m = new Map<number, BingoGridCellRow>();
    for (const c of cells) m.set(c.position, c);
    return m;
  }, [cells]);

  // entry id → entry 매핑 (피드 사용).
  const entryById = useMemo(() => {
    const m = new Map<string, BingoEntryWithUser>();
    for (const e of entries) m.set(e.id, e);
    return m;
  }, [entries]);

  // 내 판에 이미 배치된 entry id 셋.
  const placedEntryIds = useMemo(() => {
    return new Set(cells.map((c) => c.entry_id));
  }, [cells]);

  // 라인 강조용 flag.
  const lineFlags = useMemo(
    () =>
      computeLineFlags(
        size,
        cells.map((c) => c.position)
      ),
    [size, cells]
  );

  const totalCells = size * size;
  const filledCount = cells.length;
  const linesCompleted = grid?.lines_completed ?? 0;
  const finished = !!grid?.finished_at;

  function clearMode() {
    setMode({ kind: "idle" });
    setError(null);
  }

  function onFeedCardClick(entry: BingoEntryWithUser) {
    setError(null);
    if (entry.user_id === myUserId) {
      setError("우리 가족 사진은 다른 가족 판에만 올라가요");
      return;
    }
    if (placedEntryIds.has(entry.id)) {
      setError("이미 내 빙고판에 올렸어요");
      return;
    }
    setMode({ kind: "place", entryId: entry.id });
  }

  function onCellClick(position: number) {
    setError(null);
    const existing = cellByPosition.get(position);

    if (mode.kind === "place") {
      // 피드에서 선택한 entry 를 이 칸에 배치 (덮어쓰기 OK).
      const entryId = mode.entryId;
      startTransition(async () => {
        try {
          await placeEntryOnCellAction(boardId, position, entryId);
          clearMode();
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "배치 실패");
        }
      });
      return;
    }

    if (mode.kind === "move") {
      // 같은 칸 다시 누르면 모드 종료.
      if (position === mode.fromPos) {
        clearMode();
        return;
      }
      const fromPos = mode.fromPos;
      startTransition(async () => {
        try {
          await swapBingoCellsAction(boardId, fromPos, position);
          clearMode();
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "이동 실패");
        }
      });
      return;
    }

    // idle 모드.
    if (existing) {
      // 채운 칸 → 이동 모드 진입.
      setMode({ kind: "move", fromPos: position });
    }
    // 빈 칸은 idle 에서 아무 동작 안 함.
  }

  function onRemoveCell(position: number) {
    setError(null);
    startTransition(async () => {
      try {
        await removeEntryFromCellAction(boardId, position);
        clearMode();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "제거 실패");
      }
    });
  }

  return (
    <section className="space-y-3">
      {/* 진행도 카드 */}
      <div className="rounded-2xl border border-[#D4E4BC] bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[#2D5A3D]">
            {linesCompleted} / {linesToWin}줄 완성
          </span>
          <span className="text-[#6B6560]">
            {filledCount} / {totalCells} 칸 채움
          </span>
        </div>
        <div className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#F4EFE8]">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
            style={{
              width: `${Math.min(100, (linesCompleted / linesToWin) * 100)}%`,
            }}
          />
        </div>
        {finished && (
          <p className="mt-2 rounded-lg bg-emerald-50 px-2 py-1.5 text-center text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
            🎉 빙고 완성! 축하해요
          </p>
        )}
      </div>

      {/* 모드 안내 */}
      {mode.kind !== "idle" && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
          {mode.kind === "place"
            ? "📍 사진을 올릴 칸을 선택해 주세요"
            : "📍 옮길 칸을 선택해 주세요 (같은 칸 다시 누르면 취소)"}
          <button
            type="button"
            onClick={clearMode}
            className="ml-2 rounded bg-white px-2 py-0.5 text-[10px] font-bold text-amber-700 hover:bg-amber-100"
          >
            취소
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
          ⚠ {error}
        </div>
      )}

      {/* 내 빙고판 */}
      <div className="rounded-2xl border border-[#D4E4BC] bg-white p-3 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-[#2D5A3D]">📋 내 빙고판</h2>
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: totalCells }, (_, pos) => {
            const cell = cellByPosition.get(pos);
            const entry = cell ? entryById.get(cell.entry_id) : null;
            const row = Math.floor(pos / size);
            const col = pos % size;
            const onLine =
              lineFlags.rows[row] ||
              lineFlags.cols[col] ||
              (row === col && lineFlags.diag) ||
              (row + col === size - 1 && lineFlags.antiDiag);
            const isSourceOfMove =
              mode.kind === "move" && mode.fromPos === pos;
            const isClickable =
              !pending &&
              (mode.kind === "place" ||
                (mode.kind === "move" && pos !== mode.fromPos) ||
                (mode.kind === "idle" && !!cell));
            return (
              <button
                key={pos}
                type="button"
                onClick={() => onCellClick(pos)}
                disabled={!isClickable && mode.kind === "idle" && !cell}
                className={`relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                  isSourceOfMove
                    ? "border-amber-500 ring-2 ring-amber-300"
                    : onLine && cell
                      ? "border-emerald-500 ring-2 ring-emerald-300"
                      : cell
                        ? "border-[#D4E4BC]"
                        : mode.kind === "place"
                          ? "border-amber-300 bg-amber-50/40"
                          : "border-dashed border-[#D4E4BC] bg-[#FFFDF8]"
                } ${isClickable ? "cursor-pointer hover:brightness-105" : ""}`}
              >
                {entry ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={entry.photo_url}
                      alt={entry.keyword}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5">
                      <p className="truncate text-[8px] font-bold text-white">
                        {entry.keyword}
                      </p>
                    </div>
                  </>
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#B0A89C]">
                    {pos + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* move 모드 — 선택한 셀의 추가 액션 */}
        {mode.kind === "move" && (
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={() => onRemoveCell(mode.fromPos)}
              disabled={pending}
              className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50"
            >
              🗑 선택한 칸 비우기
            </button>
          </div>
        )}
      </div>

      {/* 피드 */}
      <div className="rounded-2xl border border-[#D4E4BC] bg-white p-3 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-[#2D5A3D]">
          🌳 가족 피드 ({entries.length})
        </h2>
        {entries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#D4E4BC] bg-[#FFFDF8] px-3 py-6 text-center text-xs text-[#8B7F75]">
            아직 등록된 가족이 없어요. 첫 번째 가족이 되어 보세요!
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {entries.map((e) => {
              const isMine = e.user_id === myUserId;
              const isPlaced = placedEntryIds.has(e.id);
              const isSelected = mode.kind === "place" && mode.entryId === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onFeedCardClick(e)}
                  disabled={pending || isMine || isPlaced}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                    isSelected
                      ? "border-amber-500 ring-2 ring-amber-300"
                      : isMine
                        ? "border-emerald-300 opacity-70"
                        : isPlaced
                          ? "border-zinc-200 opacity-40"
                          : "border-[#D4E4BC] hover:border-[#2D5A3D]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={e.photo_url}
                    alt={e.keyword}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5">
                    <p className="truncate text-[8px] font-bold text-white">
                      {e.keyword}
                    </p>
                  </div>
                  {isMine && (
                    <span className="absolute left-1 top-1 rounded-full bg-emerald-500 px-1 py-0 text-[8px] font-bold text-white">
                      우리
                    </span>
                  )}
                  {isPlaced && !isMine && (
                    <span className="absolute right-1 top-1 rounded-full bg-zinc-700/80 px-1 py-0 text-[8px] font-bold text-white">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-[10px] text-[#8B7F75]">
          {myEntry
            ? "📌 피드에서 사진 → 내 판의 빈 칸 순서로 탭하세요. 내 판의 채운 칸을 탭하면 이동/비우기가 돼요."
            : "📌 먼저 위에서 우리 가족 사진+키워드를 등록해야 빙고가 시작돼요."}
        </p>
      </div>
    </section>
  );
}
