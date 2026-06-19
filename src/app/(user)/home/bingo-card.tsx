// 참가자 홈 — 토리 빙고 진입 카드.
// 해당 기관의 LIVE 보드가 있을 때만 노출.
// 보드 1개면 바로 그 보드로, 여러 개면 /bingo 목록으로.

import Link from "next/link";
import {
  loadEntriesForBoard,
  loadEntryByUser,
  loadGridForUser,
  loadLiveBoardsForOrg,
} from "@/lib/bingo/queries";

interface Props {
  orgId: string;
  userId: string;
}

export async function BingoCard({ orgId, userId }: Props) {
  const boards = await loadLiveBoardsForOrg(orgId);
  if (boards.length === 0) return null;

  // 1개일 때는 보드 컨텍스트로 진입 + 진행 상황 표시.
  // 2개 이상이면 /bingo 목록으로.
  if (boards.length > 1) {
    return (
      <Link
        href="/bingo"
        className="block overflow-hidden rounded-3xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 via-amber-50 to-rose-50 p-5 shadow-sm transition active:scale-[0.995]"
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-rose-500/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            🎯 LIVE
          </span>
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-rose-700">
            진행중 {boards.length}
          </span>
        </div>
        <h2 className="mt-2 text-lg font-bold text-rose-900">
          토리 빙고 진행중!
        </h2>
        <p className="mt-1 text-xs text-rose-800/80">
          가족 사진+키워드로 즐기는 빙고 게임 — 참여해 보세요
        </p>
        <p className="mt-3 inline-flex items-center rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white">
          ▶ 참가하러 가기
        </p>
      </Link>
    );
  }

  const board = boards[0];
  const [myEntry, allEntries, gridState] = await Promise.all([
    loadEntryByUser(board.id, userId),
    loadEntriesForBoard(board.id),
    loadGridForUser(board.id, userId),
  ]);
  const totalCells = board.size * board.size;
  const filledCount = gridState.cells.length;
  const linesCompleted = gridState.grid?.lines_completed ?? 0;
  const finished = !!gridState.grid?.finished_at;
  const progressPct = Math.min(
    100,
    Math.round((linesCompleted / board.lines_to_win) * 100)
  );

  return (
    <Link
      href={`/bingo/${board.id}`}
      className="block overflow-hidden rounded-3xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 via-amber-50 to-rose-50 p-5 shadow-sm transition active:scale-[0.995]"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          🎯 LIVE
        </span>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-rose-700">
          {board.size}×{board.size}
        </span>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-violet-700">
          {board.lines_to_win}줄 완성
        </span>
        {finished && (
          <span className="ml-auto rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
            ✓ 완성
          </span>
        )}
      </div>
      <h2 className="mt-2 text-lg font-bold text-rose-900">
        🎯 {board.name}
      </h2>
      {board.keyword_theme && (
        <p className="mt-0.5 text-xs text-rose-800/80">
          🗝 {board.keyword_theme}
        </p>
      )}

      {!myEntry ? (
        <div className="mt-3 rounded-2xl bg-white/80 p-3">
          <p className="text-xs font-bold text-amber-800">
            📷 우리 가족 사진 등록부터 시작해요!
          </p>
          <p className="mt-0.5 text-[11px] text-amber-700/80">
            사진 한 장 + 키워드 한 줄이면 바로 참여돼요
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-1.5 rounded-2xl bg-white/80 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-rose-900">
              {linesCompleted} / {board.lines_to_win}줄 완성
            </span>
            <span className="text-rose-800/70">
              {filledCount} / {totalCells} 칸 채움 · 피드 {allEntries.length}
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-rose-100">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      <p className="mt-3 inline-flex items-center rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white">
        {!myEntry
          ? "🌟 우리 가족 등록하기"
          : finished
            ? "🏆 결과 보기"
            : "▶ 이어서 진행"}
      </p>
    </Link>
  );
}
