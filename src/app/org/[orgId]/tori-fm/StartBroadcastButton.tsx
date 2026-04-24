"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startFmBroadcastAction } from "@/lib/missions/review-actions";

interface Props {
  sessionId: string;
  sessionName: string;
  variant?: "compact" | "full";
}

export function StartBroadcastButton({
  sessionId,
  sessionName,
  variant = "compact",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    if (
      !confirm(
        `지금 "${sessionName}" 방송을 시작할까요?\n참가자 전체에게 실시간으로 ON AIR 알림이 나가요.`
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await startFmBroadcastAction(sessionId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "방송 시작 실패");
      }
    });
  };

  if (variant === "full") {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onClick}
          disabled={pending}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:from-rose-600 hover:to-rose-700 active:scale-[0.99] disabled:opacity-60"
        >
          {pending ? (
            <>⏳ 시작 중…</>
          ) : (
            <>
              <span aria-hidden>📻</span>
              <span>ON AIR 방송 시작</span>
            </>
          )}
        </button>
        {error && (
          <p className="text-[11px] font-semibold text-rose-700">⚠️ {error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        title="이 방송 세션을 지금 시작해요"
        className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:from-rose-600 hover:to-rose-700 active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? (
          <>⏳ 시작 중…</>
        ) : (
          <>
            <span aria-hidden>📻</span>
            <span>ON AIR 시작</span>
          </>
        )}
      </button>
      {error && (
        <p className="text-[10px] font-semibold text-rose-700">⚠️ {error}</p>
      )}
    </div>
  );
}
