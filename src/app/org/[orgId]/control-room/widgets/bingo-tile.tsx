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
  loadAllGridCellsForBoard,
} from "@/lib/bingo/queries";
import { loadTemplatesForOrg } from "@/lib/bingo/template-queries";
import { loadSignedEntryIdsByUser } from "@/lib/bingo/grid-stats";
import { BingoCaller } from "./bingo-caller";
import { BingoBoardPreview, type PreviewCell } from "./bingo-board-preview";
import { BingoTimerControl } from "../../bingo/[boardId]/timer-control";
import { OrgTilesEditor } from "../../bingo/[boardId]/org-tiles-editor";

type Props = {
  orgId: string;
  isTvMode: boolean;
};

export async function BingoTile({ orgId, isTvMode }: Props) {
  const boards = await loadLiveBoardsForOrg(orgId);
  if (boards.length === 0) return null;

  // 기관이 불러올 수 있는 템플릿 (전역 + 기관 전용) — 운영 도구에서 사용.
  const templates = await loadTemplatesForOrg(orgId);

  // 보드별로 리더보드 + entry + 전체 grid 셀 병렬 로드.
  const summaries = await Promise.all(
    boards.map(async (b) => {
      const [lb, entries, allCells, signedByUser] = await Promise.all([
        loadLeaderboard(b.id, 5),
        loadEntriesForBoard(b.id),
        loadAllGridCellsForBoard(b.id),
        loadSignedEntryIdsByUser(b.id),
      ]);

      // 체크 = 자동 ⭕(CIRCLE) ∪ 그 가족 QR 인증 ∪ 내 QR 사진(주인 자동).
      const isCheckedFor = (userId: string, e: (typeof entries)[number]) =>
        (!!e.called_at && e.call_mode === "CIRCLE") ||
        (signedByUser.get(userId)?.has(e.id) ?? false) ||
        (!!e.called_at && e.call_mode === "QR" && e.user_id === userId);

      // entry id → 사진/키워드/호명 여부.
      const entryById = new Map(entries.map((e) => [e.id, e]));
      // user id → 미리보기 셀 목록.
      const previewByUser = new Map<string, PreviewCell[]>();
      for (const c of allCells) {
        const e = entryById.get(c.entry_id);
        if (!e) continue;
        const list = previewByUser.get(c.user_id) ?? [];
        list.push({
          position: c.position,
          photo_url: e.photo_url,
          keyword: e.keyword,
          called: isCheckedFor(c.user_id, e),
          is_org: e.is_org,
        });
        previewByUser.set(c.user_id, list);
      }

      // 고정 배치된 기관 타일 — 모든 가족 판 미리보기에 오버레이. (체크는 가족별)
      const fixedEntries = entries.filter(
        (e) => e.is_org && e.fixed_position != null
      );
      const fixedCellsFor = (userId: string): PreviewCell[] =>
        fixedEntries.map((e) => ({
          position: e.fixed_position as number,
          photo_url: e.photo_url,
          keyword: e.keyword,
          called: isCheckedFor(userId, e),
          is_org: true,
        }));

      return { board: b, leaderboard: lb, entries, previewByUser, fixedCellsFor };
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
        {summaries.map(({ board, leaderboard, entries, previewByUser, fixedCellsFor }) => {
          const entriesCount = entries.length;
          const nameOf = (l: (typeof leaderboard)[number]) =>
            l.child_name ? `${l.child_name} 가족` : l.parent_name || "(이름 없음)";
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
                {(() => {
                  if (!board.arrange_ends_at) return null;
                  const ms =
                    new Date(board.arrange_ends_at).getTime() - Date.now();
                  if (ms > 0) {
                    const min = Math.ceil(ms / 60_000);
                    return (
                      <span className="rounded-full bg-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-100 ring-1 ring-rose-300/60">
                        ⏱ {min}분 남음
                      </span>
                    );
                  }
                  return (
                    <span className="rounded-full bg-zinc-500/30 px-2 py-0.5 text-[10px] font-bold text-zinc-100 ring-1 ring-zinc-300/40">
                      🔒 잠금
                    </span>
                  );
                })()}
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
                <BingoBoardPreview
                  size={board.size}
                  name={`🥇 ${nameOf(topProgress)}`}
                  cells={[
                    ...(previewByUser.get(topProgress.user_id) ?? []),
                    ...fixedCellsFor(topProgress.user_id),
                  ]}
                >
                  <div className="mt-2 rounded-lg bg-white/5 px-2 py-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="truncate font-semibold text-amber-200">
                        🥇 {nameOf(topProgress)}
                      </span>
                      <span className="font-bold text-white">
                        {topProgress.lines_completed}줄 ·{" "}
                        <span className="text-rose-300">⭕{topProgress.cells_checked}</span> ·{" "}
                        {topProgress.cells_filled}/{totalCells}칸
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
                </BingoBoardPreview>
              )}

              {/* TOP 5 */}
              {leaderboard.length > 1 && (
                <ol className="mt-2 space-y-0.5">
                  {leaderboard.slice(1, 5).map((l, idx) => (
                    <li key={l.user_id}>
                      <BingoBoardPreview
                        size={board.size}
                        name={`${idx + 2}위 ${nameOf(l)}`}
                        cells={[
                          ...(previewByUser.get(l.user_id) ?? []),
                          ...fixedCellsFor(l.user_id),
                        ]}
                      >
                        <div className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[10px] hover:bg-white/5">
                          <span className="w-4 text-center font-bold text-white/40">
                            {idx + 2}
                          </span>
                          <span className="flex-1 truncate text-white/80">
                            {nameOf(l)}
                          </span>
                          <span className="text-white/60">
                            {l.lines_completed}줄 ·{" "}
                            <span className="font-bold text-rose-300">
                              ⭕{l.cells_checked}
                            </span>{" "}
                            · {l.cells_filled}칸
                          </span>
                          {l.finished_at && (
                            <span className="rounded-full bg-emerald-500/80 px-1 py-0 text-[8px] font-bold text-white">
                              ✓
                            </span>
                          )}
                        </div>
                      </BingoBoardPreview>
                    </li>
                  ))}
                </ol>
              )}

              {leaderboard.length === 0 && (
                <p className="mt-2 rounded-lg bg-white/5 px-2 py-2 text-center text-[10px] text-white/60">
                  아직 빙고판을 시작한 가족이 없어요
                </p>
              )}

              {/* 🎤 그림 호명 / ✍️ 싸인 받기 — 모든 가족 판 체크 제어 */}
              <BingoCaller boardId={board.id} entries={entries} />

              {/* ⚙ 운영 도구 — 배열 타이머 · 기관 문구 타일 */}
              <details className="mt-2 rounded-lg bg-black/20 ring-1 ring-white/10">
                  <summary className="cursor-pointer select-none px-2 py-1.5 text-[10px] font-bold text-amber-200">
                    ⚙ 운영 도구 — 배열 타이머 · 기관 문구 타일
                  </summary>
                  <div className="space-y-2 p-2 pt-0">
                    <BingoTimerControl
                      boardId={board.id}
                      arrangeEndsAt={board.arrange_ends_at}
                      dark
                    />
                    <OrgTilesEditor
                      boardId={board.id}
                      size={board.size}
                      tiles={entries.filter((e) => e.is_org)}
                      templates={templates}
                      dark
                    />
                  </div>
                </details>
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
