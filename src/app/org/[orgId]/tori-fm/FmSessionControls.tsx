"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  startFmBroadcastAction,
  stopFmBroadcastAction,
} from "@/lib/missions/review-actions";
import {
  playNextFromQueueAction,
  stopPlayingAction,
} from "@/lib/tori-fm/actions";

type Props = {
  sessionId: string;
  isLive: boolean;
  /**
   * QUEUED 항목 수 — [다음 곡] 활성/비활성 판정용.
   * 0이면 [다음 곡] 비활성 (큐 비어있음).
   */
  queuedCount: number;
  /** 현재 PLAYING 묶음의 row 수 — 없으면 [다음 곡]은 큐 첫 항목 시작용. */
  playingCount: number;
};

export function FmSessionControls({
  sessionId,
  isLive,
  queuedCount,
  playingCount,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>) {
    setMsg(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "처리 실패");
      }
    });
  }

  // 방송 종료 — "종료" 글자 입력 확인. 실수로 누르는 걸 막기 위함.
  function handleStop() {
    const input = window.prompt(
      "방송을 정말 종료하시겠어요?\n확인하려면 \"종료\" 라고 입력해 주세요."
    );
    if (input === null) return; // 취소
    if (input.trim() !== "종료") {
      setMsg('"종료"와 정확히 일치해야 방송을 종료할 수 있어요');
      return;
    }
    run(() => stopFmBroadcastAction(sessionId));
  }

  // [다음 곡] — 큐 첫 항목과 같은 song_normalized 묶음을 PLAYING 으로.
  //  (현재 PLAYING 묶음은 PLAYED 처리. 큐가 비어있으면 단순히 정지.)
  const canPlayNext = queuedCount > 0 || playingCount > 0;

  // [현재 곡 정지] — 큐가 비어있을 때만 별도 노출 (단순 정지)
  const showStop = playingCount > 0 && queuedCount === 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {isLive ? (
          <button
            type="button"
            onClick={handleStop}
            disabled={isPending}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            ⏹ 방송 종료
          </button>
        ) : (
          <button
            type="button"
            onClick={() => run(() => startFmBroadcastAction(sessionId))}
            disabled={isPending}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            📻 방송 시작
          </button>
        )}
        <button
          type="button"
          onClick={() => run(() => playNextFromQueueAction(sessionId))}
          disabled={isPending || !canPlayNext}
          title={
            queuedCount === 0 && playingCount === 0
              ? "방송 큐에 곡이 없어요. 모더레이션에서 [방송 큐에 추가]를 먼저 눌러주세요."
              : queuedCount === 0
                ? "큐가 비어있어요 — 누르면 현재 곡이 끝납니다"
                : "큐의 다음 곡(같은 곡 사연 묶음)을 재생"
          }
          className="rounded-xl bg-amber-400 px-3 py-2 text-sm font-bold text-[#0B1538] shadow-md transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ⏭ 다음 곡{queuedCount > 0 ? ` (${queuedCount})` : ""}
        </button>
        {showStop && (
          <button
            type="button"
            onClick={() => run(() => stopPlayingAction(sessionId))}
            disabled={isPending}
            className="rounded-xl border border-white/20 bg-white/[0.06] px-3 py-2 text-sm font-bold text-white/85 transition hover:bg-white/[0.12] disabled:opacity-40"
          >
            ⏹ 현재 곡 정지
          </button>
        )}
      </div>
      {msg && (
        <p className="text-[11px] font-semibold text-rose-300" role="alert">
          {msg}
        </p>
      )}
    </div>
  );
}
