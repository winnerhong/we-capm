"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  cancelSubscriptionAction,
  pauseSubscriptionAction,
  resumeSubscriptionAction,
} from "../subscribe/actions";

type Props = {
  eventId: string;
  subId: string;
  status: "ACTIVE" | "PAUSED" | "CANCELED";
};

export function SubscriptionActions({ eventId, subId, status }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const run = (fn: () => Promise<unknown>, confirmMsg?: string) => {
    if (isPending) return;
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "요청 실패";
        setErrorMsg(msg);
      }
    });
  };

  return (
    <section
      aria-label="구독 관리"
      className="rounded-3xl border border-[#E6D3B8] bg-white p-5 shadow-sm"
    >
      <h3 className="text-sm font-bold text-[#2D5A3D]">⚙️ 구독 관리</h3>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {status === "ACTIVE" ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(
                () => pauseSubscriptionAction(eventId, subId),
                "구독을 일시 정지하시겠어요?\n\n다시 이용하실 때까지 자동 결제가 멈춥니다.",
              )
            }
            className="flex-1 rounded-2xl border border-[#E6D3B8] bg-[#FFF8F0] px-4 py-3 text-sm font-bold text-[#8B6F47] transition-colors hover:bg-[#F5E4CB] focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 disabled:opacity-50"
          >
            {isPending ? "처리 중..." : "⏸ 일시 정지"}
          </button>
        ) : status === "PAUSED" ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(
                () => resumeSubscriptionAction(eventId, subId),
                "구독을 다시 시작하시겠어요?",
              )
            }
            className="flex-1 rounded-2xl bg-gradient-to-r from-[#2D5A3D] to-[#4A7C59] px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-300 disabled:opacity-50"
          >
            {isPending ? "처리 중..." : "▶ 다시 시작"}
          </button>
        ) : null}

        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            run(
              () => cancelSubscriptionAction(eventId, subId),
              "정말 구독을 해지하시겠어요?\n\n다음 결제일부터 자동 결제가 중단되며, 혜택도 종료됩니다.",
            )
          }
          className="flex-1 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-200 disabled:opacity-50"
        >
          {isPending ? "처리 중..." : "❌ 구독 해지"}
        </button>
      </div>

      {errorMsg ? (
        <p role="alert" className="mt-3 text-xs font-medium text-red-600">
          {errorMsg}
        </p>
      ) : null}

      <p className="mt-3 text-[10px] text-[#6B6560]">
        · 해지 후에도 이번 달 혜택은 마지막 날까지 유지됩니다
      </p>
    </section>
  );
}
