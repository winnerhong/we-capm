"use client";

// 초대장 페이지의 타임테이블 — 처음 N개만 보이고 "전체 보기 / 접기" 토글.
// slots 수가 적으면 (≤ INITIAL_VISIBLE) 토글 자체 숨김.

import { useState } from "react";
import { SLOT_KIND_META, type TimelineSlotRow } from "@/lib/event-timeline/types";

const INITIAL_VISIBLE = 4;

/** "20분" / "1시간" / "1시간 30분" — 슬롯 소요시간 라벨. */
function fmtDuration(min: number): string {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

type SlotTimeRange = {
  start: string;
  end: string | null;
  durationMin: number | null;
};

type Props = {
  slots: TimelineSlotRow[];
  /** 슬롯과 동일 길이 — 표시용 시작/종료/소요시간. */
  slotTimes: SlotTimeRange[];
};

export function TimelineCollapsible({ slots, slotTimes }: Props) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = slots.length > INITIAL_VISIBLE;
  const visible = expanded || !hasMore ? slots : slots.slice(0, INITIAL_VISIBLE);
  const hiddenCount = slots.length - INITIAL_VISIBLE;

  return (
    <>
      <ol className="relative space-y-3 border-l-2 border-emerald-200 pl-5">
        {visible.map((slot, idx) => {
          const meta = SLOT_KIND_META[slot.slot_kind];
          const emoji = slot.icon_emoji || meta?.defaultEmoji || "🌲";
          return (
            <li
              key={slot.id}
              className="relative rounded-xl border border-[#D4E4BC] bg-white p-3 shadow-sm"
            >
              <span
                aria-hidden
                className="absolute -left-[27px] top-3 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-emerald-400 bg-white"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <p className="flex items-baseline justify-between gap-2 text-xs font-semibold text-[#6B6560]">
                <span className="font-mono tabular-nums">
                  {slotTimes[idx].start}
                  {slotTimes[idx].end && ` ~ ${slotTimes[idx].end}`}
                </span>
                {slotTimes[idx].durationMin && (
                  <span className="shrink-0 text-[11px] font-normal text-[#8B7F75]">
                    ({fmtDuration(slotTimes[idx].durationMin!)})
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-sm font-bold text-[#2D5A3D]">
                {emoji} {slot.title || meta?.label || "활동"}
              </p>
            </li>
          );
        })}
      </ol>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-xs font-semibold text-[#2D5A3D] shadow-sm transition hover:bg-[#F5F1E8]"
        >
          {expanded ? (
            <>
              <span aria-hidden>▲</span>
              <span>접기</span>
            </>
          ) : (
            <>
              <span aria-hidden>▼</span>
              <span>전체 {slots.length}개 보기 (+{hiddenCount})</span>
            </>
          )}
        </button>
      )}
    </>
  );
}
