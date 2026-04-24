"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveRadioAction,
  hideRadioAction,
  revertRadioAction,
} from "@/lib/missions/review-actions";
import type { RadioModerationStatus } from "@/lib/missions/types";

type Props = {
  queueId: string;
  moderation: RadioModerationStatus;
};

export function RadioQueueActions({ queueId, moderation }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

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

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {moderation === "PENDING" && (
          <>
            <button
              type="button"
              onClick={() => run(() => approveRadioAction(queueId))}
              disabled={isPending}
              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              ✅ 승인
            </button>
            <button
              type="button"
              onClick={() => run(() => hideRadioAction(queueId))}
              disabled={isPending}
              className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
            >
              🙈 숨김
            </button>
          </>
        )}
        {moderation === "APPROVED" && (
          <>
            <span
              title="세션 편성은 토리FM 제어실에서"
              className="inline-flex items-center gap-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B6560] opacity-70"
            >
              ▶ 재생하기 (제어실에서)
            </span>
            <button
              type="button"
              onClick={() => run(() => hideRadioAction(queueId))}
              disabled={isPending}
              className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
            >
              🙈 숨김
            </button>
          </>
        )}
        {moderation === "HIDDEN" && (
          <button
            type="button"
            onClick={() => run(() => revertRadioAction(queueId))}
            disabled={isPending}
            className="rounded-xl border border-[#2D5A3D] bg-white px-3 py-1.5 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-50"
          >
            ↩ 되돌리기
          </button>
        )}
      </div>
      {msg && (
        <p className="text-[11px] font-semibold text-rose-700" role="alert">
          {msg}
        </p>
      )}
    </div>
  );
}
