import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPartner } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

type ProgramCategory = "FOREST" | "CAMPING" | "KIDS" | "FAMILY" | "TEAM" | "ART";

type ProgramRow = {
  id: string;
  partner_id: string | null;
  title: string;
  category: ProgramCategory;
  price_per_person: number;
  rating_avg: number | null;
  rating_count: number;
  booking_count: number;
  is_published: boolean;
};

type PartnerRow = {
  id: string;
  name: string;
  acorn_balance: number;
  avg_rating: number | null;
  total_sales: number;
};

const CATEGORY_META: Record<
  ProgramCategory,
  { label: string; icon: string; color: string }
> = {
  FOREST: { label: "숲 체험", icon: "🌲", color: "bg-emerald-500" },
  CAMPING: { label: "캠핑", icon: "⛺", color: "bg-amber-500" },
  KIDS: { label: "유아·키즈", icon: "👶", color: "bg-rose-400" },
  FAMILY: { label: "가족", icon: "👨‍👩‍👧", color: "bg-sky-500" },
  TEAM: { label: "기업 팀빌딩", icon: "🏢", color: "bg-violet-500" },
  ART: { label: "아트·공예", icon: "🎨", color: "bg-fuchsia-500" },
};

function formatWon(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

async function resolvePartnerId(): Promise<PartnerRow | null> {
  const session = await getPartner();
  const supabase = await createClient();

  if (session?.id) {
    const { data } = await (
      supabase.from("partners") as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: PartnerRow | null }>;
          };
        };
      }
    )
      .select("id,name,acorn_balance,avg_rating,total_sales")
      .eq("id", session.id)
      .maybeSingle();

    if (data) return data;
  }

  // dev fallback: first partner
  const { data } = await (
    supabase.from("partners") as unknown as {
      select: (c: string) => {
        limit: (n: number) => {
          maybeSingle: () => Promise<{ data: PartnerRow | null }>;
        };
      };
    }
  )
    .select("id,name,acorn_balance,avg_rating,total_sales")
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

async function loadPrograms(partnerId: string | null): Promise<ProgramRow[]> {
  if (!partnerId) return [];
  const supabase = await createClient();
  try {
    const { data, error } = await (
      supabase.from("partner_programs") as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => Promise<{ data: ProgramRow[] | null; error: unknown }>;
        };
      }
    )
      .select(
        "id,partner_id,title,category,price_per_person,rating_avg,rating_count,booking_count,is_published"
      )
      .eq("partner_id", partnerId);

    if (error) return [];
    return (data ?? []) as ProgramRow[];
  } catch {
    return [];
  }
}

type FilterKey = "ALL" | "PUBLISHED" | "HIDDEN";

