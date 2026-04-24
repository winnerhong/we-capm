import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RangeKey = "week" | "month" | "quarter" | "year";

const RANGE_META: Record<RangeKey, { label: string; days: number }> = {
  week: { label: "이번 주", days: 7 },
  month: { label: "이번 달", days: 30 },
  quarter: { label: "분기", days: 90 },
  year: { label: "올해", days: 365 },
};

type CampaignRow = {
  id: string;
  partner_id: string | null;
  name: string | null;
  goal: string | null;
  status: string | null;
  sent_count: number | null;
  opened_count: number | null;
  clicked_count: number | null;
  converted_count: number | null;
  created_at: string | null;
};

type CouponRow = {
  id: string;
  title: string | null;
  discount_type: string | null;
  discount_value: number | null;
  max_uses: number | null;
  used_count: number | null;
  status: string | null;
  created_at: string | null;
};

type CustomerRow = {
  id: string;
  source: string | null;
  total_spent: number | null;
  created_at: string | null;
};

const GOAL_LABEL: Record<string, string> = {
  AWARENESS: "🌱 인지",
  LEAD: "🎯 리드",
  CONVERSION: "💸 전환",
  RETENTION: "🔁 재방문",
  REVIEW: "⭐ 리뷰",
};

function resolveRange(raw: string | undefined): RangeKey {
  const allowed: RangeKey[] = ["week", "month", "quarter", "year"];
  const v = (raw ?? "month") as RangeKey;
  return allowed.includes(v) ? v : "month";
}

function rangeStartIso(range: RangeKey): string {
  const days = RANGE_META[range].days;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function formatWon(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "-";
  }
}

async function loadCampaigns(
  partnerId: string,
  sinceIso: string
): Promise<CampaignRow[]> {
  const supabase = await createClient();
  try {
    const { data } = await (supabase.from("partner_campaigns" as never) as any)
      .select(
        "id,partner_id,name,goal,status,sent_count,opened_count,clicked_count,converted_count,created_at"
      )
      .eq("partner_id", partnerId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []) as CampaignRow[];
  } catch {
    return [];
  }
}

async function loadCoupons(partnerId: string): Promise<CouponRow[]> {
  const supabase = await createClient();
  try {
    const { data } = await (supabase.from("coupons" as never) as any)
      .select(
        "id,title,discount_type,discount_value,max_uses,used_count,status,created_at,partner_id"
      )
      .eq("partner_id", partnerId)
      .order("used_count", { ascending: false })
      .limit(20);
    return (data ?? []) as CouponRow[];
  } catch {
    // partner_id 없이 전체에서 가져와 fallback
    try {
      const { data } = await (supabase.from("coupons" as never) as any)
        .select(
          "id,title,discount_type,discount_value,max_uses,used_count,status,created_at"
        )
        .order("used_count", { ascending: false })
        .limit(20);
      return (data ?? []) as CouponRow[];
    } catch {
      return [];
    }
  }
}

async function loadCustomers(
  partnerId: string,
  sinceIso: string
): Promise<CustomerRow[]> {
  const supabase = await createClient();
  try {
    const { data } = await (supabase.from("partner_customers" as never) as any)
      .select("id,source,total_spent,created_at")
      .eq("partner_id", partnerId)
      .gte("created_at", sinceIso);
    return (data ?? []) as CustomerRow[];
  } catch {
    return [];
  }
}

function sourceLabel(raw: string | null): string {
  if (!raw) return "직접 유입";
  const map: Record<string, string> = {
    naver: "🟢 네이버",
    google: "🔵 구글",
    instagram: "📷 인스타",
    blog: "✍️ 블로그",
    kakao: "💛 카카오",
    referral: "🎁 추천",
    bulk_import: "📤 엑셀",
    direct: "🌿 직접 유입",
    campaign: "📢 캠페인",
  };
  return map[raw.toLowerCase()] ?? `🌳 ${raw}`;
}

function buildWeeklyTrend(
  campaigns: CampaignRow[]
): { weekLabel: string; sent: number; converted: number }[] {
  const now = new Date();
  const weeks: { weekLabel: string; sent: number; converted: number }[] = [];
  for (let i = 7; i >= 0; i -= 1) {
    const start = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
    const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const inWeek = campaigns.filter((c) => {
      if (!c.created_at) return false;
      const t = new Date(c.created_at).getTime();
      return t >= start.getTime() && t < end.getTime();
    });
    weeks.push({
      weekLabel: `${start.getMonth() + 1}/${start.getDate()}`,
      sent: inWeek.reduce((s, c) => s + (c.sent_count ?? 0), 0),
      converted: inWeek.reduce((s, c) => s + (c.converted_count ?? 0), 0),
    });
  }
  return weeks;
}

