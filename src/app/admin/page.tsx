import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { countPendingDocumentsAll } from "@/lib/documents/queries";
import { loadPartnerProfileSnapshot } from "@/lib/profile-completeness/queries";
import { calcCompleteness } from "@/lib/profile-completeness/calculator";
import { PARTNER_PROFILE_SCHEMA } from "@/lib/profile-completeness/schemas/partner";
import { AcornIcon } from "@/components/acorn-icon";
import { DashboardPartnersSection } from "./dashboard-partners-section";

/**
 * 주요 수익원 실데이터 (이번달 기준).
 * - 크레딧 판매: acorn_recharges.amount 합
 * - 활성 행사: events.status = 'ACTIVE' 또는 CONFIRMED 개수
 * - 활성 구독: partner_subscriptions.status = 'ACTIVE' 개수
 * - 광고 캠페인: ad_campaigns.status = 'ACTIVE' 개수 (있으면)
 * - 쿠폰 상환: coupon_redemptions 이번달 개수
 * - 가맹점 거래: staff_redemptions 또는 유사
 */
async function loadRevenueBreakdown(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<
  Array<{ icon: string; label: string; value: string; sub?: string }>
> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString();

  const safeCount = async (table: string, filter?: (q: unknown) => unknown) => {
    try {
      const base = (supabase as unknown as {
        from: (t: string) => {
          select: (
            c: string,
            o: { count: "exact"; head: true }
          ) => Record<string, unknown>;
        };
      })
        .from(table)
        .select("id", { count: "exact", head: true });
      const q = filter ? (filter(base) as unknown as Promise<{ count: number | null }>) : (base as unknown as Promise<{ count: number | null }>);
      const resp = await q;
      return resp.count ?? 0;
    } catch {
      return 0;
    }
  };

  const fmtWon = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

  // 크레딧 판매 합계
  let acornRevenue = 0;
  try {
    const { data } = await (supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          gte: (
            k: string,
            v: string
          ) => Promise<{ data: Array<{ amount: number | null }> | null }>;
        };
      };
    })
      .from("acorn_recharges")
      .select("amount")
      .gte("created_at", monthStart);
    acornRevenue = (data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
  } catch {
    acornRevenue = 0;
  }

  const [activeEvents, activeSubs, activeCampaigns, redemptions, b2bInquiries] =
    await Promise.all([
      safeCount("events", (q) =>
        (q as unknown as { in: (k: string, v: string[]) => unknown }).in(
          "status",
          ["ACTIVE", "CONFIRMED"]
        )
      ),
      safeCount("partner_subscriptions", (q) =>
        (q as unknown as { eq: (k: string, v: string) => unknown }).eq(
          "status",
          "ACTIVE"
        )
      ),
      safeCount("ad_campaigns", (q) =>
        (q as unknown as { eq: (k: string, v: string) => unknown }).eq(
          "status",
          "ACTIVE"
        )
      ),
      safeCount("coupon_redemptions", (q) =>
        (q as unknown as { gte: (k: string, v: string) => unknown }).gte(
          "redeemed_at",
          monthStart
        )
      ),
      safeCount("b2b_inquiries", (q) =>
        (q as unknown as { eq: (k: string, v: string) => unknown }).eq(
          "status",
          "OPEN"
        )
      ),
    ]);

  return [
    { icon: "🌰", label: "크레딧 판매", value: fmtWon(acornRevenue), sub: "이번달" },
    { icon: "🎪", label: "활성 행사", value: `${activeEvents}건`, sub: "진행 중" },
    { icon: "📅", label: "활성 구독", value: `${activeSubs}건`, sub: "월 결제" },
    { icon: "📢", label: "광고 캠페인", value: `${activeCampaigns}건`, sub: "집행 중" },
    { icon: "🎟️", label: "쿠폰 상환", value: `${redemptions}건`, sub: "이번달" },
    { icon: "💼", label: "B2B 문의", value: `${b2bInquiries}건`, sub: "응답 대기" },
  ];
}

