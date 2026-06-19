// 🎯 토리 빙고 — 관제실 위젯. LIVE 보드별 진행 요약 + TOP5 리더보드.
//
// snapshot 흐름이 아니라 직접 supabase 로드 (다른 위젯과 같은 패턴: fm-studio-embed).
// 보드 별 카드 1장. LIVE 없으면 위젯 자체 숨김 (return null).

import Link from "next/link";
import styles from "../control-room.module.css";
import {
  loadLiveBoardsForOrg,
  loadLeaderboard,
  loadEntriesForBoard,
} from "@/lib/bingo/queries";

type Props = {
  orgId: string;
  isTvMode: boolean;
};

export async function BingoTile({ orgId, isTvMode }: Props) {
  const boards = await loadLiveBoardsForOrg(orgId);
  if (boards.length === 0) return null;

  // 보드별로 리더보드 + entry 수 병렬 로드.
  const summaries = await Promise.all(
    boards.map(async (b) => {
      const [lb, entries] = await Promise.all([
        loadLeaderboard(b.id, 5),
        loadEntriesForBoard(b.id),
      ]);
      return { board: b, leaderboard: lb, entriesCount: entries.length };
    })
  );

  return (
    <div className={`${styles.surface} flex flex-col p-4`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base" aria-hidden>
          🎯
        </span>
        <h2
          className={`font-bold text-white ${
            isTvMode ? "text-[1em]" : "text-sm"
          }`}
        >
          토리 빙고
        </h2>
        <span className="rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
          진행중 {boards.length}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {summaries.map(({ board, leaderboard, entriesCount }) => {
          const totalCells = board.size * board.size;
          const finished = leaderboard.filter((l) => l.finished_at).length;
          const topProgress = leaderboard[0];
          return (
            <article
              key={board.id}
              className="rounded-xl border border-white/10 bg-white/5 p-3"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-200 ring-1 ring-amber-300/40">
                  {board.size}×{board.size}
                </span>
                <span className="rounded-full bg-violet-400/20 px-2 py-0.5 text-[10px] font-bold text-violet-200 ring-1 ring-violet-300/40">
                  {board.lines_to_win}줄 승리
                </span>
                <Link
                  href={`/org/${orgId}/bingo/${board.id}`}
                  className="ml-auto text-[10px] font-bold text-amber-200 hover:underline"
                >
                  편집 →
                </Link>
              </div>
              <p className="mt-2 truncate text-sm font-bold text-amber-100">
                {board.name}
              </p>
              {board.keyword_theme && (
                <p className="mt-0.5 truncate text-[10px] text-white/60">
                  🗝 {board.keyword_theme}
                </p>
              )}

              <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                <Stat label="등록" value={entriesCount} />
                <Stat label="진행" value={leaderboard.length} />
                <Stat label="완료" value={finished} highlight={finished > 0} />
              </div>

              {/* 선두 진행 바 */}
              {topProgress && (
                <div className="mt-2 rounded-lg bg-white/5 px-2 py-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="truncate font-semibold text-amber-200">
                      🥇{" "}
                      {topProgress.child_name
                        ? `${topProgress.child_name} 가족`
                        : topProgress.parent_name || "(이름 없음)"}
                    </span>
                    <span className="font-bold text-white">
                      {topProgress.lines_completed}줄 · {topProgress.cells_filled}/
                      {totalCells}칸
                    </span>
                  </div>
                  <div className="relative mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-emerald-600"
                      style={{
                        width: `${Math.min(100, (topProgress.cells_filled / totalCells) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* TOP 5 */}
              {leaderboard.length > 1 && (
                <ol className="mt-2 space-y-0.5">
                  {leaderboard.slice(1, 5).map((l, idx) => (
                    <li
                      key={l.user_id}
                      className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[10px]"
                    >
                      <span className="w-4 text-center font-bold text-white/40">
                        {idx + 2}
                      </span>
                      <span className="flex-1 truncate text-white/80">
                        {l.child_name
                          ? `${l.child_name} 가족`
                          : l.parent_name || "(이름 없음)"}
                      </span>
                      <span className="text-white/60">
                        {l.lines_completed}줄 · {l.cells_filled}칸
                      </span>
                      {l.finished_at && (
                        <span className="rounded-full bg-emerald-500/80 px-1 py-0 text-[8px] font-bold text-white">
                          ✓
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              {leaderboard.length === 0 && (
                <p className="mt-2 rounded-lg bg-white/5 px-2 py-2 text-center text-[10px] text-white/60">
                  아직 빙고판을 시작한 가족이 없어요
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md px-2 py-1 ${
        highlight ? "bg-amber-400/20 ring-1 ring-amber-300/60" : "bg-white/5"
      }`}
    >
      <p className="text-[9px] text-white/60">{label}</p>
      <p
        className={`text-sm font-bold ${
          highlight ? "text-amber-200" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
