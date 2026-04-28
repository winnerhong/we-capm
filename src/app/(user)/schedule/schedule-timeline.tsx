"use client";

// 참가자 행사 일정 타임라인 — 위에서 아래로 시간순.
//   - 1초 clock → "지금" 빨간 라인 자동 이동
//   - 진행 중 슬롯 펄스 강조
//   - 과거 ✓ / 미래 카운트다운 ("N분 후 시작")
//   - Realtime: org_event_timeline_slots 변경 즉시 반영
//   - 60초 폴링 fallback (router.refresh — 신규 슬롯 INSERT 가 누락될 때)

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  SLOT_KIND_META,
  type TimelineSlotRow,
} from "@/lib/event-timeline/types";

interface Props {
  eventId: string;
  eventName: string;
  eventStartsAt: string | null;
  eventEndsAt: string | null;
  initialSlots: TimelineSlotRow[];
}

type SlotStatus = "PAST" | "CURRENT" | "UPCOMING";

interface SlotWithStatus extends TimelineSlotRow {
  status: SlotStatus;
  /** 종료 시각 (없으면 다음 슬롯 시작 또는 starts_at + 30분) */
  effectiveEndsAt: string;
  /** 미래 슬롯의 경우 시작까지 남은 분 (음수면 진행 중/과거) */
  startsInMinutes: number;
}

