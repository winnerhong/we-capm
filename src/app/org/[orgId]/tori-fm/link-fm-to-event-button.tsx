"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkFmSessionToEventAction } from "@/lib/org-events/actions";

interface Props {
  eventId: string;
  eventName: string;
  sessionId: string;
  sessionName: string;
}

/**
 * 다른 곳/행사 미연결 상태로 진행 중인 LIVE 세션을 현재 필터의 행사로 옮기는 버튼.
 * 미연결 → 연결, 또는 다른 행사 → 다른 행사 모두 처리.
 */
export function LinkFmToEventButton({
  eventId,
  eventName,
  sessionId,
  sessionName,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    if (pending) return;
    const ok = window.confirm(
      `"${sessionName}" 세션을 "${eventName}" 행사로 연결할까요?\n\n` +
        `LIVE 중인 세션의 행사 연결을 바꿔도 방송은 계속됩니다.`
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      try {
        await linkFmSessionToEventAction(eventId, sessionId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "연결 실패");
      }
    });
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-xl bg-amber-400 px-3 py-1.5 text-[11px] font-bold text-[#1B2B3A] shadow-md hover:bg-amber-300 disabled:opacity-50"
      >
        {pending ? "연결 중..." : `🔗 이 행사에 연결하기`}
      </button>
      {error && (
        <p className="text-[10px] font-semibold text-rose-300">⚠ {error}</p>
      )}
    </div>
  );
}
