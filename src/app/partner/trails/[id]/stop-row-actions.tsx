"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteStopAction,
  regenerateStopQrAction,
} from "../actions";

type Props = {
  stopId: string;
  trailId: string;
};

export function StopRowActions({ stopId, trailId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = () => {
    if (!confirm("이 지점을 삭제할까요? QR 코드도 무효화돼요.")) return;
    setErr(null);
    startTransition(async () => {
      try {
        await deleteStopAction(stopId, trailId);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("NEXT_REDIRECT")) setErr(msg);
      }
    });
  };

  const handleRegen = () => {
    if (!confirm("QR 코드를 재발급할까요? 기존 QR은 더 이상 사용할 수 없어요.")) return;
    setErr(null);
    startTransition(async () => {
      try {
        await regenerateStopQrAction(stopId, trailId);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("NEXT_REDIRECT")) setErr(msg);
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <button
        type="button"
        onClick={handleRegen}
        disabled={isPending}
        className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-1 text-[10px] font-semibold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-60"
        aria-label="QR 재발급"
      >
        🔄 QR
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="rounded-lg border border-rose-300 bg-white px-2 py-1 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
        aria-label="지점 삭제"
      >
        🗑
      </button>
      {err && (
        <span
          role="alert"
          className="text-[10px] text-rose-700"
        >
          {err}
        </span>
      )}
    </div>
  );
}
