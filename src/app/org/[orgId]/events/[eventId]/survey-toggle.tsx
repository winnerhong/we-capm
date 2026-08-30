"use client";

// 설문 받기 스위치 — 켜면 참가자 화면에 설문 카드가 뜬다.
//
// "꺼도 받은 답은 남아요" 를 한 줄로 못 박는다. 답이 사라지는 줄 알면 아무도
// 끄지 못하고, 행사가 끝난 뒤에도 설문 카드가 계속 떠 있게 된다.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSurveyEnabledAction } from "@/lib/org-events/survey-actions";

export function SurveyToggle({
  eventId,
  initialEnabled,
}: {
  eventId: string;
  initialEnabled: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onToggle() {
    if (pending) return;
    const next = !enabled;
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      try {
        await setSurveyEnabledAction(eventId, next);
        router.refresh();
      } catch (e) {
        setEnabled(!next);
        setError(e instanceof Error ? e.message : "변경에 실패했어요");
      }
    });
  }

  return (
    <section
      className={`rounded-2xl border-2 p-4 transition ${
        enabled
          ? "border-emerald-300 bg-emerald-50/40"
          : "border-[#D4E4BC] bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden className="mr-1.5">
              📝
            </span>
            설문 받기
          </h3>
          <p className="mt-0.5 text-[11px] text-[#6B6560]">
            {enabled
              ? "참가자 행사홈에 설문 카드가 떠 있어요"
              : "켜면 참가자 행사홈에 설문 카드가 떠요 · 꺼도 받은 답은 남아요"}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="설문 받기"
          disabled={pending}
          onClick={onToggle}
          className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
            enabled ? "bg-emerald-500" : "bg-zinc-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
              enabled ? "left-[1.375rem]" : "left-0.5"
            }`}
          />
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-2 text-[11px] font-semibold text-rose-700"
        >
          {error}
        </p>
      )}
    </section>
  );
}