function fmtDay(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    });
  } catch {
    return "";
  }
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
  if (minutes <= 0) return "곧 시작";
  if (minutes < 60) return `${minutes}분 후 시작`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}시간 후 시작`;
  return `${h}시간 ${m}분 후 시작`;
}

function deriveStatuses(
  rawSlots: TimelineSlotRow[],
  nowMs: number
): SlotWithStatus[] {
  // 시작 시각 + display_order 정렬
  const sorted = rawSlots.slice().sort((a, b) => {
    const t = a.starts_at.localeCompare(b.starts_at);
    return t !== 0 ? t : a.display_order - b.display_order;
  });

  return sorted.map((s, idx) => {
    const startMs = new Date(s.starts_at).getTime();
    const explicitEnd = s.ends_at ? new Date(s.ends_at).getTime() : null;
    // 종료 시각 추정: 명시 ends_at > 다음 슬롯 시작 > 시작+30분
    let endMs: number;
    if (explicitEnd && Number.isFinite(explicitEnd)) {
      endMs = explicitEnd;
    } else if (idx < sorted.length - 1) {
      endMs = new Date(sorted[idx + 1].starts_at).getTime();
    } else {
      endMs = startMs + 30 * 60 * 1000;
    }

    let status: SlotStatus;
    if (nowMs >= startMs && nowMs < endMs) status = "CURRENT";
    else if (nowMs >= endMs) status = "PAST";
    else status = "UPCOMING";

    const startsInMinutes = Math.ceil((startMs - nowMs) / 60_000);

    return {
      ...s,
      status,
      effectiveEndsAt: new Date(endMs).toISOString(),
      startsInMinutes,
    };
  });
}

export function ScheduleTimeline({
  eventId,
  eventName,
  eventStartsAt,
  eventEndsAt,
  initialSlots,
}: Props) {
  const router = useRouter();
  const [slots, setSlots] = useState<TimelineSlotRow[]>(initialSlots);
  const [now, setNow] = useState(() => Date.now());

  // SSR 데이터 동기화
  useEffect(() => {
    setSlots(initialSlots);
  }, [initialSlots]);

  // 1초 clock — "지금" 라인 + 진행 상태 갱신
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Realtime 구독
  useEffect(() => {
    if (!eventId) return;
    const supa = createClient();
    const ch = supa
      .channel(`schedule-timeline-${eventId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "org_event_timeline_slots",
          filter: `event_id=eq.${eventId}`,
        } as never,
        ((payload: {
          eventType: string;
          new: TimelineSlotRow | null;
          old: TimelineSlotRow | null;
        }) => {
          const row = payload.new ?? payload.old;
          if (!row) return;
          setSlots((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((s) => s.id !== row.id);
            }
            const idx = prev.findIndex((s) => s.id === row.id);
            const next = idx >= 0 ? prev.slice() : [...prev, row];
            if (idx >= 0 && payload.new) next[idx] = payload.new;
            return next;
          });
        }) as never
      )
      .subscribe();

    // 60초 폴링 fallback
    const poll = setInterval(() => router.refresh(), 60_000);

    return () => {
      clearInterval(poll);
      void supa.removeChannel(ch);
    };
  }, [eventId, router]);

  const enrichedSlots = useMemo(
    () => deriveStatuses(slots, now),
    [slots, now]
  );

  const currentSlot = enrichedSlots.find((s) => s.status === "CURRENT") ?? null;

  return (
    <>
      {/* 헤더 */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 text-white shadow-lg">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#D4E4BC]">
          📅 행사 일정
        </p>
        <h1 className="mt-1 truncate text-xl font-bold">{eventName}</h1>
        {(eventStartsAt || eventEndsAt) && (
          <p className="mt-1 text-[11px] text-[#D4E4BC]">
            {eventStartsAt && fmtDay(eventStartsAt)}
            {eventStartsAt && eventEndsAt && " ~ "}
            {eventEndsAt &&
              eventStartsAt !== eventEndsAt &&
              fmtDay(eventEndsAt)}
          </p>
        )}
        <p className="mt-3 font-mono text-[11px] tabular-nums text-[#D4E4BC]">
          ⏱ 지금{" "}
          {new Date(now).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })}
        </p>
      </header>

      {/* 진행 중 강조 */}
      {currentSlot && <CurrentSlotBanner slot={currentSlot} />}

      {/* 타임라인 본문 */}
      {enrichedSlots.length === 0 ? (
        <section className="rounded-3xl border-2 border-dashed border-[#D4E4BC] bg-white/70 p-6 text-center">
          <p className="text-3xl" aria-hidden>
            📭
          </p>
          <p className="mt-2 text-sm font-bold text-[#2D5A3D]">
            아직 일정이 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            기관에서 일정을 등록하면 여기에 시간순으로 표시돼요.
          </p>
        </section>
      ) : (
        <ol className="relative space-y-3 border-l-2 border-[#D4E4BC] pl-4">
          {enrichedSlots.map((s) => (
            <SlotRow key={s.id} slot={s} />
          ))}
        </ol>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* CurrentSlotBanner — 진행 중인 슬롯 1개 강조                                 */
/* -------------------------------------------------------------------------- */

function CurrentSlotBanner({ slot }: { slot: SlotWithStatus }) {
  const meta = SLOT_KIND_META[slot.slot_kind];
  const icon = slot.icon_emoji || meta.defaultEmoji;
  return (
    <section
      className="rounded-3xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 via-white to-[#F5F1E8] p-5 shadow-lg shadow-amber-400/20"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-white"
          aria-label="진행 중"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          진행 중
        </span>
        <span className="text-[11px] font-semibold text-amber-700">
          {fmtClock(slot.starts_at)} ~ {fmtClock(slot.effectiveEndsAt)}
        </span>
      </div>
      <div className="mt-3 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-[#2D5A3D]">{slot.title}</h2>
          {slot.description && (
            <p className="mt-1 text-sm leading-relaxed text-[#4A4340]">
              {slot.description}
            </p>
          )}
          {slot.location && (
            <p className="mt-1 text-[11px] font-semibold text-amber-700">
              📍 {slot.location}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* SlotRow — 타임라인 한 항목                                                  */
/* -------------------------------------------------------------------------- */

function SlotRow({ slot }: { slot: SlotWithStatus }) {
  const meta = SLOT_KIND_META[slot.slot_kind];
  const icon = slot.icon_emoji || meta.defaultEmoji;
  const isPast = slot.status === "PAST";
  const isCurrent = slot.status === "CURRENT";

  // 노드 색상
  const nodeBg = isCurrent
    ? "bg-amber-400 ring-4 ring-amber-300/50 animate-pulse"
    : isPast
      ? "bg-zinc-300"
      : "bg-emerald-400";

  // 카드 톤
  const cardCls = isCurrent
    ? "border-amber-400 bg-amber-50 shadow-md"
    : isPast
      ? "border-zinc-200 bg-zinc-50/60 opacity-70"
      : "border-[#D4E4BC] bg-white shadow-sm";

  return (
    <li className="relative">
      {/* 노드 (왼쪽 라인 위 점) */}
      <span
        className={`absolute -left-[26px] top-3 h-3 w-3 rounded-full ${nodeBg}`}
        aria-hidden
      />

      <div
        className={`rounded-2xl border p-3 transition ${cardCls}`}
      >
        {/* 시각 + 종류 */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`font-mono text-xs font-bold tabular-nums ${
              isPast
                ? "text-zinc-500 line-through"
                : isCurrent
                  ? "text-amber-700"
                  : "text-[#2D5A3D]"
            }`}
          >
            {fmtClock(slot.starts_at)}
            {slot.ends_at && ` ~ ${fmtClock(slot.ends_at)}`}
          </span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              isPast
                ? "bg-zinc-200 text-zinc-600"
                : isCurrent
                  ? "bg-amber-200 text-amber-900"
                  : "bg-[#E8F0E4] text-[#2D5A3D]"
            }`}
          >
            {meta.label}
          </span>
          {isPast && <span className="text-[11px] text-zinc-500">✓ 완료</span>}
          {slot.status === "UPCOMING" && (
            <span className="text-[11px] font-semibold text-emerald-700">
              ⏰ {fmtCountdown(slot.startsInMinutes)}
            </span>
          )}
        </div>

        {/* 제목 + 아이콘 */}
        <div className="mt-1.5 flex items-start gap-2">
          <span className="text-2xl" aria-hidden>
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <h3
              className={`text-sm font-bold ${
                isPast ? "text-zinc-600" : "text-[#2D5A3D]"
              }`}
            >
              {slot.title}
            </h3>
            {slot.description && (
              <p
                className={`mt-0.5 text-[12px] leading-relaxed ${
                  isPast ? "text-zinc-500" : "text-[#4A4340]"
                }`}
              >
                {slot.description}
              </p>
            )}
            {slot.location && (
              <p
                className={`mt-0.5 text-[11px] ${
                  isPast ? "text-zinc-400" : "text-[#8B7F75]"
                }`}
              >
                📍 {slot.location}
              </p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
