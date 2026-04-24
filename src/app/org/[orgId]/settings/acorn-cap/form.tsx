"use client";

import { useMemo, useState, useTransition } from "react";
import { updateOrgAcornCapAction } from "./actions";
import { AcornIcon } from "@/components/acorn-icon";

interface Props {
  orgId: string;
  initialCap: number;
  /** 플랫폼 권장 범위 */
  suggestedMin: number;
  suggestedMax: number;
  /** 플랫폼 기본값 */
  suggestedDefault: number;
  /** 절대 상한 */
  hardCap: number;
}

export function OrgAcornCapForm({
  orgId,
  initialCap,
  suggestedMin,
  suggestedMax,
  suggestedDefault,
  hardCap,
}: Props) {
  const [cap, setCap] = useState<number>(initialCap);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const status = useMemo<{
    kind: "ok" | "warn" | "error";
    msg: string | null;
  }>(() => {
    if (!Number.isFinite(cap) || cap < 1) {
      return { kind: "error", msg: "1 이상의 정수로 입력해 주세요" };
    }
    if (cap > hardCap) {
      return {
        kind: "error",
        msg: `절대 하드캡(도토리 ${hardCap}개)을 넘길 수 없어요`,
      };
    }
    if (cap < suggestedMin || cap > suggestedMax) {
      return {
        kind: "warn",
        msg: `권장 범위(도토리 ${suggestedMin} ~ ${suggestedMax}개)를 벗어났어요`,
      };
    }
    return { kind: "ok", msg: null };
  }, [cap, hardCap, suggestedMin, suggestedMax]);

  const blocked = status.kind === "error";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    if (blocked) {
      setServerError(status.msg ?? "값을 확인해 주세요");
      return;
    }
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateOrgAcornCapAction(orgId, fd);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/NEXT_REDIRECT/i.test(msg)) return;
        setServerError(msg);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-[#D4E4BC] bg-white p-5 sm:p-6"
    >
      <div>
        <label
          htmlFor="daily_cap"
          className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
        >
          <AcornIcon /> 기관 일일 상한 (유저당)
        </label>
        <input
          id="daily_cap"
          name="daily_cap"
          type="number"
          inputMode="numeric"
          min={1}
          max={hardCap}
          step={1}
          required
          value={Number.isFinite(cap) ? cap : ""}
          onChange={(e) => setCap(Number(e.target.value))}
          className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2D5A3D]"
          aria-invalid={blocked || undefined}
          aria-describedby="cap-status"
        />
        <p className="mt-1 text-[11px] text-[#6B6560]">
          범위: 1 ~ {hardCap} / 권장: {suggestedMin} ~ {suggestedMax}
        </p>
      </div>

      {/* 프리셋 */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCap(suggestedMin)}
          className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
        >
          🍃 보수적 ({suggestedMin})
        </button>
        <button
          type="button"
          onClick={() => setCap(suggestedDefault)}
          className="rounded-xl border border-[#D4E4BC] bg-[#E8F0E4] px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#D4E4BC]"
        >
          🌿 표준 ({suggestedDefault})
        </button>
        <button
          type="button"
          onClick={() => setCap(suggestedMax)}
          className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
        >
          🌳 여유 ({suggestedMax})
        </button>
      </div>

      {/* 상태 메시지 */}
      <div id="cap-status" aria-live="polite">
        {status.kind === "warn" && status.msg && (
          <div
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800"
          >
            ⚠️ {status.msg}
          </div>
        )}
        {status.kind === "error" && status.msg && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700"
          >
            🚫 {status.msg}
          </div>
        )}
      </div>

      {serverError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700"
        >
          {serverError}
        </div>
      )}

      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={pending || blocked}
          className="rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#254A32] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "저장 중..." : "💾 저장하기"}
        </button>
      </div>
    </form>
  );
}