export default async function PartnerAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const filter: FilterKey =
    params.filter === "PUBLISHED"
      ? "PUBLISHED"
      : params.filter === "HIDDEN"
      ? "HIDDEN"
      : "ALL";

  const partner = await resolvePartnerId();
  const programs = await loadPrograms(partner?.id ?? null);

  const publishedPrograms = programs.filter((p) => p.is_published);
  const activeCount = publishedPrograms.length;
  const totalBookings = programs.reduce(
    (sum, p) => sum + (p.booking_count ?? 0),
    0
  );
  const totalRevenueReal = programs.reduce(
    (sum, p) => sum + (p.booking_count ?? 0) * (p.price_per_person ?? 0),
    0
  );
  const ratedPrograms = programs.filter(
    (p) => (p.rating_count ?? 0) > 0 && p.rating_avg != null
  );
  const avgRating =
    ratedPrograms.length > 0
      ? ratedPrograms.reduce((s, p) => s + (p.rating_avg ?? 0), 0) /
        ratedPrograms.length
      : null;

  // 이번달 매출 (mock — 실제 booking 테이블 연결 전)
  const thisMonthRevenue = Math.round(totalRevenueReal * 0.35);

  // 카테고리 분포
  const categoryStats = (
    Object.keys(CATEGORY_META) as ProgramCategory[]
  ).map((cat) => {
    const items = programs.filter((p) => p.category === cat);
    return {
      category: cat,
      count: items.length,
      bookings: items.reduce((s, p) => s + (p.booking_count ?? 0), 0),
    };
  });
  const maxCategoryCount =
    Math.max(1, ...categoryStats.map((c) => c.count)) || 1;

  // 프로그램별 성과 (매출 내림차순)
  const filteredPrograms = programs
    .filter((p) =>
      filter === "PUBLISHED"
        ? p.is_published
        : filter === "HIDDEN"
        ? !p.is_published
        : true
    )
    .map((p) => ({
      ...p,
      revenue: (p.booking_count ?? 0) * (p.price_per_person ?? 0),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // 이번달 도토리 사용량 (mock)
  const thisMonthAcornUsage = Math.round((partner?.acorn_balance ?? 0) * 0.2);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">분석</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            📊
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              숲지기 분석
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              내 프로그램의 성과를 확인해요
              {partner ? ` · ${partner.name} 숲지기` : ""}
            </p>
          </div>
        </div>
      </header>

      {/* 1. 핵심 지표 4 cards */}
      <section aria-label="핵심 지표" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#6B6560]">
              💰 이번달 매출
            </span>
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
              준비 중
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-[#2D5A3D]">
            {formatWon(thisMonthRevenue)}
          </p>
          <p className="mt-0.5 text-[11px] text-[#B5AFA8]">예상 추정치</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-emerald-700">
            🌿 활성 프로그램
          </span>
          <p className="mt-2 text-2xl font-extrabold text-emerald-900">
            {activeCount}
            <span className="ml-1 text-sm font-semibold">개</span>
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-700/70">
            전체 {programs.length}개 중
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-amber-700">
            ⭐ 평균 평점
          </span>
          <p className="mt-2 text-2xl font-extrabold text-amber-900">
            {avgRating != null ? avgRating.toFixed(2) : "-"}
          </p>
          <p className="mt-0.5 text-[11px] text-amber-700/70">
            {ratedPrograms.length > 0
              ? `${ratedPrograms.length}개 프로그램 평가`
              : "리뷰 없음"}
          </p>
        </div>

        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-sky-700">
            📅 총 예약
          </span>
          <p className="mt-2 text-2xl font-extrabold text-sky-900">
            {totalBookings.toLocaleString("ko-KR")}
            <span className="ml-1 text-sm font-semibold">건</span>
          </p>
          <p className="mt-0.5 text-[11px] text-sky-700/70">누적 합계</p>
        </div>
      </section>

      {/* 2. 프로그램별 성과 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm md:p-6">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>🗺️</span>
            <span>프로그램별 성과</span>
          </h2>
          <nav
            aria-label="필터"
            className="inline-flex rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-1 text-xs"
          >
            {(
              [
                ["ALL", "전체"],
                ["PUBLISHED", "게시"],
                ["HIDDEN", "숨김"],
              ] as [FilterKey, string][]
            ).map(([key, label]) => {
              const active = filter === key;
              const href =
                key === "ALL"
                  ? "/partner/analytics"
                  : `/partner/analytics?filter=${key}`;
              return (
                <Link
                  key={key}
                  href={href}
                  className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                    active
                      ? "bg-[#2D5A3D] text-white shadow-sm"
                      : "text-[#6B6560] hover:bg-white"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        {filteredPrograms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] py-10 text-center">
            <div className="text-3xl" aria-hidden>
              🌱
            </div>
            <p className="mt-2 text-sm font-semibold text-[#2D5A3D]">
              표시할 프로그램이 없어요
            </p>
            <Link
              href="/partner/programs/new"
              className="mt-3 inline-block rounded-lg bg-[#2D5A3D] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#234a30]"
            >
              프로그램 등록하기
            </Link>
          </div>
        ) : (
          <div className="-mx-4 overflow-x-auto md:mx-0">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[#D4E4BC] bg-[#FFF8F0] text-[11px] font-semibold uppercase tracking-wide text-[#6B6560]">
                <tr>
                  <th className="px-3 py-2">프로그램</th>
                  <th className="px-3 py-2">카테고리</th>
                  <th className="px-3 py-2 text-right">1인가격</th>
                  <th className="px-3 py-2 text-right">평점</th>
                  <th className="px-3 py-2 text-right">예약</th>
                  <th className="px-3 py-2 text-right">매출</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE9E1]">
                {filteredPrograms.map((p) => {
                  const meta = CATEGORY_META[p.category] ?? CATEGORY_META.FOREST;
                  return (
                    <tr key={p.id} className="hover:bg-[#FFF8F0]">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              p.is_published ? "bg-emerald-500" : "bg-zinc-300"
                            }`}
                            aria-hidden
                          />
                          <span className="font-semibold text-[#2D5A3D]">
                            {p.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                          <span aria-hidden>{meta.icon}</span>
                          <span>{meta.label}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#6B4423]">
                        {formatWon(p.price_per_person)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-amber-700">
                        {p.rating_count > 0 && p.rating_avg != null
                          ? `${p.rating_avg.toFixed(1)} (${p.rating_count})`
                          : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-sky-800">
                        {(p.booking_count ?? 0).toLocaleString("ko-KR")}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-[#2D5A3D]">
                        {formatWon(p.revenue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. 카테고리 분포 bar chart */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm md:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>📈</span>
          <span>카테고리 분포</span>
        </h2>
        <ul className="space-y-3">
          {categoryStats.map((c) => {
            const meta = CATEGORY_META[c.category];
            const pct = Math.round((c.count / maxCategoryCount) * 100);
            return (
              <li key={c.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-[#2D5A3D]">
                    <span aria-hidden>{meta.icon}</span>
                    <span>{meta.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[#6B6560]">
                    <span>
                      프로그램 <b className="text-[#2D5A3D]">{c.count}</b>
                    </span>
                    <span>
                      예약{" "}
                      <b className="text-sky-700">
                        {c.bookings.toLocaleString("ko-KR")}
                      </b>
                    </span>
                  </div>
                </div>
                <div
                  className="h-2.5 w-full overflow-hidden rounded-full bg-[#F0EBE3]"
                  role="progressbar"
                  aria-valuenow={c.count}
                  aria-valuemin={0}
                  aria-valuemax={maxCategoryCount}
                  aria-label={`${meta.label} ${c.count}개`}
                >
                  <div
                    className={`h-full rounded-full ${meta.color} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 4. 최근 후기 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
              <span>💬</span>
              <span>최근 30일 후기</span>
            </h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              준비 중
            </span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-4 py-10 text-center">
            <div className="text-3xl" aria-hidden>
              🌱
            </div>
            <p className="mt-2 text-sm font-semibold text-[#2D5A3D]">
              첫 후기를 기다리고 있어요
            </p>
            <p className="mt-1 text-xs text-[#6B6560]">
              프로그램 참가자의 생생한 이야기가 이곳에 모여요.
            </p>
          </div>
        </section>

        {/* 5. 도토리 크레딧 현황 */}
        <section className="rounded-2xl border border-[#E5D3B8] bg-gradient-to-br from-[#FFF8F0] to-[#FAE7D0] p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#6B4423]">
            <span>🌰</span>
            <span>도토리 크레딧</span>
          </h2>
          <div className="rounded-xl border border-[#E5D3B8] bg-white p-4">
            <p className="text-[11px] font-semibold text-[#8B6F47]">
              현재 잔액
            </p>
            <p className="mt-1 text-3xl font-extrabold text-[#6B4423]">
              {(partner?.acorn_balance ?? 0).toLocaleString("ko-KR")}
              <span className="ml-1 text-base font-semibold">🌰</span>
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl border border-[#E5D3B8] bg-white/70 p-3">
              <p className="text-[10px] font-semibold text-[#8B6F47]">
                이번달 사용
              </p>
              <p className="mt-1 text-lg font-bold text-[#6B4423]">
                {thisMonthAcornUsage.toLocaleString("ko-KR")}
              </p>
            </div>
            <div className="rounded-xl border border-[#E5D3B8] bg-white/70 p-3">
              <p className="text-[10px] font-semibold text-[#8B6F47]">
                누적 매출
              </p>
              <p className="mt-1 text-lg font-bold text-[#6B4423]">
                {formatWon(partner?.total_sales ?? 0)}
              </p>
            </div>
          </div>
          <Link
            href="/partner/settings"
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#6B4423] bg-white px-4 py-2 text-xs font-bold text-[#6B4423] hover:bg-[#FFF8F0]"
          >
            <span aria-hidden>📮</span>
            <span>충전 요청하기</span>
          </Link>
          <p className="mt-2 text-center text-[10px] text-[#8B6F47]">
            요청 접수 후 관리자 검토를 거쳐 충전됩니다.
          </p>
        </section>
      </div>
    </div>
  );
}
