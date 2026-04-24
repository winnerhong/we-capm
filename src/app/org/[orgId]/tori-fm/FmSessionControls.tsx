"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setCurrentQueueAction,
  startFmBroadcastAction,
  stopFmBroadcastAction,
} from "@/lib/missions/review-actions";

type Props = {
  sessionId: string;
  isLive: boolean;
  currentQueueId: string | null;
  approvedQueueIds: string[]; // ordered
};

export function FmSessionControls({
  sessionId,
  isLive,
  currentQueueId,
  approvedQueueIds,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const currentIdx = currentQueueId
    ? approvedQueueIds.indexOf(currentQueueId)
    : -1;

  function run(fn: () => Promise<void>) {
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

  function next() {
    if (approvedQueueIds.length === 0) return;
    const nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % approvedQueueIds.length;
    run(() => setCurrentQueueAction(sessionId, approvedQueueIds[nextIdx]));
  }

  function prev() {
    if (approvedQueueIds.length === 0) return;
    const prevIdx =
      currentIdx < 0
        ? approvedQueueIds.length - 1
        : (currentIdx - 1 + approvedQueueIds.length) % approvedQueueIds.length;
    run(() => setCurrentQueueAction(sessionId, approvedQueueIds[prevIdx]));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {isLive ? (
          <button
            type="button"
            onClick={() => run(() => stopFmBroadcastAction(sessionId))}
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
          onClick={prev}
          disabled={isPending || approvedQueueIds.length === 0}
          className="rounded-xl border border-[#2D5A3D] bg-white px-3 py-2 text-sm font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-40"
        >
          ⏮ 이전 곡
        </button>
        <button
          type="button"
          onClick={next}
          disabled={isPending || approvedQueueIds.length === 0}
          className="rounded-xl border border-[#2D5A3D] bg-white px-3 py-2 text-sm font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-40"
        >
          ⏭ 다음 곡
        </button>
      </div>
      {msg && (
        <p className="text-[11px] font-semibold text-rose-700" role="alert">
          {msg}
        </p>
      )}
    </div>
  );
}