/**
 * 이번달 매출/MRR/활성 업체 수.
 * - settlements.period_start 이번달 것들 집계 (gross_sales 합)
 * - 활성 업체 = 이번달 settlements 를 생성한 distinct partner_id 수
 * - MRR = partner_subscriptions.monthly_fee 활성 건 합 (테이블 없으면 0)
 */
async function loadMonthlyRevenueStats(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ revenue: number; activeCompanies: number; mrr: number }> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  let revenue = 0;
  let activeCompanies = 0;
  try {
    const { data } = await (supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          gte: (
            k: string,
            v: string
          ) => Promise<{
            data: Array<{ partner_id: string; gross_sales: number | null }> | null;
          }>;
        };
      };
    })
      .from("settlements")
      .select("partner_id, gross_sales")
      .gte("period_start", monthStart);
    const rows = data ?? [];
    revenue = rows.reduce((s, r) => s + (r.gross_sales ?? 0), 0);
    activeCompanies = new Set(rows.map((r) => r.partner_id)).size;
  } catch {
    // settlements 테이블 없거나 조회 실패 시 0
  }

  // MRR — subscriptions 테이블이 있으면 집계 (없으면 0)
  let mrr = 0;
  try {
    const { data } = await (supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => Promise<{
            data: Array<{ monthly_fee: number | null }> | null;
          }>;
        };
      };
    })
      .from("partner_subscriptions")
      .select("monthly_fee")
      .eq("status", "ACTIVE");
    mrr = (data ?? []).reduce((s, r) => s + (r.monthly_fee ?? 0), 0);
  } catch {
    // 테이블 없음
  }

  return { revenue, activeCompanies, mrr };
}

async function loadPartnerOnboardingStats(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ total: number; avg: number; under50: number; complete: number }> {
  try {
    const { data } = await (supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => Promise<{
          data: Array<{ id: string }> | null;
        }>;
      };
    })
      .from("partners")
      .select("id");

    const ids = (data ?? []).map((r) => r.id);
    if (ids.length === 0) {
      return { total: 0, avg: 0, under50: 0, complete: 0 };
    }

    const percents = await Promise.all(
      ids.map(async (id) => {
        try {
          const snap = await loadPartnerProfileSnapshot(id);
          return calcCompleteness(PARTNER_PROFILE_SCHEMA, snap).percent;
        } catch {
          return 0;
        }
      })
    );
    const sum = percents.reduce((a, b) => a + b, 0);
    return {
      total: percents.length,
      avg: Math.round(sum / percents.length),
      under50: percents.filter((v) => v < 50).length,
      complete: percents.filter((v) => v >= 100).length,
    };
  } catch {
    return { total: 0, avg: 0, under50: 0, complete: 0 };
  }
}

