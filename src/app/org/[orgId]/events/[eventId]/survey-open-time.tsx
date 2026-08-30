"use client";

// 설문이 열리는 시각 — 행사 종료 몇 분 전부터.
//
// 왜 숫자 하나인가:
//   "언제 열지" 를 시각으로 받으면 행사 시각을 옮겼을 때 설문만 옛날 시각에
//   남는다. 분으로 두면 따라온다. 초대장 입장시간과 같은 방식이다.
//
// 저장 전에 **몇 시가 되는지 미리 보여준다.** "30분 전" 만 적혀 있으면 그게
// 몇 시인지 매번 계산해야 한다.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSurveyLeadAction } from "@/lib/org-events/survey-actions";
import {
  DEFAULT_SURVEY_LEAD_MIN,
  parseSurveyLeadInput,
  resolveSurveyOpenAt,
} from "@/lib/org-events/survey-core";

export function SurveyOpenTime({
  eventId,
  endsAt,
  initialLeadMin,
}: {
  eventId: string;
  endsAt: string | null;
  /** undefined = 컬럼 미적용 배포 창 → 기본 30분으로 보여준다. */
  initialLeadMin?: number | null;
}) {
  const router = useRouter();
  const [raw, setRaw] = useState(
    String(
      initialLeadMin === undefined
        ? DEFAULT_SURVEY_LEAD_MIN
        : (initialLeadMin ?? "")
    )
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 저장 전 미리보기 — 저장 후와 같은 함수를 쓴다. 어긋날 수 없다.
  const preview = resolveSurveyOpenAt(endsAt, parseSurveyLeadInput(raw));

  function onSave() {
    if (pending) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await setSurveyLeadAction(eventId, raw);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden className="mr-1.5">
            ⏰
          </span>
          열리는 시각
        </h3>
        <span className="text-xs text-[#8B7F75]">행사 끝나기</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={240}
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setSaved(false);
          }}
          className="w-16 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-2 py-1.5 text-center text-sm font-bold tabular-nums text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none"
        />
        <span className="text-xs text-[#8B7F75]">분 전부터</span>
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="ml-auto rounded-xl bg-[#2D5A3D] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#3A7A52] disabled:opacity-50"
        >
          {pending ? "저장 중…" : saved ? "저장됨" : "저장"}
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-[#6B6560]">
        {preview ? (
          <>
            🕐 <b className="text-[#2D5A3D]">{preview.label}</b> 참가자 화면에
            설문이 뜹니다 — 아직 행사장에 있을 때요.
          </>
        ) : endsAt ? (
          "자동으로 열지 않아요. 행사를 🏁 종료하면 그때 열립니다."
        ) : (
          "행사 종료 시각을 정하면 그 시각을 기준으로 자동으로 열려요. 지금은 🏁 종료를 눌러야 열립니다."
        )}
      </p>

      {error && (
        <p role="alert" className="mt-2 text-[11px] font-semibold text-rose-700">
          ⚠ {error}
        </p>
      )}
    </section>
  );
}
