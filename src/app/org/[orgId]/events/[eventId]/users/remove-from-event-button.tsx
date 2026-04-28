"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { removeUserFromEventAction } from "./actions";

/**
 * 행사 참가자 행에서 "행사제외" 단축 버튼.
 * - 1-step: confirm + 즉시 org_event_participants 한 줄 삭제
 * - app_user / 자녀 / 도토리 / 다른 행사 데이터는 그대로
 */
export function RemoveFromEventButton({
  orgId,
  eventId,
  userId,
  displayName,
  variant = "table",
}: {
  orgId: string;
  eventId: string;
  userId: string;
  displayName: string;
  variant?: "table" | "card";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (isPending) return;
    const ok = window.confirm(
      `[${displayName}] 가족을 이 행사에서 제외할까요?\n\n` +
        `이 행사에서만 빠지고, 기관에 등록된 참가자 정보(자녀·도토리·다른 행사)는 그대로 유지돼요.`
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      try {
        await removeUserFromEventAction(orgId, eventId, userId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "행사제외 실패");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        aria-label={`${displayName} 행사제외`}
        title="이 행사 참가자 명단에서만 제거 (기관 데이터는 보존)"
        className={
          variant === "card"
            ? "inline-flex h-8 items-center justify-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-3 text-[11px] font-semibold leading-none text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            : "inline-flex h-7 items-center justify-center gap-0.5 whitespace-nowrap rounded-md border border-amber-300 bg-amber-50 px-2 text-[11px] font-semibold leading-none text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
        }
      >
        <span aria-hidden>{isPending ? "⏳" : "🚫"}</span>
        <span>행사제외</span>
      </button>
      {error && (
        <span
          role="alert"
          className="ml-1 text-[10px] font-semibold text-rose-700"
        >
          {error}
        </span>
      )}
    </>
  );
}
