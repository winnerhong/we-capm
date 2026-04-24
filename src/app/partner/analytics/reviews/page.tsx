import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  loadInternalReviews,
  loadExternalReviews,
  loadReviewStats,
  type UnifiedReview,
  type ReviewPlatform,
} from "@/lib/reviews/queries";
import {
  replyInternalReviewAction,
  replyExternalReviewAction,
  toggleFlagInternalAction,
  toggleFlagExternalAction,
} from "./actions";
import { ReviewCard } from "./review-card";

export const dynamic = "force-dynamic";

type ResponseFilter = "ALL" | "ANSWERED" | "UNANSWERED";
type RatingFilter = "ALL" | "5" | "4_5" | "LOW";
type PeriodFilter = "ALL" | "WEEK" | "MONTH" | "QUARTER" | "YEAR";

const PLATFORM_OPTIONS: { value: ReviewPlatform | "ALL"; label: string }[] = [
  { value: "ALL", label: "전체 플랫폼" },
  { value: "TORIRO", label: "🏡 토리로" },
  { value: "NAVER", label: "네이버" },
  { value: "GOOGLE", label: "구글" },
  { value: "INSTAGRAM", label: "인스타그램" },
  { value: "BLOG", label: "블로그" },
  { value: "KAKAO", label: "카카오" },
  { value: "MANUAL", label: "수동 등록" },
];

const RATING_OPTIONS: { value: RatingFilter; label: string }[] = [
  { value: "ALL", label: "별점 전체" },
  { value: "5", label: "5★" },
  { value: "4_5", label: "4~5★" },
  { value: "LOW", label: "3★ 이하" },
];

const RESPONSE_OPTIONS: { value: ResponseFilter; label: string }[] = [
  { value: "ALL", label: "응답 전체" },
  { value: "ANSWERED", label: "답변 완료" },
  { value: "UNANSWERED", label: "미응답" },
];

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: "ALL", label: "전체 기간" },
  { value: "WEEK", label: "이번 주" },
  { value: "MONTH", label: "이번 달" },
  { value: "QUARTER", label: "분기" },
  { value: "YEAR", label: "올해" },
];

type ProgramItem = { id: string; title: string };

async function loadPartnerPrograms(partnerId: string): Promise<ProgramItem[]> {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase.from("partner_programs") as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            order: (
              k: string,
              opts: { ascending: boolean }
            ) => Promise<{ data: ProgramItem[] | null }>;
          };
        };
      }
    )
      .select("id,title")
      .eq("partner_id", partnerId)
      .order("title", { ascending: true });
    return (data ?? []) as ProgramItem[];
  } catch {
    return [];
  }
}

function periodStart(period: PeriodFilter): Date | null {
  const now = new Date();
  if (period === "WEEK") {
    const d = new Date(now);
    const day = d.getDay(); // 0=Sun
    const mondayOffset = (day + 6) % 7;
    d.setDate(d.getDate() - mondayOffset);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "MONTH") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (period === "QUARTER") {
    const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return new Date(now.getFullYear(), qStartMonth, 1);
  }
  if (period === "YEAR") {
    return new Date(now.getFullYear(), 0, 1);
  }
  return null;
}

function applyFilters(
  reviews: UnifiedReview[],
  filters: {
    platform: string;
    rating: RatingFilter;
    responseFilter: ResponseFilter;
    programId: string;
    period: PeriodFilter;
    q: string;
  }
): UnifiedReview[] {
  const start = periodStart(filters.period);
  const qLower = filters.q.trim().toLowerCase();

  return reviews.filter((r) => {
    if (filters.platform !== "ALL" && r.platform !== filters.platform) return false;

    if (filters.rating !== "ALL") {
      if (filters.rating === "5" && r.rating < 5) return false;
      if (filters.rating === "4_5" && r.rating < 4) return false;
      if (filters.rating === "LOW" && r.rating > 3) return false;
    }

    if (filters.responseFilter === "ANSWERED" && !r.response_text) return false;
    if (filters.responseFilter === "UNANSWERED" && r.response_text) return false;

    if (filters.programId && r.program_id !== filters.programId) return false;

    if (start) {
      const created = new Date(r.created_at);
      if (created < start) return false;
    }

    if (qLower) {
      const hay = [
        r.content ?? "",
        r.author_name ?? "",
        r.program_title ?? "",
        r.event_name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(qLower)) return false;
    }

    return true;
  });
}

