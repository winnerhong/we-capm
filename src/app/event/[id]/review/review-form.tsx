"use client";

import { useState, useTransition } from "react";
import { submitReviewAction, updateReviewAction } from "./actions";

export interface MissionOption {
  id: string;
  title: string;
}

export interface ReviewFormValues {
  rating: number;
  comment: string | null;
  mission_highlight: string | null;
  improvement: string | null;
  photo_consent: boolean;
  is_public: boolean;
}

interface Props {
  eventId: string;
  missions: MissionOption[];
  initial?: ReviewFormValues | null;
  mode: "create" | "edit";
}

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div className="flex items-center justify-center gap-2" role="radiogroup" aria-label="별점">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= display;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n}점`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => onChange(n)}
            className="rounded-full p-1 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-12 w-12 transition-colors md:h-14 md:w-14 ${
                filled ? "fill-[#F5C518] stroke-[#F5C518]" : "fill-transparent stroke-[#C9C3BA]"
              }`}
              strokeWidth={1.5}
              strokeLinejoin="round"
            >
              <path d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.58L12 17.58l-5.9 3.1 1.13-6.58L2.45 9.44l6.6-.96L12 2.5z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

export default function ReviewForm({ eventId, missions, initial, mode }: Props) {
  const [rating, setRating] = useState<number>(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [highlight, setHighlight] = useState(initial?.mission_highlight ?? "");
  const [improvement, setImprovement] = useState(initial?.improvement ?? "");
  const [photoConsent, setPhotoConsent] = useState(initial?.photo_consent ?? false);
  const [isPublic, setIsPublic] = useState(initial?.is_public ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const action = mode === "edit" ? updateReviewAction : submitReviewAction;

  const onSubmit = (formData: FormData) => {
    setError(null);
    if (rating < 1) {
      setError("별점을 선택해주세요");
      return;
    }
    formData.set("rating", String(rating));
    formData.set("photo_consent", photoConsent ? "on" : "");
    formData.set("is_public", isPublic ? "on" : "");
    startTransition(async () => {
      try {
        await action(eventId, formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "후기 저장에 실패했어요");
      }
    });
  };

  const labelFor = (n: number) =>
    ["선택해주세요", "별로였어요", "아쉬웠어요", "괜찮았어요", "좋았어요", "최고였어요"][n] ?? "";

  return (
    <form action={onSubmit} className="space-y-5">
      {/* 별점 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 text-center">
        <div className="text-sm font-semibold text-[#2D5A3D]">🌿 오늘의 숲길은 어떠셨나요?</div>
        <div className="mt-4">
          <StarPicker value={rating} onChange={setRating} />
        </div>
        <div className="mt-2 text-sm text-[#6B6560]" aria-live="polite">
          {labelFor(rating)}
        </div>
        <input type="hidden" name="rating" value={rating} />
      </section>

      {/* 전체 후기 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <label htmlFor="comment" className="text-sm font-semibold text-[#2D5A3D]">
          전체 후기
        </label>
        <textarea
          id="comment"
          name="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder="숲길을 걸으며 느낀 점을 자유롭게 남겨주세요"
          className="mt-2 w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
        />
      </section>

      {/* 가장 좋았던 숲길 */}
      {missions.length > 0 && (
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
          <label htmlFor="mission_highlight" className="text-sm font-semibold text-[#2D5A3D]">
            🌲 가장 좋았던 숲길
          </label>
          <select
            id="mission_highlight"
            name="mission_highlight"
            value={highlight}
            onChange={(e) => setHighlight(e.target.value)}
            className="mt-2 w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
          >
            <option value="">선택 안함</option>
            {missions.map((m) => (
              <option key={m.id} value={m.title}>
                {m.title}
              </option>
            ))}
          </select>
        </section>
      )}

      {/* 개선 제안 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <label htmlFor="improvement" className="text-sm font-semibold text-[#2D5A3D]">
          아쉬웠던 점 · 개선 제안
          <span className="ml-1 text-xs font-normal text-[#6B6560]">(선택)</span>
        </label>
        <textarea
          id="improvement"
          name="improvement"
          value={improvement}
          onChange={(e) => setImprovement(e.target.value)}
          rows={3}
          placeholder="다음 숲길을 더 좋게 만들 수 있는 의견을 들려주세요"
          className="mt-2 w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
        />
      </section>

      {/* 동의 */}
      <section className="space-y-2 rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <label className="flex items-start gap-3 text-sm text-[#2C2C2C]">
          <input
            type="checkbox"
            name="photo_consent"
            checked={photoConsent}
            onChange={(e) => setPhotoConsent(e.target.checked)}
            className="mt-0.5 h-5 w-5 rounded border-[#A8C686] text-violet-600 focus:ring-violet-500"
          />
          <span>
            제출한 사진의 캠프닉 홍보 활용에 동의합니다
            <div className="text-xs text-[#6B6560]">(SNS, 공식 사이트 등)</div>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm text-[#2C2C2C]">
          <input
            type="checkbox"
            name="is_public"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="mt-0.5 h-5 w-5 rounded border-[#A8C686] text-violet-600 focus:ring-violet-500"
          />
          <span>
            후기 내용을 다른 사용자에게 공개합니다
            <div className="text-xs text-[#6B6560]">이름은 마스킹되어 노출돼요</div>
          </span>
        </label>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-2xl bg-violet-600 py-4 text-base font-bold text-white shadow-md hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-60"
      >
        {isPending ? "저장 중..." : mode === "edit" ? "🌱 후기 수정하기" : "🌱 후기 남기기"}
      </button>
    </form>
  );
}
