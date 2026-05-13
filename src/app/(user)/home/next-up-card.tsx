"use client";

// 홈 화면 "오늘의 일정" 카드 — 진행 중 + 다음 슬롯 압축 미리보기.
//   30초 clock 으로 진행 상태 자동 갱신 (별도 fetch 없이 props 만으로 계산).
//   "전체 보기" 클릭 → /schedule 풀페이지.
//
// 시간 처리: schedule-timeline / 초대장과 동일하게 event.starts_at + duration
// 누적으로 재계산. admin 이 행사 시각 바꾸고 슬롯 재저장 안 했어도 따라옴.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  SLOT_KIND_META,
  type TimelineSlotRow,
} from "@/lib/event-timeline/types";
import { fmtClockKstAlways } from "@/lib/datetime/kst";

interface Props {
  eventName: string;
  /** 행사 시작 시각 — 슬롯 시각 누적 기준점. */
  eventStartsAt: string | null;
  slots: TimelineSlotRow[];
}

const fmtClock = (iso: string): string => fmtClockKstAlways(iso);

function fmtCountdown(minutes: number): string {
  if (minutes <= 0) return "곧";
  if (minutes < 60) return `${minutes}분 후`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}시간 후`;
  return `${h}시간 ${m}분 후`;
}

interface SlotWithComputed extends TimelineSlotRow {
  computedStartMs: number;
  computedEndMs: number;
}

/** event.starts_at + 누적 duration 으로 각 슬롯 시각 재계산. */
function computeSlots(
  rawSlots: TimelineSlotRow[],
  eventStartsAt: string | null
): SlotWithComputed[] {
  const sorted = rawSlots.slice().sort((a, b) => {
    if (a.display_order !== b.display_order) {
      return a.display_order - b.display_order;
    }
    return a.starts_at.localeCompare(b.starts_at);
  });

  const evMs = eventStartsAt ? new Date(eventStartsAt).getTime() : NaN;
  const useAccum = Number.isFinite(evMs);
  let cursor = useAccum ? evMs : NaN;

  return sorted.map((s, idx) => {
    const rawStart = new Date(s.starts_at).getTime();
    const rawEnd = s.ends_at ? new Date(s.ends_at).getTime() : NaN;
    const dur =
      Number.isFinite(rawStart) && Number.isFinite(rawEnd) && rawEnd > rawStart
        ? rawEnd - rawStart
        : 30 * 60 * 1000;

    let startMs: number;
    let endMs: number;
    if (useAccum) {
      startMs = cursor;
      endMs = startMs + dur;
      cursor = endMs;
    } else {
      startMs = rawStart;
      endMs = Number.isFinite(rawEnd)
        ? rawEnd
        : idx < sorted.length - 1
          ? new Date(sorted[idx + 1].starts_at).getTime()
          : startMs + dur;
    }
    return {
      ...s,
      // 표시용으로 starts_at/ends_at 도 덮어씀
      starts_at: new Date(startMs).toISOString(),
      ends_at: new Date(endMs).toISOString(),
      computedStartMs: startMs,
      computedEndMs: endMs,
    };
  });
}

export function NextUpCard({ eventName, eventStartsAt, slots }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000); // 홈은 30초 OK
    return () => clearInterval(t);
  }, []);

  const { current, next } = useMemo(() => {
    const computed = computeSlots(slots, eventStartsAt);

    let current: SlotWithComputed | null = null;
    let next: SlotWithComputed | null = null;

    for (const s of computed) {
      if (now >= s.computedStartMs && now < s.computedEndMs) {
        current = s;
      } else if (now < s.computedStartMs && !next) {
        next = s;
      }
    }

    return { current, next };
  }, [slots, eventStartsAt, now]);

  if (!current && !next) return null;

  return (
    <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>📅</span>
          <span>오늘의 일정</span>
        </h2>
        <Link
          href="/schedule"
          className="rounded-full border border-[#D4E4BC] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8]"
        >
          전체 보기 →
        </Link>
      </header>

      <p className="mt-1 truncate text-[11px] text-[#8B7F75]">{eventName}</p>

      <div className="mt-3 space-y-2">
        {current && <SlotRow slot={current} variant="current" now={now} />}
        {next && <SlotRow slot={next} variant="upcoming" now={now} />}
      </div>
    </section>
  );
}

function SlotRow({
  slot,
  variant,
  now,
}: {
  slot: TimelineSlotRow;
  variant: "current" | "upcoming";
  now: number;
}) {
  const meta = SLOT_KIND_META[slot.slot_kind];
  const icon = slot.icon_emoji || meta.defaultEmoji;
  const isCurrent = variant === "current";
  const startMs = new Date(slot.starts_at).getTime();
  const minutesAhead = Math.ceil((startMs - now) / 60_000);

  const cardCls = isCurrent
    ? "border-amber-400 bg-amber-50"
    : "border-[#D4E4BC] bg-[#FFF8F0]";

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-3 ${cardCls}`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {isCurrent ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              진행 중
            </span>
          ) : (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-400/30">
              ⏰ {fmtCountdown(minutesAhead)}
            </span>
          )}
          <span className="font-mono text-[11px] tabular-nums text-[#6B6560]">
            {fmtClock(slot.starts_at)}
            {slot.ends_at && ` ~ ${fmtClock(slot.ends_at)}`}
          </span>
        </div>
        <p className="mt-0.5 truncate text-sm font-bold text-[#2D5A3D]">
          {slot.title}
        </p>
        {slot.location && (
          <p className="mt-0.5 truncate text-[11px] text-[#8B7F75]">
            📍 {slot.location}
          </p>
        )}
      </div>
    </div>
  );
}
