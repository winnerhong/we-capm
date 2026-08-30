"use client";

// 설문 폼 — 별점 · 가장 좋았던 미션 · 한 줄.
//
// 별점을 라디오 버튼이 아니라 큰 별 다섯 개로 두는 이유: 폰에서 한 손으로 누른다.
// 작은 동그라미는 빗나가고, 빗나가면 다시 안 한다.
//
// "가장 좋았던 미션" 은 건너뛸 수 있다. 필수로 만들면 기억이 안 나는 사람이
// 아무거나 고르고, 그 순간 이 문항의 집계는 쓸모가 없어진다.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  SURVEY_COMMENT_MAX,
  SURVEY_MAX_RATING,
  ratingLabel,
} from "@/lib/org-events/survey-core";
import { submitSurveyAction } from "@/lib/org-events/survey-actions";

type MissionChoice = { id: string; title: string; icon: string | null };

export function SurveyForm({
  eventId,
  homeHref,
  missions,
  initial,
}: {
  eventId: string;
  homeHref: string;
  missions: MissionChoice[];
  initial: { rating: number; bestMissionId: string | null; comment: string } | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [best, setBest] = useState<string | null>(initial?.bestMissionId ?? null);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isEdit = !!initial;

  function onSubmit() {
    if (pending) return;
    if (rating < 1) {
      setError("별점을 골라주세요");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await submitSurveyAction(eventId, {
        rating,
        bestMissionId: best,
        comment,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  if (done) {
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-6 text-center shadow-sm">
        <p className="text-4xl" aria-hidden>
          🌰
        </p>
        <h2 className="mt-2 text-base font-bold text-[#2D5A3D]">
          고맙습니다!
        </h2>
        <p className="mt-1 text-xs text-[#6B6560]">
          남겨주신 의견은 다음 행사에 반영돼요.
        </p>
        <a
          href={homeHref}
          className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-[#2D5A3D] px-5 py-2.5 text-sm font-bold text-white"
        >
          🎪 행사홈으로
        </a>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1) 별점 */}
      <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-[#2D5A3D]">
          오늘 행사, 어떠셨어요?
        </h2>
        <div className="mt-3 flex justify-center gap-1">
          {Array.from({ length: SURVEY_MAX_RATING }, (_, i) => i + 1).map(
            (n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n}점`}
                aria-pressed={rating === n}
                className={`text-4xl transition active:scale-90 ${
                  n <= rating ? "text-amber-400" : "text-[#E5D3B8]"
                }`}
              >
                ★
              </button>
            )
          )}
        </div>
        <p className="mt-1 h-5 text-center text-xs font-bold text-[#6B6560]">
          {rating > 0 ? ratingLabel(rating) : ""}
        </p>
      </section>

      {/* 2) 가장 좋았던 것 — 건너뛸 수 있다 */}
      {missions.length > 0 && (
        <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-[#2D5A3D]">
            가장 좋았던 건 뭐였나요?
            <span className="ml-1.5 text-[11px] font-normal text-[#8B7F75]">
              선택
            </span>
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {missions.map((m) => {
              const on = best === m.id;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setBest(on ? null : m.id)}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-bold transition ${
                      on
                        ? "border-[#2D5A3D] bg-[#E8F0E4] text-[#2D5A3D]"
                        : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-[#2D5A3D]"
                    }`}
                  >
                    <span aria-hidden>{m.icon ?? "🌿"}</span>
                    {m.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 3) 한 줄 */}
      <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <label
          htmlFor="survey-comment"
          className="text-sm font-bold text-[#2D5A3D]"
        >
          더 하고 싶은 말이 있다면
          <span className="ml-1.5 text-[11px] font-normal text-[#8B7F75]">
            선택
          </span>
        </label>
        <textarea
          id="survey-comment"
          rows={3}
          maxLength={SURVEY_COMMENT_MAX}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="좋았던 점, 아쉬웠던 점 무엇이든"
          className="mt-2 w-full rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#3D3A36] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
        />
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
        >
          ⚠️ {error}
        </p>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={pending}
        className="min-h-[56px] w-full rounded-2xl bg-[#2D5A3D] px-4 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#3A7A52] disabled:bg-[#B8C7B0]"
      >
        {pending ? "보내는 중…" : isEdit ? "고쳐서 다시 보내기" : "보내기"}
      </button>
    </div>
  );
}