export default async function AdminHome() {
  const supabase = await createClient();
  const [
    { data: events },
    pendingDocs,
    onboarding,
    monthlyRevenue,
    revenueBreakdown,
  ] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, status, start_at, location, manager_id")
      .order("start_at", { ascending: false })
      .limit(5),
    countPendingDocumentsAll(),
    loadPartnerOnboardingStats(supabase),
    loadMonthlyRevenueStats(supabase),
    loadRevenueBreakdown(supabase),
  ]);

  const fmtWon = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

  const active = events?.filter((e) => e.status === "ACTIVE").length ?? 0;
  const draft = events?.filter((e) => e.status === "DRAFT").length ?? 0;
  const ended = events?.filter((e) => e.status === "ENDED" || e.status === "CONFIRMED").length ?? 0;

  const statusMap: Record<string, { label: string; dot: string; bg: string }> = {
    DRAFT: { label: "준비중", dot: "bg-neutral-400", bg: "bg-neutral-100 text-neutral-600" },
    ACTIVE: { label: "진행중", dot: "bg-green-500", bg: "bg-green-100 text-green-700" },
    ENDED: { label: "종료", dot: "bg-yellow-500", bg: "bg-yellow-100 text-yellow-700" },
    CONFIRMED: { label: "확정", dot: "bg-blue-500", bg: "bg-blue-100 text-blue-700" },
  };

  return (
    <div className="space-y-6">
      {/* 헤더 — 토리로 포레스트 */}
      <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-[11px] tracking-[0.4em] opacity-70 font-light">TORIRO</p>
          <h1 className="text-2xl font-extrabold mt-1 flex items-center gap-2">토리로 대시보드 <AcornIcon size={24} /></h1>
          <p className="mt-2 text-sm opacity-80">오늘의 숲길을 한눈에 살펴보세요</p>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-green-50 border border-green-200 p-4">
          <div className="text-xs font-medium text-green-600">진행 중</div>
          <div className="text-3xl font-bold text-green-700 mt-1">{active}</div>
        </div>
        <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
          <div className="text-xs font-medium text-neutral-500">준비중</div>
          <div className="text-3xl font-bold text-neutral-700 mt-1">{draft}</div>
        </div>
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
          <div className="text-xs font-medium text-blue-600">종료/확정</div>
          <div className="text-3xl font-bold text-blue-700 mt-1">{ended}</div>
        </div>
      </div>

      {/* 🌱 지사 온보딩 현황 위젯 */}
      {onboarding.total > 0 && (
        <Link
          href="/admin/partners"
          className="block rounded-2xl border border-[#D4E4BC] bg-gradient-to-r from-[#E8F0E4] via-white to-[#FFF8F0] p-4 shadow-sm transition-all hover:border-[#2D5A3D] hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
                <span>🌱</span>
                <span>지사 온보딩 현황</span>
              </h3>
              <p className="mt-0.5 text-[11px] text-[#6B6560]">
                프로필 완성도가 낮은 지사가 있어요. 클릭해 확인하세요.
              </p>
            </div>
            <span className="shrink-0 rounded-lg border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-bold text-[#2D5A3D]">
              지사 관리 →
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-[#D4E4BC] bg-white p-2.5">
              <div className="text-[10px] font-semibold text-[#6B6560]">
                평균 완성도
              </div>
              <div className="mt-0.5 text-xl font-bold text-[#2D5A3D]">
                {onboarding.avg}%
              </div>
            </div>
            <div
              className={`rounded-xl border p-2.5 ${
                onboarding.under50 > 0
                  ? "border-rose-200 bg-rose-50"
                  : "border-[#D4E4BC] bg-white"
              }`}
            >
              <div
                className={`text-[10px] font-semibold ${
                  onboarding.under50 > 0 ? "text-rose-700" : "text-[#6B6560]"
                }`}
              >
                50% 미만
              </div>
              <div
                className={`mt-0.5 text-xl font-bold ${
                  onboarding.under50 > 0 ? "text-rose-800" : "text-[#2D5A3D]"
                }`}
              >
                {onboarding.under50}
                <span className="ml-0.5 text-xs font-semibold">곳</span>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
              <div className="text-[10px] font-semibold text-emerald-700">
                완료(100%)
              </div>
              <div className="mt-0.5 text-xl font-bold text-emerald-800">
                {onboarding.complete}
                <span className="ml-0.5 text-xs font-semibold">곳</span>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* 서류 검토 대기 알림 */}
      {pendingDocs > 0 && (
        <Link
          href="/admin/documents"
          className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-sm transition-all hover:border-amber-400 hover:shadow-md"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-2xl">
              ⏳
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-amber-900">
                  서류 검토 대기 <b className="text-amber-700">{pendingDocs}건</b>
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-amber-800/80">
                지사가 제출한 서류를 확인하고 승인/반려해 주세요
              </p>
            </div>
          </div>
          <span className="flex-shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-50">
            검토 →
          </span>
        </Link>
      )}

      {/* 매출 한눈에 */}
      <section className="rounded-2xl bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] border border-[#E5D3B8] p-5 relative overflow-hidden">
        <div className="absolute top-2 right-3 opacity-20 select-none"><AcornIcon size={30} /></div>
        <div className="absolute bottom-2 right-8 opacity-10 select-none"><AcornIcon size={24} /></div>
        <div className="relative z-10">
          <h2 className="text-sm font-bold text-[#6B4423] flex items-center gap-1.5">
            <span>💰</span>
            <span>이번달 매출</span>
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/70 backdrop-blur-sm p-3 border border-white/50">
              <div className="text-[10px] font-medium text-[#8B6F47]">매출</div>
              <div className="text-lg font-extrabold text-[#6B4423] mt-0.5 tabular-nums">
                {fmtWon(monthlyRevenue.revenue)}
              </div>
            </div>
            <div className="rounded-xl bg-white/70 backdrop-blur-sm p-3 border border-white/50">
              <div className="text-[10px] font-medium text-[#8B6F47]">업체</div>
              <div className="text-lg font-extrabold text-[#6B4423] mt-0.5 tabular-nums">
                {monthlyRevenue.activeCompanies}곳{" "}
                <span className="text-[10px] font-medium">활동</span>
              </div>
            </div>
            <div className="rounded-xl bg-white/70 backdrop-blur-sm p-3 border border-white/50">
              <div className="text-[10px] font-medium text-[#8B6F47]">MRR</div>
              <div className="text-lg font-extrabold text-[#6B4423] mt-0.5 tabular-nums">
                {fmtWon(monthlyRevenue.mrr)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 핵심 메뉴 8칸 */}
      <section>
        <h2 className="text-sm font-bold text-[#2D5A3D] mb-3 px-1">🌲 숲의 메뉴</h2>
        <div className="grid grid-cols-4 gap-2.5">
          <Link href="/admin/events/new"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#2D5A3D] hover:shadow-md transition-all">
            <span className="text-3xl">🌲</span>
            <span className="text-sm font-semibold text-[#2D5A3D] text-center">새 숲 다람이</span>
            <span className="text-[10px] text-[#6B6560]">숲길 열기</span>
          </Link>
          <Link href="/admin/chat"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#2D5A3D] hover:shadow-md transition-all">
            <AcornIcon size={30} />
            <span className="text-sm font-semibold text-[#2D5A3D] text-center">토리톡</span>
            <span className="text-[10px] text-[#6B6560]">이야기 나누기</span>
          </Link>
          <Link href="/admin/stats"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#2D5A3D] hover:shadow-md transition-all">
            <span className="text-3xl">📊</span>
            <span className="text-sm font-semibold text-[#2D5A3D] text-center">전체 통계</span>
            <span className="text-[10px] text-[#6B6560]">숲의 현황</span>
          </Link>
          <Link href="/admin/partners"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#2D5A3D] hover:shadow-md transition-all">
            <span className="text-3xl">🏢</span>
            <span className="text-sm font-semibold text-[#2D5A3D] text-center">숲지기 관리</span>
            <span className="text-[10px] text-[#6B6560]">파트너 업체</span>
          </Link>
          <Link href="/admin/challenges"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#2D5A3D] hover:shadow-md transition-all">
            <span className="text-3xl">🎯</span>
            <span className="text-sm font-semibold text-[#2D5A3D] text-center">챌린지 관리</span>
            <span className="text-[10px] text-[#6B6560]">주간 챌린지</span>
          </Link>
          <Link href="/admin/invoices?category=ACORN_RECHARGE"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#2D5A3D] hover:shadow-md transition-all">
            <span className="text-3xl">🎁</span>
            <span className="text-sm font-semibold text-[#2D5A3D] text-center">도토리 충전</span>
            <span className="text-[10px] text-[#6B6560]">크레딧 충전</span>
          </Link>
          <Link href="/admin/invoices"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#2D5A3D] hover:shadow-md transition-all">
            <span className="text-3xl">📄</span>
            <span className="text-sm font-semibold text-[#2D5A3D] text-center">청구서</span>
            <span className="text-[10px] text-[#6B6560]">결제/정산</span>
          </Link>
          <Link href="/admin/ads"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#2D5A3D] hover:shadow-md transition-all">
            <span className="text-3xl">📣</span>
            <span className="text-sm font-semibold text-[#2D5A3D] text-center">숲속 정령</span>
            <span className="text-[10px] text-[#6B6560]">광고 관리</span>
          </Link>
          <Link href="/admin/notifications"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#2D5A3D] hover:shadow-md transition-all">
            <span className="text-3xl">📨</span>
            <span className="text-sm font-semibold text-[#2D5A3D] text-center">알림 발송</span>
            <span className="text-[10px] text-[#6B6560]">SMS/알림톡</span>
          </Link>
          <Link href="/admin/b2b"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#2D5A3D] hover:shadow-md transition-all">
            <span className="text-3xl">💼</span>
            <span className="text-sm font-semibold text-[#2D5A3D] text-center">기업 문의</span>
            <span className="text-[10px] text-[#6B6560]">B2B 상담</span>
          </Link>
          <Link href="/admin/esg"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#2D5A3D] hover:shadow-md transition-all">
            <span className="text-3xl">🌱</span>
            <span className="text-sm font-semibold text-[#2D5A3D] text-center">ESG 리포트</span>
            <span className="text-[10px] text-[#6B6560]">임팩트 지표</span>
          </Link>
          <Link href="/admin/audit-logs"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#2D5A3D] hover:shadow-md transition-all">
            <span className="text-3xl">📋</span>
            <span className="text-sm font-semibold text-[#2D5A3D] text-center">접근 기록</span>
            <span className="text-[10px] text-[#6B6560]">감사 로그</span>
          </Link>
          <Link href="/admin/settings"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#2D5A3D] hover:shadow-md transition-all">
            <span className="text-3xl">⚙️</span>
            <span className="text-sm font-semibold text-[#2D5A3D] text-center">시스템 설정</span>
            <span className="text-[10px] text-[#6B6560]">운영 설정</span>
          </Link>
        </div>
      </section>

      {/* 최근 행사 */}
      <section className="rounded-2xl border bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">최근 행사</h2>
          <Link href="/admin/events" className="text-sm text-violet-600 hover:underline font-medium">
            전체 보기 →
          </Link>
        </div>
        {events && events.length > 0 ? (
          <div className="space-y-2">
            {events.map((e) => {
              const st = statusMap[e.status] ?? statusMap.DRAFT;
              return (
                <Link key={e.id} href={`/admin/events/${e.id}`}
                  className="flex items-center gap-3 rounded-xl p-3 hover:bg-neutral-50 transition-colors">
                  <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${st.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{e.name}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {e.location && `📍 ${e.location}`}
                      {e.manager_id && ` · 🏢 ${e.manager_id}`}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold flex-shrink-0 ${st.bg}`}>
                    {st.label}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center">
            <span className="text-4xl">🏕️</span>
            <p className="mt-3 text-sm text-neutral-500">
              행사가 없습니다.{" "}
              <Link href="/admin/events/new" className="text-violet-600 hover:underline font-medium">
                첫 행사 만들기 →
              </Link>
            </p>
          </div>
        )}
      </section>

      {/* 수익원 현황 — 실데이터 */}
      <section className="rounded-2xl border border-[#E5D3B8] bg-gradient-to-br from-white to-[#FFF8F0] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#6B4423] flex items-center gap-1.5">
            <span>💎</span>
            <span>수익원 현황</span>
          </h2>
          <span className="text-[10px] text-[#8B6F47] font-medium">이번달 기준</span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {revenueBreakdown.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-xl bg-white/70 border border-[#E5D3B8]/50 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 text-base">{item.icon}</span>
                <span className="truncate text-xs font-medium text-[#6B4423]">
                  {item.label}
                </span>
              </div>
              <div className="shrink-0 text-right">
                <span className="block text-xs font-bold tabular-nums text-[#6B4423]">
                  {item.value}
                </span>
                {item.sub && (
                  <span className="block text-[9px] text-[#8B6F47]">
                    {item.sub}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 등록된 숲지기 (최근 10곳) */}
      <DashboardPartnersSection />
    </div>
  );
}
