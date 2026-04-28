"use client";

// 홈 화면 "오늘의 일정" 카드 — 진행 중 + 다음 슬롯 압축 미리보기.
//   1초 clock 으로 진행 상태 자동 갱신 (별도 fetch 없이 props 만으로 계산).
//   "전체 보기" 클릭 → /schedule 풀페이지.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  SLOT_KIND_META,
  type TimelineSlotRow,
} from "@/lib/event-timeline/types";

interface Props {
  eventName: string;
  slots: TimelineSlotRow[];
}

function fmtClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

function fmtCountdown(minutes: number): string {
  if (minutes <= 0) return "곧";
  if (minutes < 60) return `${minutes}분 후`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}시간 후`;
  return `${h}시간 ${m}분 후`;
}

export function NextUpCard({ eventName, slots }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000); // 홈은 30초 OK
    return () => clearInterval(t);
  }, []);

  const { current, next } = useMemo(() => {
    const sorted = slots
      .slice()
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

    let current: TimelineSlotRow | null = null;
    let next: TimelineSlotRow | null = null;

    for (let i = 0; i < sorted.length; i += 1) {
      const s = sorted[i];
      const startMs = new Date(s.starts_at).getTime();
      const explicitEnd = s.ends_at ? new Date(s.ends_at).getTime() : null;
      const fallbackEnd =
        i < sorted.length - 1
          ? new Date(sorted[i + 1].starts_at).getTime()
          : startMs + 30 * 60 * 1000;
      const endMs = explicitEnd ?? fallbackEnd;

      if (now >= startMs && now < endMs) {
        current = s;
      } else if (now < startMs && !next) {
        next = s;
      }
    }

    return { current, next };
  }, [slots, now]);

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