export default async function PartnerReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{
    platform?: string;
    rating?: string;
    responseFilter?: string;
    programId?: string;
    period?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const partner = await requirePartner();

  const platform = (params.platform ?? "ALL").toUpperCase();
  const rating: RatingFilter = (["5", "4_5", "LOW"].includes(params.rating ?? "")
    ? (params.rating as RatingFilter)
    : "ALL");
  const responseFilter: ResponseFilter = (["ANSWERED", "UNANSWERED"].includes(
    params.responseFilter ?? ""
  )
    ? (params.responseFilter as ResponseFilter)
    : "ALL");
  const programId = params.programId ?? "";
  const period: PeriodFilter = (["WEEK", "MONTH", "QUARTER", "YEAR"].includes(
    params.period ?? ""
  )
    ? (params.period as PeriodFilter)
    : "ALL");
  const q = params.q ?? "";

  const [internalReviews, externalReviews, stats, programs] = await Promise.all([
    loadInternalReviews(partner.id),
    loadExternalReviews(partner.id),
    loadReviewStats(partner.id),
    loadPartnerPrograms(partner.id),
  ]);

  const allReviews: UnifiedReview[] = [...internalReviews, ...externalReviews].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const filtered = applyFilters(allReviews, {
    platform,
    rating,
    responseFilter,
    programId,
    period,
    q,
  });

  const PAGE_SIZE = 50;
  const visibleReviews = filtered.slice(0, PAGE_SIZE);
  const hasMore = filtered.length > PAGE_SIZE;

  const maxDist = Math.max(1, ...Object.values(stats.distribution));

  // 필터 하나라도 활성이면 "필터 초기화" 표시
  const hasActiveFilter =
    platform !== "ALL" ||
    rating !== "ALL" ||
    responseFilter !== "ALL" ||
    programId !== "" ||
    period !== "ALL" ||
    q !== "";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/analytics" className="hover:text-[#2D5A3D]">
          분석
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">리뷰 관리</span>
      </nav>

      {/* Header */}
      <header className="flex flex-col gap-3 rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FFF8F0] p-5 shadow-sm md:flex-row md:items-center md:justify-between md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            ⭐
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              리뷰 관리
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              내부(토리로)와 외부(네이버·구글 등) 리뷰를 한 곳에서 응답하고 관리해요
            </p>
          </div>
        </div>
        <Link
          href="/partner/analytics/reviews/new-external"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#234a30] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/40"
        >
          <span aria-hidden>➕</span>
          <span>외부 리뷰 추가</span>
        </Link>
      </header>

      {/* 1. 통계 4카드 */}
      <section aria-label="리뷰 통계" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-[#6B6560]">
            💬 전체 리뷰
          </span>
          <p className="mt-2 text-2xl font-extrabold text-[#2D5A3D]">
            {stats.total.toLocaleString("ko-KR")}
            <span className="ml-1 text-sm font-semibold">건</span>
          </p>
          <p className="mt-0.5 text-[11px] text-[#B5AFA8]">
            내부 {stats.internalCount} · 외부 {stats.externalCount}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-amber-700">
            ⭐ 평균 별점
          </span>
          <p className="mt-2 text-2xl font-extrabold text-amber-900">
            {stats.average > 0 ? stats.average.toFixed(1) : "-"}
            <span className="ml-1 text-sm font-semibold text-amber-700">/ 5</span>
          </p>
          <p className="mt-0.5 text-[11px] text-amber-700/70">
            {stats.total > 0 ? `${stats.total}건 기준` : "리뷰 없음"}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-emerald-700">
            🌱 이번 달 신규
          </span>
          <p className="mt-2 text-2xl font-extrabold text-emerald-900">
            {stats.thisMonth.toLocaleString("ko-KR")}
            <span className="ml-1 text-sm font-semibold">건</span>
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-700/70">최근 30일</p>
        </div>

        <div
          className={`rounded-2xl border p-4 shadow-sm ${
            stats.unanswered > 0
              ? "border-amber-300 bg-amber-100"
              : "border-[#D4E4BC] bg-white"
          }`}
        >
          <span
            className={`text-[11px] font-semibold ${
              stats.unanswered > 0 ? "text-amber-800" : "text-[#6B6560]"
            }`}
          >
            {stats.unanswered > 0 ? "🚨 미응답" : "✅ 미응답"}
          </span>
          <p
            className={`mt-2 text-2xl font-extrabold ${
              stats.unanswered > 0 ? "text-amber-900" : "text-[#2D5A3D]"
            }`}
          >
            {stats.unanswered.toLocaleString("ko-KR")}
            <span className="ml-1 text-sm font-semibold">건</span>
          </p>
          <p
            className={`mt-0.5 text-[11px] ${
              stats.unanswered > 0 ? "text-amber-800/80" : "text-[#B5AFA8]"
            }`}
          >
            {stats.unanswered > 0 ? "답변이 필요해요" : "모두 답변 완료"}
          </p>
        </div>
      </section>

      {/* 2. 별점 분포 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm md:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span aria-hidden>📊</span>
          <span>별점 분포</span>
        </h2>
        <ul className="space-y-2.5">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const count = stats.distribution[star] ?? 0;
            const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
            const widthPct = Math.round((count / maxDist) * 100);
            return (
              <li key={star} className="flex items-center gap-3">
                <span className="w-[72px] flex-shrink-0 font-mono text-sm text-amber-500">
                  {"★".repeat(star)}
                  <span className="text-[#E5DCD0]">{"★".repeat(5 - star)}</span>
                </span>
                <div
                  className="h-3 flex-1 overflow-hidden rounded-full bg-[#F0EBE3]"
                  role="progressbar"
                  aria-valuenow={count}
                  aria-valuemin={0}
                  aria-valuemax={stats.total || 1}
                  aria-label={`${star}점 ${count}건 (${pct}%)`}
                >
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="w-[110px] flex-shrink-0 text-right text-xs text-[#6B6560]">
                  <b className="text-[#2D5A3D]">{pct}%</b>
                  <span className="ml-1 text-[#8B7F75]">({count}건)</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 3. 필터 바 (GET form) */}
      <section
        aria-label="리뷰 필터"
        className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm md:p-5"
      >
        <form method="GET" className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-[#6B6560]">플랫폼</span>
              <select
                name="platform"
                defaultValue={platform}
                className="rounded-xl border border-[#D4E4BC] bg-white px-2 py-2 text-xs font-semibold text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
              >
                {PLATFORM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-[#6B6560]">별점</span>
              <select
                name="rating"
                defaultValue={rating}
                className="rounded-xl border border-[#D4E4BC] bg-white px-2 py-2 text-xs font-semibold text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
              >
                {RATING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-[#6B6560]">응답</span>
              <select
                name="responseFilter"
                defaultValue={responseFilter}
                className="rounded-xl border border-[#D4E4BC] bg-white px-2 py-2 text-xs font-semibold text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
              >
                {RESPONSE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-[#6B6560]">프로그램</span>
              <select
                name="programId"
                defaultValue={programId}
                className="rounded-xl border border-[#D4E4BC] bg-white px-2 py-2 text-xs font-semibold text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
              >
                <option value="">전체 프로그램</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-[#6B6560]">기간</span>
              <select
                name="period"
                defaultValue={period}
                className="rounded-xl border border-[#D4E4BC] bg-white px-2 py-2 text-xs font-semibold text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
              >
                {PERIOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8B7F75]">
                🔍
              </span>
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="리뷰 내용·작성자·프로그램명으로 검색"
                inputMode="search"
                autoComplete="off"
                className="w-full rounded-xl border border-[#D4E4BC] bg-white py-2 pl-8 pr-3 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-bold text-white hover:bg-[#234a30] md:flex-none"
              >
                적용
              </button>
              {hasActiveFilter && (
                <Link
                  href="/partner/analytics/reviews"
                  className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#6B6560] hover:bg-[#F5F1E8]"
                >
                  초기화
                </Link>
              )}
            </div>
          </div>
        </form>
      </section>

      {/* 4. 리뷰 리스트 */}
      <section aria-label="리뷰 목록" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#2D5A3D]">
            🌲 리뷰 {filtered.length.toLocaleString("ko-KR")}건
            {hasActiveFilter && (
              <span className="ml-2 text-xs font-normal text-[#6B6560]">
                (필터 적용됨)
              </span>
            )}
          </h2>
        </div>

        {visibleReviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] py-12 text-center">
            <div className="text-3xl" aria-hidden>
              🌱
            </div>
            <p className="mt-2 text-sm font-semibold text-[#2D5A3D]">
              조건에 맞는 리뷰가 없어요
            </p>
            <p className="mt-1 text-xs text-[#6B6560]">
              {hasActiveFilter
                ? "필터를 초기화하거나 다른 조건으로 검색해보세요"
                : "첫 리뷰가 등록되면 여기에 모여요"}
            </p>
            {hasActiveFilter && (
              <Link
                href="/partner/analytics/reviews"
                className="mt-3 inline-block rounded-lg bg-[#2D5A3D] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#234a30]"
              >
                필터 초기화
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {visibleReviews.map((review) => {
                const replyAction =
                  review.source === "INTERNAL"
                    ? replyInternalReviewAction
                    : replyExternalReviewAction;
                const flagAction =
                  review.source === "INTERNAL"
                    ? toggleFlagInternalAction
                    : toggleFlagExternalAction;
                return (
                  <ReviewCard
                    key={`${review.source}-${review.id}`}
                    review={review}
                    replyAction={replyAction}
                    flagAction={flagAction}
                  />
                );
              })}
            </div>
            {hasMore && (
              <p className="rounded-xl bg-[#FFF8F0] py-3 text-center text-xs text-[#6B6560]">
                최근 {PAGE_SIZE}건을 표시하고 있어요. 더 많은 리뷰를 보려면 필터를
                활용해주세요.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
