"use client";

// 한 번에 라이브를 시작하는 큰 amber 버튼.
// 행사를 선택한 상태에서 LIVE 세션이 없을 때 노출 — 자동으로 세션 생성 + 방송 시작.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { quickStartLiveAction } from "@/lib/missions/review-actions";

interface Props {
  orgId: string;
  eventId: string | null;
  defaultName: string;
}

export function QuickStartLiveButton({ orgId, eventId, defaultName }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    start(async () => {
      try {
        await quickStartLiveAction(orgId, eventId, defaultName);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "라이브 시작 실패");
      }
    });
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-6 py-4 text-base font-bold text-[#1B2B3A] shadow-lg shadow-amber-400/30 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "🔴 라이브 시작 중…" : "▶ 라이브 시작"}
      </button>
      {error && (
        <p className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-center text-xs font-bold text-rose-200">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
