"use client";

// 타임테이블 사용 스위치 — 끄면 참가자 「일정」 화면과 행사홈의 다음 일정
// 카드가 함께 숨는다. 일정표를 안 쓰는 행사에서 "아직 일정표가 없어요" 가
// 떠서 기관이 깜빡한 것처럼 보이던 것을 없애는 스위치.
// PhotoFeedToggle 과 같은 낙관적 업데이트(실패 시 롤백).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateEventTimelineEnabledAction } from "@/lib/org-events/actions";

export function TimelineToggle({
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
        await updateEventTimelineEnabledAction(eventId, next);
        router.refresh();
      } catch (e) {
        setEnabled(!next);
        setError(e instanceof Error ? e.message : "변경에 실패했어요");
      }
    });
  }

  return (
    <section
      className={`flex flex-wrap items-center gap-3 rounded-2xl border-2 p-4 shadow-sm transition ${
        enabled
          ? "border-[#D4E4BC] bg-white"
          : "border-[#E8E4DE] bg-[#FAF8F5]"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#2D5A3D]">
          📅 일정표 사용 {enabled ? "중" : "안 함"}
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-[#6B6560]">
          {enabled
            ? "참가자 일정 화면에 아래 타임테이블이 보여요."
            : "참가자 일정 화면과 다음 일정 카드가 숨겨져 있어요."}
        </p>
        {error && (
          <p className="mt-1 text-[11px] font-semibold text-rose-700">
            ⚠ {error}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        disabled={pending}
        className={`relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-60 ${
          enabled ? "bg-[#2D5A3D]" : "bg-[#C9C2B8]"
        }`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
            enabled ? "left-7" : "left-1"
          }`}
        />
      </button>
    </section>
  );
}
