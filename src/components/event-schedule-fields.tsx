"use client";

// 행사 시각 묶음 — 시작 일시 · 기간 · 종료 · 입장가능시간.
//
// 새 행사 등록과 행사 편집이 **이 파일 하나**를 쓴다. 예전엔 두 폼이 같은 마크업을
// 140줄씩 각자 갖고 있었고, 편집 폼에만 입장가능시간이 붙으면서 갈라졌다. 새 행사를
// 만들 땐 입장시간을 정할 수 없고, 만들고 나서 편집으로 다시 들어가야 했다.
//
// 왜 시각이 없어도 다 보여 주나:
//   예전엔 시작 일시를 넣기 전까지 기간·종료·입장시간이 통째로 숨어 있었다.
//   빈 폼을 처음 여는 사람에게는 그 기능들이 **없는 것**으로 보인다("새 행사에는
//   왜 기간이 없어요"). 자리는 늘 지키고, 아직 못 채우는 값만 안내 문구로 말한다.
//
// 왜 입장시간을 '시각' 이 아니라 '몇 분 전' 으로 받나:
//   행사 시각을 나중에 옮겨도 입장시간이 따라오게 하려는 것. 시각으로 받으면
//   행사만 옮기고 입장시간은 그대로 남는 사고가 난다.

import { resolveEntryTime } from "@/lib/org-events/entry-time";
import {
  DURATION_PRESETS,
  formatDuration,
  HOUR_OPTIONS,
  MAX_DURATION_MIN,
  MIN_DURATION,
  MIN_OPTIONS,
  pad,
} from "@/lib/org-events/schedule-core";

const INPUT_CLS =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";

export function EventScheduleFields({
  startDate,
  onStartDate,
  startHour,
  onStartHour,
  startMin,
  onStartMin,
  durationMin,
  onDurationMin,
  entryLeadMin,
  onEntryLeadMin,
  startsAt,
  endsAt,
  formatEndLabel,
}: {
  startDate: string;
  onStartDate: (v: string) => void;
  startHour: number;
  onStartHour: (v: number) => void;
  startMin: number;
  onStartMin: (v: number) => void;
  durationMin: number;
  onDurationMin: (v: number) => void;
  /** 문자열인 이유 — 비울 수 있어야 한다("입장 안내 표시 안 함"). */
  entryLeadMin: string;
  onEntryLeadMin: (v: string) => void;
  /** 계산된 시작("YYYY-MM-DDTHH:mm"). 빈 문자열이면 아직 날짜가 없다. */
  startsAt: string;
  /** 계산된 종료. */
  endsAt: string;
  /** 종료 일시를 사람이 읽는 말로. 폼마다 쓰던 함수가 있어 주입받는다. */
  formatEndLabel: (iso: string) => string;
}) {
  // 서버 왕복 없이 즉시 환산. 초대장이 쓰는 것과 **같은 함수**라 저장 전후가
  // 어긋나지 않는다. startsAt 은 datetime-local 문자열이라 KST 로 읽힌다.
  const entryPreview = startsAt
    ? resolveEntryTime(`${startsAt}:00+09:00`, Number(entryLeadMin))
    : null;

  return (
    <div className="space-y-4 rounded-2xl border border-[#E5D3B8] bg-[#FFFDF8] p-4">
      <div>
        <label className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
          ⏰ 시작 일시 (5분 단위)
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input
            id="starts_at_date"
            type="date"
            value={startDate}
            onChange={(e) => onStartDate(e.target.value)}
            aria-label="시작 날짜"
            className={INPUT_CLS}
          />
          <select
            value={startHour}
            onChange={(e) => onStartHour(Number(e.target.value))}
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
            onChange={(e) => onStartMin(Number(e.target.value))}
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

      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <label
            htmlFor="duration"
            className="text-xs font-semibold text-[#2D5A3D]"
          >
            📏 행사 기간 (5분 단위)
          </label>
          <span className="text-sm font-bold text-[#2D5A3D]">
            {formatDuration(durationMin)}
          </span>
        </div>
        <input
          id="duration"
          type="range"
          min={MIN_DURATION}
          max={MAX_DURATION_MIN}
          step={5}
          value={durationMin}
          onChange={(e) => onDurationMin(Number(e.target.value))}
          className="w-full accent-[#2D5A3D]"
        />
        <div className="flex justify-between text-[10px] text-[#6B6560]">
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
              onClick={() => onDurationMin(p.mins)}
              aria-pressed={active}
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
            {endsAt ? formatEndLabel(endsAt) : "시작 일시를 정하면 나와요"}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-[#6B6560]">
          시작 일시 + 기간 슬라이더로 자동 계산됩니다.
        </p>
      </div>

      {/* 🚪 입장가능시간 */}
      <div className="rounded-xl border border-[#E5D3B8] bg-[#FFF8F0] px-3 py-2.5">
        <label
          htmlFor="invitation_entry_lead_min"
          className="mb-1.5 block text-xs font-semibold text-[#6B4423]"
        >
          🚪 입장가능시간 (선택)
        </label>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-[#6B6560]">행사 시작</span>
          <input
            id="invitation_entry_lead_min"
            type="number"
            min={0}
            max={240}
            inputMode="numeric"
            value={entryLeadMin}
            onChange={(e) => onEntryLeadMin(e.target.value)}
            placeholder="20"
            className="w-20 rounded-lg border border-[#E5D3B8] bg-white px-3 py-1.5 text-sm text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
          />
          <span className="shrink-0 text-xs text-[#6B6560]">분 전부터</span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-[#6B6560]">
          {!startsAt
            ? "행사 시작 일시를 정하면 입장시간이 계산돼요."
            : entryPreview
              ? `초대장에 “${entryPreview.label}” 로 표시돼요.`
              : "비우면 초대장에 입장 안내가 표시되지 않아요."}
        </p>
      </div>
    </div>
  );
}
