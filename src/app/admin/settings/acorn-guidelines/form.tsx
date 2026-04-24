"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { updatePlatformAcornGuidelinesAction } from "./actions";
import { AcornIcon } from "@/components/acorn-icon";

interface InitialValues {
  max_daily_suggested: number;
  max_daily_hard_cap: number;
  max_per_mission: number;
  suggested_range_min: number;
  suggested_range_max: number;
  notes: string;
}

interface Props {
  initial: InitialValues;
}

export function GuidelinesForm({ initial }: Props) {
  const [maxDailySuggested, setMaxDailySuggested] = useState<number>(
    initial.max_daily_suggested
  );
  const [maxDailyHardCap, setMaxDailyHardCap] = useState<number>(
    initial.max_daily_hard_cap
  );
  const [maxPerMission, setMaxPerMission] = useState<number>(
    initial.max_per_mission
  );
  const [rangeMin, setRangeMin] = useState<number>(initial.suggested_range_min);
  const [rangeMax, setRangeMax] = useState<number>(initial.suggested_range_max);
  const [notes, setNotes] = useState<string>(initial.notes);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const clientError = useMemo(() => {
    if (
      [
        maxDailySuggested,
        maxDailyHardCap,
        maxPerMission,
        rangeMin,
        rangeMax,
      ].some((v) => !Number.isFinite(v) || v <= 0)
    ) {
      return "모든 숫자 값은 1 이상의 정수여야 해요";
    }
    if (maxDailyHardCap < maxDailySuggested) {
      return "절대 하드캡은 권장 일일 상한보다 크거나 같아야 해요";
    }
    if (rangeMin > rangeMax) {
      return "권장 범위 최소값이 최대값보다 커요";
    }
    if (rangeMax > maxDailySuggested) {
      return "권장 범위 최대값은 권장 일일 상한을 넘을 수 없어요";
    }
    if (maxPerMission > maxDailySuggested) {
      return "미션당 상한은 권장 일일 상한을 넘을 수 없어요";
    }
    return null;
  }, [
    maxDailySuggested,
    maxDailyHardCap,
    maxPerMission,
    rangeMin,
    rangeMax,
  ]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    if (clientError) {
      setServerError(clientError);
      return;
    }
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updatePlatformAcornGuidelinesAction(fd);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // NEXT_REDIRECT 는 성공 신호 — 그대로 통과
        if (/NEXT_REDIRECT/i.test(msg)) return;
        setServerError(msg);
      }
    });
  }

  const inputClass =
    "w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2D5A3D]";

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-2xl border border-[#D4E4BC] bg-white p-5 sm:p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={
            <span className="inline-flex items-center gap-1">
              <AcornIcon /> 플랫폼 권장 일일 상한
            </span>
          }
          hint="기관이 기본적으로 따르길 권장하는 일일 상한"
          name="max_daily_suggested"
          value={maxDailySuggested}
          onChange={setMaxDailySuggested}
          inputClass={inputClass}
        />
        <Field
          label="🚫 절대 하드캡"
          hint="기관이 이 값보다 높게 설정할 수 없음"
          name="max_daily_hard_cap"
          value={maxDailyHardCap}
          onChange={setMaxDailyHardCap}
          inputClass={inputClass}
        />
        <Field
          label="🎯 미션당 상한"
          hint="한 개 미션으로 최대 지급 가능한 도토리"
          name="max_per_mission"
          value={maxPerMission}
          onChange={setMaxPerMission}
          inputClass={inputClass}
        />
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="📉 권장 범위 Min"
            hint=""
            name="suggested_range_min"
            value={rangeMin}
            onChange={setRangeMin}
            inputClass={inputClass}
          />
          <Field
            label="📈 권장 범위 Max"
            hint=""
            name="suggested_range_max"
            value={rangeMax}
            onChange={setRangeMax}
            inputClass={inputClass}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="acorn-notes"
          className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
        >
          📝 관리자 메모
        </label>
        <textarea
          id="acorn-notes"
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="기관에게 보여줄 정책 설명, 권장 근거 등"
          className={`${inputClass} resize-y`}
        />
      </div>

      {(clientError || serverError) && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {serverError ?? clientError}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={pending || !!clientError}
          className="rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#254A32] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "저장 중..." : "💾 저장하기"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  name,
  value,
  onChange,
  inputClass,
}: {
  label: ReactNode;
  hint: string;
  name: string;
  value: number;
  onChange: (n: number) => void;
  inputClass: string;
}) {
  const id = `acorn-${name}`;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        required
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inputClass}
      />
      {hint && <p className="mt-1 text-[11px] text-[#6B6560]">{hint}</p>}
    </div>
  );
}
