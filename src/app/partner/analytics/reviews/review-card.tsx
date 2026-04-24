"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { UnifiedReview, ReviewPlatform } from "@/lib/reviews/queries";

interface Props {
  review: UnifiedReview;
  replyAction: (reviewId: string, formData: FormData) => Promise<void>;
  flagAction: (reviewId: string) => Promise<void>;
}

const PLATFORM_META: Record<ReviewPlatform, { label: string; icon: string; className: string }> = {
  TORIRO: {
    label: "토리로",
    icon: "🏡",
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  NAVER: {
    label: "네이버",
    icon: "N",
    className: "bg-green-50 text-green-800 border-green-200",
  },
  GOOGLE: {
    label: "구글",
    icon: "G",
    className: "bg-blue-50 text-blue-800 border-blue-200",
  },
  INSTAGRAM: {
    label: "인스타",
    icon: "📷",
    className: "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200",
  },
  BLOG: {
    label: "블로그",
    icon: "✍️",
    className: "bg-zinc-50 text-zinc-700 border-zinc-200",
  },
  KAKAO: {
    label: "카카오",
    icon: "💬",
    className: "bg-yellow-50 text-yellow-900 border-yellow-300",
  },
  MANUAL: {
    label: "수동",
    icon: "📝",
    className: "bg-[#FFF8F0] text-[#8B6F47] border-[#E5D3B8]",
  },
};

function renderStars(rating: number): string {
  const r = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(r) + "☆".repeat(5 - r);
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 0) return "방금 전";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "방금 전";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  if (day < 30) return `${Math.floor(day / 7)}주 전`;
  if (day < 365) return `${Math.floor(day / 30)}개월 전`;
  return `${Math.floor(day / 365)}년 전`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function ReviewCard({ review, replyAction, flagAction }: Props) {
  const [editingReply, setEditingReply] = useState(false);
  const [replyText, setReplyText] = useState(review.response_text ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const meta = PLATFORM_META[review.platform] ?? PLATFORM_META.MANUAL;
  const hasReply = !!review.response_text;

  const boundReply = replyAction.bind(null, review.id);
  const boundFlag = flagAction.bind(null, review.id);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        await boundReply(formData);
        setEditingReply(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장에 실패했어요");
      }
    });
  };

  const handleToggleFlag = () => {
    startTransition(async () => {
      try {
        await boundFlag();
      } catch {
        // ignore
      }
    });
  };

  return (
    <article
      className={`rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm transition ${
        review.is_flagged ? "opacity-60" : ""
      }`}
      aria-label={`${meta.label} 리뷰, 별점 ${review.rating}점`}
    >
      {/* 상단: 별점 + 플랫폼 + 시간 */}
      <header className="flex flex-wrap items-center gap-2">
        <span
          className="font-mono text-base tracking-tight text-amber-500"
          aria-label={`${review.rating}점`}
        >
          {renderStars(review.rating)}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}
        >
          <span aria-hidden>{meta.icon}</span>
          <span>{meta.label}</span>
        </span>
        {review.is_flagged && (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
            🚩 신고됨
          </span>
        )}
        <span className="ml-auto text-[11px] text-[#8B7F75]" title={formatDate(review.created_at)}>
          {relativeTime(review.created_at)}
        </span>
      </header>

      {/* 작성자 / 프로그램 */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#6B6560]">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden>👤</span>
          <span className="font-semibold text-[#2D5A3D]">
            {review.author_name || "익명"}
          </span>
        </span>
        {review.program_title && (
          <span className="inline-flex items-center gap-1">
            <span aria-hidden>🗺️</span>
            <span className="truncate max-w-[240px]">{review.program_title}</span>
          </span>
        )}
        {review.event_name && (
          <span className="inline-flex items-center gap-1">
            <span aria-hidden>📅</span>
            <span className="truncate max-w-[200px]">{review.event_name}</span>
          </span>
        )}
      </div>

      {/* 리뷰 본문 */}
      {review.content && (
        <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-[#FFF8F0] p-3 text-sm leading-relaxed text-[#2C2C2C]">
          {review.content}
        </p>
      )}

      {/* 답글 영역 */}
      <div className="mt-3">
        {!hasReply && !editingReply && (
          <button
            type="button"
            onClick={() => setEditingReply(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
          >
            <span aria-hidden>💬</span>
            <span>답글 작성</span>
          </button>
        )}

        {hasReply && !editingReply && (
          <div className="rounded-xl bg-[#F5F1E8] p-3 text-xs">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold text-[#6B4423]">
                💬 숲지기 답변
                {review.response_at && (
                  <span className="ml-2 font-normal text-[#8B7F75]">
                    · {formatDate(review.response_at)}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  setReplyText(review.response_text ?? "");
                  setEditingReply(true);
                }}
                className="text-[11px] font-semibold text-[#2D5A3D] hover:underline"
              >
                ✏️ 수정
              </button>
            </div>
            <p className="whitespace-pre-wrap break-words leading-relaxed text-[#2C2C2C]">
              {review.response_text}
            </p>
          </div>
        )}

        {editingReply && (
          <form
            action={handleSubmit}
            className="space-y-2"
            aria-label="답글 작성 폼"
          >
            <label htmlFor={`reply-${review.id}`} className="sr-only">
              답글 내용
            </label>
            <textarea
              id={`reply-${review.id}`}
              name="response"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="참가자에게 전할 답변을 정성스럽게 적어주세요."
              required
              disabled={isPending}
              className="w-full resize-y rounded-xl border border-[#D4E4BC] bg-white p-3 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20 disabled:opacity-50"
            />
            {error && (
              <p className="text-xs text-red-600" role="alert">
                {error}
              </p>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-[#8B7F75]">
                {replyText.length} / 2000
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingReply(false);
                    setReplyText(review.response_text ?? "");
                    setError(null);
                  }}
                  disabled={isPending}
                  className="rounded-lg border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B6560] hover:bg-[#F5F1E8] disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending || !replyText.trim()}
                  className="rounded-lg bg-[#2D5A3D] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#234a30] disabled:opacity-50"
                >
                  {isPending ? "저장 중..." : "답글 저장"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* 하단 액션 */}
      <footer className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-[#EFE9E1] pt-3 text-[11px]">
        <button
          type="button"
          onClick={handleToggleFlag}
          disabled={isPending}
          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-semibold transition disabled:opacity-50 ${
            review.is_flagged
              ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              : "border-[#D4E4BC] bg-white text-[#6B6560] hover:bg-[#F5F1E8]"
          }`}
          aria-pressed={review.is_flagged}
        >
          <span aria-hidden>🚩</span>
          <span>{review.is_flagged ? "신고 해제" : "신고"}</span>
        </button>

        {review.source === "EXTERNAL" && review.source_url && (
          <Link
            href={review.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-[#D4E4BC] bg-white px-2 py-1 font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            <span aria-hidden>🔗</span>
            <span>원본 보기</span>
          </Link>
        )}

        <span className="ml-auto text-[10px] text-[#B5AFA8]">
          {review.source === "INTERNAL" ? "토리로 내부" : "외부 플랫폼"}
        </span>
      </footer>
    </article>
  );
}
