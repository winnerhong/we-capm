"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  assignQueueToSessionAction,
  unassignQueueFromSessionAction,
} from "@/lib/missions/review-actions";

type Props = {
  sessionId: string;
  queueId: string;
  mode: "assign" | "unassign";
  disabled?: boolean;
  disabledReason?: string;
};

export function QueueAssignButton({
  sessionId,
  queueId,
  mode,
  disabled,
  disabledReason,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const isDisabled = disabled || isPending;

  function onClick() {
    setMsg(null);
    startTransition(async () => {
      try {
        if (mode === "assign") {
          await assignQueueToSessionAction(sessionId, queueId);
        } else {
          await unassignQueueFromSessionAction(sessionId, queueId);
        }
        router.refresh();
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "요청에 실패했어요");
      }
    });
  }

  const baseCls =
    "shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50";

  const cls =
    mode === "assign"
      ? `${baseCls} bg-emerald-600 text-white shadow-sm hover:bg-emerald-700`
      : `${baseCls} border border-[#D4E4BC] bg-white text-[#6B6560] hover:bg-[#F5F1E8]`;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={isDisabled}
        title={isDisabled && disabledReason ? disabledReason : undefined}
        aria-label={
          mode === "assign" ? "이 세션에 편성" : "이 세션에서 편성 해제"
        }
        className={cls}
      >
        {isPending
          ? "처리 중…"
          : mode === "assign"
            ? "➕ 편성"
            : "✖ 해제"}
      </button>
      {isDisabled && disabledReason && !isPending && (
        <span className="max-w-[140px] text-right text-[10px] text-[#8B7F75]">
          {disabledReason}
        </span>
      )}
      {msg && (
        <span className="max-w-[180px] text-right text-[10px] font-semibold text-rose-700" role="alert">
          {msg}
        </span>
      )}
    </div>
  );
}
