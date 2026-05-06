"use client";

// 선물함 모아보기 — 행별 액션 (취소 / 만료일 연장).
// pending 상태에서만 노출. 다른 상태는 액션 영역 비움.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelGiftAction,
  extendGiftExpiryAction,
} from "@/lib/gifts/actions";
import type { GiftStatus } from "@/lib/gifts/types";

type Props = {
  giftId: string;
  status: GiftStatus;
};

export function GiftRowActions({ giftId, status }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status !== "pending") return null;

  function onCancel() {
    if (isPending) return;
    if (!window.confirm("이 선물을 취소할까요? 취소 후엔 사용할 수 없어요.")) return;
    setError(null);
    startTransition(async () => {
      try {
        await cancelGiftAction(giftId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "취소 실패");
      }
    });
  }

  function onExtend() {
    if (isPending) return;
    const raw = window.prompt("며칠 연장할까요? (1~365)", "30");
    if (!raw) return;
    const days = Number(raw.trim());
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      window.alert("1~365 사이 숫자를 입력해 주세요");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await extendGiftExpiryAction(giftId, days);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "연장 실패");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <button
        type="button"
        onClick={onExtend}
        disabled={isPending}
        className="rounded-md border border-[#D4E4BC] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8] disabled:opacity-50"
      >
        ⏰ 연장
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={isPending}
        className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
      >
        🚫 취소
      </button>
      {error && (
        <span className="text-[10px] font-semibold text-rose-700">{error}</span>
      )}
    </div>
  );
}
