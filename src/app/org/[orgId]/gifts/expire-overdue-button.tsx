"use client";

// 만료 일괄 정리 — pending 인데 expires_at < now 인 행을 expired 로 일괄 갱신.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { expireOverdueGiftsAction } from "@/lib/gifts/actions";

export function ExpireOverdueButton({ overdueCount }: { overdueCount: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (overdueCount <= 0) return null;

  function onClick() {
    if (isPending) return;
    if (
      !window.confirm(
        `만료일이 지난 ${overdueCount}건을 만료 처리할까요? 되돌릴 수 없어요.`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      try {
        const r = await expireOverdueGiftsAction();
        window.alert(`${r.count}건을 만료 처리했어요`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "정리 실패");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 shadow-sm hover:bg-amber-100 disabled:opacity-50"
      >
        ⌛ 만료 정리 ({overdueCount})
      </button>
      {error && (
        <span className="text-[11px] font-semibold text-rose-700">{error}</span>
      )}
    </>
  );
}
