"use client";

// 시작 일시 + 기간 슬라이더 → 종료 일시 자동 계산.
// 행사 편집 화면의 시간 위젯을 그대로 쓰되, 눈금(scale)만 바꿔 끼울 수 있게 한 것.
//
// 왜 종료 일시를 직접 못 고르게 하나:
//   두 칸을 따로 받으면 종료가 시작보다 앞선 값이 화면에서 멀쩡해 보인다
//   (제출해야 비로소 "시작 일시가 종료 일시보다 늦어요" 로 막힌다).
//   기간으로 받으면 그 상태 자체가 만들어지지 않는다.
//
// 이 컴포넌트는 **controlled** 다 — 값은 부모 폼이 들고 있고 여기선 그리기만 한다.
// (스탬프북 폼들이 이미 startsAt/endsAt state 로 서버 액션에 넘기고 있어서,
//  hidden input 방식인 event-time-range-picker 와 계약이 다르다.)

import { useMemo } from "react";
import {
  DURATION_SCALES,
  addMinutesToLocalInput,
  composeLocalInput,
  deriveDurationMin,
  formatDurationKo,
  minuteOptions,
  splitLocalInput,
  type DurationScale,
} from "@/lib/datetime/duration-range";
import { fmtDateTimeKst, toIsoKstFromLocalInput } from "@/lib/datetime/kst";

const INPUT_CLS =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

type Props = {
  /** "YYYY-MM-DDTHH:mm" (KST 로 해석) 또는 "" */
  startsAt: string;
  endsAt: string;
  onChange: (next: { startsAt: string; endsAt: string }) => void;
  /** hours = 행사(5분~10시간), days = 스탬프북·시즌(1일~6개월) */
  scale?: DurationScale;
  /** "행사 기간" / "진행 기간" 처럼 대상에 맞는 이름 */
  durationLabel?: string;
  /** 비워둘 수 있는 필드면 [비우기] 를 띄운다 */
  optional?: boolean;
  /** 날짜를 처음 고를 때 채울 시각 */
  defaultHour?: number;
  defaultMinute?: number;
  idPrefix?: string;
};

export function DurationRangePicker({
  startsAt,
  endsAt,
  onChange,
  scale = "hours",
  durationLabel = "행사 기간",
  optional = false,
  defaultHour = 9,
  defaultMinute = 0,
  idPrefix = "range",
}: Props) {
  const cfg = DURATION_SCALES[scale];

  const parts = useMemo(() => splitLocalInput(startsAt), [startsAt]);
  const date = parts?.date ?? "";
  const hour = parts?.hour ?? defaultHour;
  const minute = parts?.minute ?? defaultMinute;

  const durationMin = useMemo(
    () => deriveDurationMin(startsAt, endsAt, scale),
    [startsAt, endsAt, scale]
  );

  const minOptions = useMemo(
    () => minuteOptions(minute, cfg.minuteStep),
    [minute, cfg.minuteStep]
  );

  /** 시작이 정해질 때마다 종료도 같이 다시 낸다 — 둘이 어긋날 틈을 두지 않는다. */
  function emit(nextStart: string, mins: number) {
    if (!nextStart) {
      onChange({ startsAt: "", endsAt: "" });
      return;
    }
    onChange({
      startsAt: nextStart,
      endsAt: addMinutesToLocalInput(nextStart, mins),
    });
  }

  function setDate(nextDate: string) {
    emit(composeLocalInput(nextDate, hour, minute), durationMin);
  }
  function setHour(h: number) {
    emit(composeLocalInput(date, h, minute), durationMin);
  }
  function setMinute(m: number) {
    emit(composeLocalInput(date, hour, m), durationMin);
  }
  function setDuration(mins: number) {
    emit(startsAt, mins);
  }

  const endIso = toIsoKstFromLocalInput(endsAt);

  return (
    <div className="space-y-4 rounded-2xl border border-[#E5D3B8] bg-[#FFFDF8] p-4">
      {/* 시작 일시 */}
      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <label
            htmlFor={`${idPrefix}_date`}
            className="text-xs font-semibold text-[#2D5A3D]"
          >
            ⏰ 시작 일시 ({cfg.unitNote})
          </label>
          {optional && startsAt && (
            <button
              type="button"
              onClick={() => onChange({ startsAt: "", endsAt: "" })}
              className="text-[11px] font-semibold text-[#8B7F75] underline underline-offset-2 hover:text-[#2D5A3D]"
            >
              비우기
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input
            id={`${idPrefix}_date`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="시작 날짜"
            className={INPUT_CLS}
          />
          <select
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            aria-label="시작 시"
            disabled={!date}
            className={`${INPUT_CLS} disabled:opacity-50`}
          >
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {pad(h)}시
              </option>
            ))}
          </select>
          <select
            value={minute}
            onChange={(e) => setMinute(Number(e.target.value))}
            aria-label="시작 분"
            disabled={!date}
            className={`${INPUT_CLS} disabled:opacity-50`}
          >
            {minOptions.map((m) => (
              <option key={m} value={m}>
                {pad(m)}분
              </option>
            ))}
          </select>
        </div>
      </div>

      {startsAt ? (
        <>
          {/* 기간 슬라이더 */}
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <label
                htmlFor={`${idPrefix}_duration`}
                className="text-xs font-semibold text-[#2D5A3D]"
              >
                📏 {durationLabel} ({cfg.unitNote})
              </label>
              <span className="text-sm font-bold text-[#2D5A3D]">
                {formatDurationKo(durationMin)}
              </span>
            </div>
            <input
              id={`${idPrefix}_duration`}
              type="range"
              min={cfg.minMin}
              max={cfg.maxMin}
              step={cfg.stepMin}
              value={durationMin}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full accent-[#2D5A3D]"
            />
            <div className="flex justify-between text-[10px] text-[#8B7F75]">
              <span>{cfg.minLabel}</span>
              <span>{cfg.maxLabel}</span>
            </div>
          </div>

          {/* 빠른 프리셋 */}
          <div className="flex flex-wrap gap-1.5">
            {cfg.presets.map((p) => {
              const active = durationMin === p.mins;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setDuration(p.mins)}
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

          {/* 종료 일시 — 자동 계산 결과 */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-xs text-[#2D5A3D]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold">🏁 종료 일시</span>
              <span className="font-bold text-emerald-800">
                {endIso ? fmtDateTimeKst(endIso) : "-"}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-[#6B6560]">
              시작 일시 + 기간 슬라이더로 자동 계산됩니다.
            </p>
          </div>
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-[#E5D3B8] px-3 py-2 text-[11px] text-[#8B7F75]">
          시작 날짜를 고르면 기간과 종료 일시가 나타나요.
          {optional && " 비워두면 기간 제한 없이 상시 진행돼요."}
        </p>
      )}
    </div>
  );
}
