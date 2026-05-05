"use client";

// 행사 시작·종료 시각 선택 위젯 — 새 행사 만들기와 동일한 UX.
// - 날짜 + 시 + 분(5분 단위) + 기간 슬라이더
// - 종료 일시는 자동 계산 (표시만, 입력 X)
// - 서버 컴포넌트 form 안에서 hidden input 으로 starts_at, ends_at 전송

import { useMemo, useState } from "react";

const INPUT_CLS =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";

const MIN_DURATION = 5;
const MAX_DURATION_MIN = 60 * 10;

const DURATION_PRESETS: { label: string; mins: number }[] = [
  { label: "30분", mins: 30 },
  { label: "1시간", mins: 60 },
  { label: "2시간", mins: 120 },
  { label: "3시간", mins: 180 },
  { label: "4시간", mins: 240 },
  { label: "6시간", mins: 360 },
  { label: "8시간", mins: 480 },
  { label: "10시간", mins: 600 },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
const MIN_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5);

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toLocalIsoMinute(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}분`;
  const days = Math.floor(min / (60 * 24));
  const hours = Math.floor((min % (60 * 24)) / 60);
  const mins = min % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}일`);
  if (hours) parts.push(`${hours}시간`);
  if (mins) parts.push(`${mins}분`);
  return parts.join(" ");
}

function formatDateTimeKo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
}

interface Props {
  /** hidden input name for start datetime (datetime-local string) */
  startName?: string;
  /** hidden input name for end datetime */
  endName?: string;
  /** 기본 시작일 (YYYY-MM-DD). 없으면 다음 주 토요일. */
  defaultDate?: string;
  /** 기본 시작 시(0~23). 기본 10. */
  defaultHour?: number;
  /** 기본 시작 분(0,5,..,55). 기본 0. */
  defaultMinute?: number;
  /** 기본 진행 기간(분). 기본 180(=3시간). */
  defaultDurationMin?: number;
}

function nextSaturdayDate(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun..6=Sat
  const offset = day === 6 ? 7 : 6 - day;
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function EventTimeRangePicker({
  startName = "starts_at",
  endName = "ends_at",
  defaultDate,
  defaultHour = 10,
  defaultMinute = 0,
  defaultDurationMin = 180,
}: Props) {
  const [startDate, setStartDate] = useState<string>(
    defaultDate || nextSaturdayDate()
  );
  const [startHour, setStartHour] = useState<number>(
    Math.max(0, Math.min(23, defaultHour))
  );
  const [startMin, setStartMin] = useState<number>(
    Math.max(0, Math.min(55, Math.round(defaultMinute / 5) * 5))
  );
  const [durationMin, setDurationMin] = useState<number>(
    Math.max(
      MIN_DURATION,
      Math.min(
        MAX_DURATION_MIN,
        Math.round(defaultDurationMin / 5) * 5
      )
    )
  );

  const startsAt = useMemo(() => {
    if (!startDate) return "";
    return `${startDate}T${pad(startHour)}:${pad(startMin)}`;
  }, [startDate, startHour, startMin]);

  const endsAt = useMemo(() => {
    if (!startsAt) return "";
    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime())) return "";
    const end = new Date(start.getTime() + durationMin * 60 * 1000);
    return toLocalIsoMinute(end);
  }, [startsAt, durationMin]);

  return (
    <div className="space-y-4 rounded-2xl border border-[#E5D3B8] bg-[#FFFDF8] p-4">
      {/* 시작 일시 */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
          ⏰ 시작 일시 (선택, 5분 단위)
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="시작 날짜"
            className={INPUT_CLS}
          />
          <select
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            aria-label="시작 시"
            className={INPUT_CLS}
          >
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {pad(h)}시
              </option>
            ))}
          </select>
          <select
            value={startMin}
            onChange={(e) => setStartMin(Number(e.target.value))}
            aria-label="시작 분"
            className={INPUT_CLS}
          >
            {MIN_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {pad(m)}분
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 행사 기간 */}
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <label className="text-xs font-semibold text-[#2D5A3D]">
            📏 행사 기간 (5분 단위)
          </label>
          <span className="text-sm font-bold text-[#2D5A3D]">
            {formatDuration(durationMin)}
          </span>
        </div>
        <input
          type="range"
          min={MIN_DURATION}
          max={MAX_DURATION_MIN}
          step={5}
          value={durationMin}
          onChange={(e) => setDurationMin(Number(e.target.value))}
          className="w-full accent-[#2D5A3D]"
        />
        <div className="flex justify-between text-[10px] text-[#8B7F75]">
          <span>5분</span>
          <span>10시간</span>
        </div>
      </div>

      {/* 빠른 프리셋 */}
      <div className="flex flex-wrap gap-1.5">
        {DURATION_PRESETS.map((p) => {
          const active = durationMin === p.mins;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => setDurationMin(p.mins)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                active
                  ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                  : "border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#F5F1E8]"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* 종료 일시 자동 계산 표시 */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-xs text-[#2D5A3D]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-semibold">🏁 종료 일시</span>
          <span className="font-bold text-emerald-800">
            {endsAt ? formatDateTimeKo(endsAt) : "-"}
          </span>
        </div>
        <p className="mt-0.5 text-[10px] text-[#6B6560]">
          시작 일시 + 기간 슬라이더로 자동 계산됩니다.
        </p>
      </div>

      {/* form 전송용 hidden inputs */}
      <input type="hidden" name={startName} value={startsAt} />
      <input type="hidden" name={endName} value={endsAt} />
    </div>
  );
}