export default async function MarketingAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = resolveRange(params.range);
  const partner = await requirePartner();
  const sinceIso = rangeStartIso(range);

  const [campaigns, coupons, customers] = await Promise.all([
    loadCampaigns(partner.id, sinceIso),
    loadCoupons(partner.id),
    loadCustomers(partner.id, sinceIso),
  ]);

  // === 핵심 지표 ===
  const totalSent = campaigns.reduce((s, c) => s + (c.sent_count ?? 0), 0);
  const totalOpened = campaigns.reduce((s, c) => s + (c.opened_count ?? 0), 0);
  const totalClicked = campaigns.reduce(
    (s, c) => s + (c.clicked_count ?? 0),
    0
  );
  const totalConverted = campaigns.reduce(
    (s, c) => s + (c.converted_count ?? 0),
    0
  );
  const openRate = pct(totalOpened, totalSent);
  const clickRate = pct(totalClicked, totalSent);
  const convRate = pct(totalConverted, totalSent);

  // CAC / ROI (placeholder 계산 — 실 데이터 연결 전)
  const estimatedCost = Math.max(10000, totalSent * 20); // 건당 20원 가정
  const newCustomerCount = customers.length;
  const cac = newCustomerCount > 0 ? estimatedCost / newCustomerCount : 0;
  const revenueFromCustomers = customers.reduce(
    (s, c) => s + (c.total_spent ?? 0),
    0
  );
  const roi =
    estimatedCost > 0
      ? ((revenueFromCustomers - estimatedCost) / estimatedCost) * 100
      : 0;

  // === 캠페인 TOP 5 ===
  const topCampaigns = [...campaigns]
    .sort((a, b) => (b.converted_count ?? 0) - (a.converted_count ?? 0))
    .slice(0, 5);

  // === 쿠폰 TOP 5 ===
  const topCoupons = [...coupons]
    .sort((a, b) => (b.used_count ?? 0) - (a.used_count ?? 0))
    .slice(0, 5);

  // === 유입 경로 ===
  const sourceBuckets = new Map<string, number>();
  for (const c of customers) {
    const key = (c.source ?? "direct").toLowerCase();
    sourceBuckets.set(key, (sourceBuckets.get(key) ?? 0) + 1);
  }
  const sourceRows = Array.from(sourceBuckets.entries())
    .map(([k, v]) => ({ source: k, count: v }))
    .sort((a, b) => b.count - a.count);
  const sourceTotal = sourceRows.reduce((s, r) => s + r.count, 0);

  // === 주간 추이 ===
  const weekly = buildWeeklyTrend(campaigns);
  const weeklyMax = Math.max(1, ...weekly.map((w) => Math.max(w.sent, w.converted)));

  const hasAnyData =
    campaigns.length > 0 || coupons.length > 0 || customers.length > 0;

  // === 카드 데이터 ===
  const kpis = [
    {
      icon: "🎯",
      label: "노출 수",
      value: totalSent.toLocaleString("ko-KR"),
      suffix: "건",
      tone: "neutral" as const,
    },
    {
      icon: "👀",
      label: "오픈율",
      value: openRate.toFixed(1),
      suffix: "%",
      tone: openRate >= 30 ? ("up" as const) : ("neutral" as const),
    },
    {
      icon: "🖱️",
      label: "클릭률",
      value: clickRate.toFixed(1),
      suffix: "%",
      tone: clickRate >= 5 ? ("up" as const) : ("neutral" as const),
    },
    {
      icon: "🔁",
      label: "전환율",
      value: convRate.toFixed(1),
      suffix: "%",
      tone: convRate >= 3 ? ("up" as const) : ("down" as const),
    },
    {
      icon: "💸",
      label: "CAC 추정",
      value:
        newCustomerCount > 0 ? Math.round(cac).toLocaleString("ko-KR") : "-",
      suffix: newCustomerCount > 0 ? "원" : "",
      tone: "neutral" as const,
    },
    {
      icon: "💰",
      label: "ROI 추정",
      value:
        estimatedCost > 0 ? `${roi > 0 ? "+" : ""}${roi.toFixed(0)}` : "-",
      suffix: estimatedCost > 0 ? "%" : "",
      tone: roi >= 0 ? ("up" as const) : ("down" as const),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/marketing" className="hover:text-[#2D5A3D]">
          마케팅
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">성과 분석</span>
      </nav>

      {/* 헤더 + 기간 필터 */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#2D5A3D] md:text-3xl">
            <span>📊</span>
            <span>마케팅 성과</span>
          </h1>
          <p className="mt-1 text-sm text-[#6B6560]">
            캠페인 · 쿠폰 · 유입 경로 성과를 한눈에
          </p>
        </div>
        <nav
          aria-label="기간 필터"
          className="inline-flex rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-1 text-xs"
        >
          {(Object.keys(RANGE_META) as RangeKey[]).map((key) => {
            const active = range === key;
            return (
              <Link
                key={key}
                href={`/partner/marketing/analytics?range=${key}`}
                className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                  active
                    ? "bg-[#2D5A3D] text-white shadow-sm"
                    : "text-[#6B6560] hover:bg-white"
                }`}
              >
                {RANGE_META[key].label}
              </Link>
            );
          })}
        </nav>
      </header>

      {!hasAnyData ? (
        <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-4 py-16 text-center">
          <div className="text-4xl">📊</div>
          <p className="mt-3 text-base font-semibold text-[#2D5A3D]">
            데이터가 충분히 쌓이면 여기서 볼 수 있어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            첫 캠페인부터 시작해보세요 🌱
          </p>
          <Link
            href="/partner/marketing/campaigns/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3A7A52]"
          >
            <span>➕</span>
            <span>첫 캠페인 만들기</span>
          </Link>
        </section>
      ) : null}

      {/* 1. 핵심 지표 6개 */}
      <section aria-label="핵심 지표" className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#6B6560]">
                <span className="text-lg">{k.icon}</span>
                <span>{k.label}</span>
              </div>
              {k.tone === "up" ? (
                <span className="rounded-full bg-[#E8F0E4] px-1.5 py-0.5 text-[10px] font-bold text-[#2D5A3D]">
                  ▲ 증가
                </span>
              ) : k.tone === "down" ? (
                <span className="rounded-full bg-[#FCE4E0] px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                  ▼ 주의
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-[#2D5A3D]">
                {k.value}
              </span>
              {k.suffix ? (
                <span className="text-sm font-semibold text-[#6B6560]">
                  {k.suffix}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </section>

      {/* 2. 캠페인 TOP 5 */}
      <section className="overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#D4E4BC] bg-[#FFF8F0] px-5 py-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>📢</span>
            <span>캠페인 성과 TOP 5</span>
          </h2>
          <Link
            href="/partner/marketing/campaigns"
            className="text-xs font-semibold text-[#3A7A52] hover:text-[#2D5A3D] hover:underline"
          >
            전체 보기 →
          </Link>
        </div>
        {topCampaigns.length === 0 ? (
          <div className="px-5 py-10 text-center text-xs text-[#6B6560]">
            이 기간에 발송한 캠페인이 없어요
          </div>
        ) : (
          <div className="-mx-0 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[#FFF8F0] text-[11px] font-semibold uppercase tracking-wide text-[#6B6560]">
                <tr>
                  <th className="px-4 py-2.5">캠페인</th>
                  <th className="px-4 py-2.5">목표</th>
                  <th className="px-4 py-2.5 text-right">발송</th>
                  <th className="px-4 py-2.5 text-right">오픈</th>
                  <th className="px-4 py-2.5 text-right">클릭</th>
                  <th className="px-4 py-2.5 text-right">전환</th>
                  <th className="px-4 py-2.5 text-right">전환율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EBE3]">
                {topCampaigns.map((c) => {
                  const sent = c.sent_count ?? 0;
                  const conv = c.converted_count ?? 0;
                  const rate = pct(conv, sent);
                  return (
                    <tr key={c.id} className="hover:bg-[#FFF8F0]">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/partner/marketing/campaigns/${c.id}`}
                          className="font-semibold text-[#2D5A3D] hover:underline"
                        >
                          {c.name ?? "제목 없음"}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-[11px] text-[#6B6560]">
                        {c.goal ? GOAL_LABEL[c.goal] ?? c.goal : "-"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[#2D5A3D]">
                        {sent.toLocaleString("ko-KR")}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sky-800">
                        {(c.opened_count ?? 0).toLocaleString("ko-KR")}
                      </td>
                      <td className="px-4 py-2.5 text-right text-amber-700">
                        {(c.clicked_count ?? 0).toLocaleString("ko-KR")}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-[#2D5A3D]">
                        {conv.toLocaleString("ko-KR")}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            rate >= 3
                              ? "bg-[#E8F0E4] text-[#2D5A3D]"
                              : "bg-[#F5F1E8] text-[#6B6560]"
                          }`}
                        >
                          {rate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. 쿠폰 TOP 5 */}
      <section className="overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#D4E4BC] bg-[#FFF8F0] px-5 py-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>🎁</span>
            <span>쿠폰 사용 TOP 5</span>
          </h2>
          <Link
            href="/partner/marketing/coupons"
            className="text-xs font-semibold text-[#3A7A52] hover:text-[#2D5A3D] hover:underline"
          >
            전체 보기 →
          </Link>
        </div>
        {topCoupons.length === 0 ? (
          <div className="px-5 py-10 text-center text-xs text-[#6B6560]">
            발행된 쿠폰이 없어요
          </div>
        ) : (
          <ul className="divide-y divide-[#F0EBE3]">
            {topCoupons.map((c) => {
              const issued = c.max_uses ?? 0;
              const used = c.used_count ?? 0;
              const rate = issued > 0 ? pct(used, issued) : 0;
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#2D5A3D]">
                        {c.title ?? "제목 없는 쿠폰"}
                      </span>
                      {c.discount_type ? (
                        <span className="rounded-full border border-[#E5D3B8] bg-[#FFF8F0] px-2 py-0.5 text-[10px] font-semibold text-[#6B4423]">
                          {c.discount_type === "PERCENT"
                            ? `${c.discount_value ?? 0}% 할인`
                            : c.discount_type === "AMOUNT"
                            ? `${formatWon(c.discount_value ?? 0)} 할인`
                            : "무료"}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[#F0EBE3]">
                      <div
                        className="h-full rounded-full bg-[#2D5A3D] transition-all"
                        style={{ width: `${Math.min(100, rate)}%` }}
                        role="progressbar"
                        aria-valuenow={used}
                        aria-valuemin={0}
                        aria-valuemax={issued}
                        aria-label={`${used}/${issued || "무제한"} 사용`}
                      />
                    </div>
                  </div>
                  <div className="text-right text-xs text-[#6B6560]">
                    <div className="font-bold text-[#2D5A3D]">
                      {used.toLocaleString("ko-KR")}
                      <span className="text-[#6B6560]">
                        {" / "}
                        {issued > 0 ? issued.toLocaleString("ko-KR") : "무제한"}
                      </span>
                    </div>
                    <div>
                      사용률 <b className="text-[#2D5A3D]">{rate.toFixed(1)}%</b>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 4. 유입 경로 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>👥</span>
          <span>고객 유입 경로</span>
          <span className="text-[11px] font-normal text-[#6B6560]">
            · {RANGE_META[range].label} 신규 {sourceTotal.toLocaleString("ko-KR")}명
          </span>
        </h2>
        {sourceRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] py-10 text-center text-xs text-[#6B6560]">
            이 기간에 신규 고객 유입이 없어요
          </div>
        ) : (
          <ul className="space-y-3">
            {sourceRows.map((r) => {
              const percent = pct(r.count, sourceTotal);
              return (
                <li key={r.source} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#2D5A3D]">
                      {sourceLabel(r.source)}
                    </span>
                    <span className="text-[#6B6560]">
                      <b className="text-[#2D5A3D]">
                        {r.count.toLocaleString("ko-KR")}
                      </b>
                      명 · {percent.toFixed(1)}%
                    </span>
                  </div>
                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full bg-[#F0EBE3]"
                    role="progressbar"
                    aria-valuenow={r.count}
                    aria-valuemin={0}
                    aria-valuemax={sourceTotal}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#4A7C59] to-[#2D5A3D] transition-all"
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 5. 주간 추이 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>📈</span>
          <span>최근 8주 발송 · 전환 추이</span>
        </h2>
        <div className="flex items-end justify-between gap-2 rounded-xl bg-[#FFF8F0] p-4">
          {weekly.map((w, idx) => {
            const sentH = Math.max(4, Math.round((w.sent / weeklyMax) * 140));
            const convH = Math.max(
              w.converted > 0 ? 4 : 0,
              Math.round((w.converted / weeklyMax) * 140)
            );
            return (
              <div
                key={idx}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <div className="flex h-[150px] items-end gap-0.5">
                  <div
                    className="w-3 rounded-t bg-[#D4E4BC] md:w-4"
                    style={{ height: `${sentH}px` }}
                    title={`발송 ${w.sent.toLocaleString("ko-KR")}`}
                  />
                  <div
                    className="w-3 rounded-t bg-[#2D5A3D] md:w-4"
                    style={{ height: `${convH}px` }}
                    title={`전환 ${w.converted.toLocaleString("ko-KR")}`}
                  />
                </div>
                <span className="text-[10px] font-semibold text-[#6B6560]">
                  {w.weekLabel}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-end gap-4 text-[11px] text-[#6B6560]">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-[#D4E4BC]" />
            발송
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-[#2D5A3D]" />
            전환
          </span>
        </div>
      </section>

      {/* 참고 */}
      <p className="text-center text-[11px] text-[#B5AFA8]">
        ※ CAC / ROI 수치는 발송 비용 가정(건당 20원)에 기반한 추정치입니다. 실
        비용 데이터 연결 전 참고용.{" "}
        {fmtDate(sinceIso)} ~ 현재 기간
      </p>
    </div>
  );
}
