import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireEventContext } from "@/lib/event-context";
import {
  loadBoardById,
  loadEntriesForBoard,
  loadEntryByUser,
  loadGridForUser,
  loadLeaderboard,
} from "@/lib/bingo/queries";
import { loadSignedEntryIds } from "@/lib/bingo/grid-stats";
import { BINGO_STATUS_META } from "@/lib/bingo/types";
import { EntryForm } from "./entry-form";
import { PlayBoard } from "./play-board";
import { BingoCountdown } from "./countdown";
import { LiveAutoRefresh } from "@/app/org/[orgId]/bingo/[boardId]/live/auto-refresh";

export const dynamic = "force-dynamic";

export default async function BingoPlayPage({
  params,
}: {
  params: Promise<{ eventId: string; boardId: string }>;
}) {
  const { eventId, boardId } = await params;
  const ctx = await requireEventContext(eventId);
  const user = ctx.user;

  const board = await loadBoardById(boardId);
  if (!board) notFound();
  // 이 행사를 연 기관의 보드만 진행 가능. 다른 기관 보드 링크는 목록으로.
  if (board.org_id !== ctx.orgId) {
    redirect(ctx.href("/bingo"));
  }

  const [myEntry, allEntries, gridState, leaderboard] = await Promise.all([
    loadEntryByUser(boardId, user.id),
    loadEntriesForBoard(boardId),
    loadGridForUser(boardId, user.id),
    loadLeaderboard(boardId, 10),
  ]);

  const meta = BINGO_STATUS_META[board.status];
  const isLive = board.status === "LIVE";

  // 체크 = 자동 ⭕(CIRCLE 호명) ∪ 내가 QR 인증한 entry ∪ 내 QR 사진(주인 자동).
  const circleCalledIds = allEntries
    .filter((e) => e.called_at && e.call_mode === "CIRCLE")
    .map((e) => e.id);
  const signedIds = await loadSignedEntryIds(boardId, user.id);
  const checkedSet = new Set([...circleCalledIds, ...signedIds]);
  // 내 사진이 QR로 호명됐으면 주인인 나는 자동 ⭕.
  if (myEntry?.called_at && myEntry.call_mode === "QR") {
    checkedSet.add(myEntry.id);
  }
  const checkedEntryIds = Array.from(checkedSet);
  // QR 방식으로 호명된 그림 = 참가자 인증 미션.
  const qrReleasedIds = allEntries
    .filter((e) => e.called_at && e.call_mode === "QR")
    .map((e) => e.id);

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-4">
      <LiveAutoRefresh intervalMs={4000} />

      <nav className="text-[11px] text-[#8B7F75]">
        <Link href={ctx.href("/bingo")} className="hover:text-[#2D5A3D]">
          🎯 빙고
        </Link>
        <span className="mx-1">/</span>
        <span className="font-semibold text-[#2D5A3D]">{board.name}</span>
      </nav>

      {/* 헤더 */}
      <header className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-white to-emerald-50 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${meta.chip}`}
          >
            {meta.label}
          </span>
          <span className="rounded-full bg-[#FAE7D0] px-2 py-0.5 text-[10px] font-bold text-[#6B4423]">
            {board.size}×{board.size}
          </span>
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200">
            {board.lines_to_win}줄 완성
          </span>
        </div>
        <h1 className="mt-2 text-xl font-bold text-[#2D5A3D]">{board.name}</h1>
        {board.keyword_theme && (
          <p className="mt-1 text-xs text-[#6B6560]">🗝 {board.keyword_theme}</p>
        )}
      </header>

      {!isLive && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          ⚠ 지금은 진행 중이 아니에요. 운영자가 시작하면 참여할 수 있어요.
        </div>
      )}

      {/* 배열 타이머 카운트다운 (타이머 세팅됐을 때만 노출) */}
      {isLive && board.arrange_ends_at && (
        <BingoCountdown arrangeEndsAt={board.arrange_ends_at} />
      )}

      {/* 1단계: 우리 가족 등록 */}
      {isLive && (
        <EntryForm
          boardId={boardId}
          keywordTheme={board.keyword_theme}
          existingEntry={myEntry}
        />
      )}

      {/* 2단계: 내 빙고판 + 피드 — 배열 타이머가 도는 동안만 이동 가능, 그 외엔 잠금. */}
      {isLive &&
        (() => {
          const locked = !(
            board.arrange_ends_at &&
            new Date(board.arrange_ends_at).getTime() > Date.now()
          );
          return (
            <PlayBoard
              boardId={boardId}
              size={board.size}
              linesToWin={board.lines_to_win}
              myUserId={user.id}
              myEntry={myEntry}
              entries={allEntries}
              grid={gridState.grid}
              cells={gridState.cells}
              calledEntryIds={checkedEntryIds}
              qrReleasedIds={qrReleasedIds}
              locked={locked}
            />
          );
        })()}

      {/* 순위 */}
      {board.show_ranking && leaderboard.length > 0 && (
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-[#2D5A3D]">🏆 진행 순위 TOP 10</h2>
          <ol className="mt-2 space-y-1">
            {leaderboard.map((l, idx) => {
              const isMe = l.user_id === user.id;
              return (
                <li
                  key={l.user_id}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                    isMe ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-[#FFFDF8]"
                  }`}
                >
                  <span className="w-5 text-center font-bold text-[#6B4423]">
                    {idx + 1}
                  </span>
                  <span className="flex-1 font-semibold text-[#2D5A3D]">
                    {l.child_name ? `${l.child_name} 가족` : l.parent_name || "(이름 없음)"}
                    {isMe && (
                      <span className="ml-1 text-[10px] font-bold text-emerald-700">
                        (나)
                      </span>
                    )}
                  </span>
                  <span className="text-[#6B6560]">
                    {l.lines_completed}줄 ·{" "}
                    <span className="font-bold text-rose-500">⭕{l.cells_checked}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
