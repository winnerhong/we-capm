import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import {
  loadBoardById,
  loadEntriesForBoard,
  loadLeaderboard,
} from "@/lib/bingo/queries";
import {
  setBingoStatusAction,
  updateBingoBoardAction,
  deleteBingoBoardAction,
} from "@/lib/bingo/actions";
import { BINGO_STATUS_META } from "@/lib/bingo/types";
import { BoardForm } from "../new/board-form";

export const dynamic = "force-dynamic";

export default async function OrgBingoDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; boardId: string }>;
}) {
  const { orgId, boardId } = await params;
  await requireOrg();
  const board = await loadBoardById(boardId);
  if (!board || board.org_id !== orgId) notFound();

  const [entries, leaderboard] = await Promise.all([
    loadEntriesForBoard(boardId),
    loadLeaderboard(boardId, 10),
  ]);
  const meta = BINGO_STATUS_META[board.status];

  async function updateAction(formData: FormData) {
    "use server";
    await updateBingoBoardAction(boardId, formData);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <nav className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}/bingo`} className="hover:text-[#2D5A3D]">
          🎯 빙고
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">{board.name}</span>
      </nav>

      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${meta.chip}`}
              >
                {meta.label}
              </span>
              <span className="rounded-full bg-[#FAE7D0] px-2 py-0.5 text-[10px] font-bold text-[#6B4423]">
                {board.size}×{board.size}
              </span>
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200">
                {board.lines_to_win}줄 승리
              </span>
              {board.show_ranking && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
                  🏆 순위 공개
                </span>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-[#2D5A3D]">
              {board.name}
            </h1>
            {board.keyword_theme && (
              <p className="mt-1 text-sm text-[#6B6560]">🗝 {board.keyword_theme}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusButtons
              boardId={boardId}
              status={board.status}
            />
            {board.status === "LIVE" && (
              <Link
                href={`/org/${orgId}/control-room`}
                className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700"
                title="모든 진행 상황은 메인 관제실에서 확인합니다"
              >
                📡 관제실
              </Link>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat icon="🎒" label="등록 가족" value={entries.length} />
          <Stat
            icon="✅"
            label="완료 가족"
            value={leaderboard.filter((l) => l.finished_at).length}
          />
          <Stat
            icon="🏆"
            label="선두 줄 수"
            value={leaderboard[0]?.lines_completed ?? 0}
          />
        </div>
      </section>

      {/* 편집 */}
      <details className="rounded-2xl border border-[#D4E4BC] bg-white shadow-sm" open={board.status === "DRAFT"}>
        <summary className="cursor-pointer rounded-2xl bg-[#FFF8F0] p-4 text-sm font-bold text-[#2D5A3D]">
          ✏️ 보드 편집
        </summary>
        <div className="border-t border-[#D4E4BC] p-4">
          <BoardForm
            action={updateAction}
            initial={{
              name: board.name,
              size: board.size,
              lines_to_win: board.lines_to_win,
              keyword_theme: board.keyword_theme ?? "",
              show_ranking: board.show_ranking,
            }}
          />
        </div>
      </details>

      {/* 리더보드 */}
      {leaderboard.length > 0 && (
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-[#2D5A3D]">🏆 자동 리더보드 (TOP 10)</h2>
          <ol className="mt-3 space-y-1.5">
            {leaderboard.map((l, idx) => (
              <li
                key={l.user_id}
                className="flex items-center gap-3 rounded-lg bg-[#FFFDF8] px-3 py-2"
              >
                <span className="w-6 text-center text-xs font-bold text-[#6B4423]">
                  {idx + 1}
                </span>
                <span className="flex-1 text-sm font-semibold text-[#2D5A3D]">
                  {l.child_name ? `${l.child_name} 가족` : l.parent_name || "(이름 없음)"}
                </span>
                <span className="text-xs text-[#6B6560]">
                  채움 {l.cells_filled} · 줄 {l.lines_completed}
                </span>
                {l.finished_at && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                    ✓ 완료
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 위험 영역 */}
      <section className="rounded-2xl border-2 border-rose-200 bg-rose-50/60 p-5 shadow-sm">
        <h2 className="text-sm font-bold text-rose-800">⚠️ 위험 영역</h2>
        <p className="mt-1 text-xs text-rose-700/80">
          삭제하면 가족 사진·키워드·빙고판 진행 상황이 모두 사라져요.
        </p>
        <form
          action={async () => {
            "use server";
            await deleteBingoBoardAction(boardId);
          }}
          className="mt-3"
        >
          <button
            type="submit"
            className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100"
          >
            🗑 보드 삭제
          </button>
        </form>
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg bg-[#F4EFE8] p-3">
      <div className="text-[10px] text-[#6B4423]">
        {icon} {label}
      </div>
      <div className="mt-0.5 text-xl font-bold text-[#2D5A3D]">{value}</div>
    </div>
  );
}

function StatusButtons({
  boardId,
  status,
}: {
  boardId: string;
  status: "DRAFT" | "LIVE" | "ENDED";
}) {
  if (status === "DRAFT") {
    return (
      <form
        action={async () => {
          "use server";
          await setBingoStatusAction(boardId, "LIVE");
        }}
      >
        <button
          type="submit"
          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
        >
          🚀 시작 (LIVE)
        </button>
      </form>
    );
  }
  if (status === "LIVE") {
    return (
      <form
        action={async () => {
          "use server";
          await setBingoStatusAction(boardId, "ENDED");
        }}
      >
        <button
          type="submit"
          className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700"
        >
          🛑 종료
        </button>
      </form>
    );
  }
  return (
    <form
      action={async () => {
        "use server";
        await setBingoStatusAction(boardId, "LIVE");
      }}
    >
      <button
        type="submit"
        className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] hover:bg-[#F5F1E8]"
      >
        ↩️ 다시 진행
      </button>
    </form>
  );
}
