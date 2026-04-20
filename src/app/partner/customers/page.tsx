import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type OrgRow = {
  id: string;
  status: string;
  created_at: string;
  contract_end: string | null;
};

type CustomerRow = {
  id: string;
  status: string;
  created_at: string;
  last_visit_at: string | null;
};

type CompanyRow = {
  id: string;
  status: string;
  created_at: string;
  next_renewal: string | null;
};

type CrmStats = {
  totalOrgs: number;
  totalCustomers: number;
  totalCompanies: number;
  newThisMonth: number;
  activeCount: number;
  churnRisk: number;
  orgRows: OrgRow[];
  customerRows: CustomerRow[];
  companyRows: CompanyRow[];
};

async function loadCrmStats(partnerId: string): Promise<CrmStats> {
  const supabase = await createClient();

  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{ data: unknown[] | null }>;
      };
    };
  };

  const [orgsRes, customersRes, companiesRes] = await Promise.all([
    client
      .from("partner_orgs")
      .select("id,status,created_at,contract_end")
      .eq("partner_id", partnerId),
    client
      .from("partner_customers")
      .select("id,status,created_at,last_visit_at")
      .eq("partner_id", partnerId),
    client
      .from("partner_companies")
      .select("id,status,created_at,next_renewal")
      .eq("partner_id", partnerId),
  ]);

  const orgRows = (orgsRes.data ?? []) as OrgRow[];
  const customerRows = (customersRes.data ?? []) as CustomerRow[];
  const companyRows = (companiesRes.data ?? []) as CompanyRow[];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const isNew = (iso: string) => new Date(iso) >= monthStart;

  const newThisMonth =
    orgRows.filter((r) => isNew(r.created_at)).length +
    customerRows.filter((r) => isNew(r.created_at)).length +
    companyRows.filter((r) => isNew(r.created_at)).length;

  const activeCount =
    orgRows.filter((r) => r.status === "ACTIVE").length +
    customerRows.filter((r) => r.status === "ACTIVE").length +
    companyRows.filter((r) => r.status === "ACTIVE" || r.status === "CONTRACTED").length;

  const churnRisk =
    customerRows.filter((r) => {
      if (!r.last_visit_at) return false;
      return new Date(r.last_visit_at) < sixtyDaysAgo && r.status !== "CHURNED";
    }).length +
    customerRows.filter((r) => r.status === "DORMANT").length;

  return {
    totalOrgs: orgRows.length,
    totalCustomers: customerRows.length,
    totalCompanies: companyRows.length,
    newThisMonth,
    activeCount,
    churnRisk,
    orgRows,
    customerRows,
    companyRows,
  };
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [, m] = key.split("-");
  return `${Number(m)}월`;
}

function aggregate6Months(
  orgs: OrgRow[],
  customers: CustomerRow[],
  companies: CompanyRow[]
): { key: string; label: string; count: number }[] {
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(monthKey(d), 0);
  }
  const add = (iso: string) => {
    const d = new Date(iso);
    const key = monthKey(d);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  };
  orgs.forEach((r) => add(r.created_at));
  customers.forEach((r) => add(r.created_at));
  companies.forEach((r) => add(r.created_at));

  return Array.from(buckets.entries()).map(([key, count]) => ({
    key,
    label: monthLabel(key),
    count,
  }));
}

export default async function PartnerCustomersHubPage() {
  const partner = await requirePartner();
  const stats = await loadCrmStats(partner.id);

  const total = stats.totalOrgs + stats.totalCustomers + stats.totalCompanies;
  const orgPct = total > 0 ? Math.round((stats.totalOrgs / total) * 100) : 0;
  const customerPct = total > 0 ? Math.round((stats.totalCustomers / total) * 100) : 0;
  const companyPct = total > 0 ? Math.round((stats.totalCompanies / total) * 100) : 0;

  const monthly = aggregate6Months(stats.orgRows, stats.customerRows, stats.companyRows);
  const maxMonthly = Math.max(1, ...monthly.map((m) => m.count));

  // 재계약 임박 (30일 이내)
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const renewalCount = stats.companyRows.filter((r) => {
    if (!r.next_renewal) return false;
    const d = new Date(r.next_renewal);
    return d >= now && d <= thirtyDaysLater;
  }).length;

  const STAT_CARDS = [
    {
      icon: "👥",
      label: "전체 고객",
      value: total,
      unit: "명",
      sub: `기관 ${stats.totalOrgs} · 개인 ${stats.totalCustomers} · 기업 ${stats.totalCompanies}`,
      accent: "from-emerald-50 to-white border-emerald-200",
      valueColor: "text-emerald-800",
    },
    {
      icon: "🌱",
      label: "이번달 신규",
      value: stats.newThisMonth,
      unit: "명",
      sub: `${now.getFullYear()}. ${now.getMonth() + 1}월`,
      accent: "from-violet-50 to-white border-violet-200",
      valueColor: "text-violet-800",
    },
    {
      icon: "✅",
      label: "활성 고객",
      value: stats.activeCount,
      unit: "명",
      sub: total > 0 ? `전체의 ${Math.round((stats.activeCount / total) * 100)}%` : "—",
      accent: "from-sky-50 to-white border-sky-200",
      valueColor: "text-sky-800",
    },
    {
      icon: "⚠️",
      label: "이탈 위험",
      value: stats.churnRisk,
      unit: "명",
      sub: "휴면 60일+ 포함",
      accent: "from-rose-50 to-white border-rose-200",
      valueColor: "text-rose-800",
    },
  ];

  const DISTRIBUTION = [
    {
      icon: "🏫",
      label: "기관",
      count: stats.totalOrgs,
      pct: orgPct,
      color: "bg-emerald-500",
      textColor: "text-emerald-700",
    },
    {
      icon: "👨‍👩‍👧",
      label: "개인",
      count: stats.totalCustomers,
      pct: customerPct,
      color: "bg-violet-500",
      textColor: "text-violet-700",
    },
    {
      icon: "🏢",
      label: "기업",
      count: stats.totalCompanies,
      pct: companyPct,
      color: "bg-amber-500",
      textColor: "text-amber-700",
    },
  ];

  const RECOMMENDED: { icon: string; text: string; cta: string; href: string; color: string }[] = [];
  if (stats.churnRisk > 0) {
    RECOMMENDED.push({
      icon: "🎟️",
      text: `이탈위험 고객 ${stats.churnRisk}명`,
      cta: "할인쿠폰 발송",
      href: "/partner/marketing/coupons",
      color: "from-rose-100 to-rose-50 border-rose-300",
    });
  }
  if (renewalCount > 0) {
    RECOMMENDED.push({
      icon: "📝",
      text: `기업 재계약 임박 ${renewalCount}건`,
      cta: "제안서 보내기",
      href: "/partner/customers/corporate",
      color: "from-amber-100 to-amber-50 border-amber-300",
    });
  }
  if (stats.newThisMonth > 0) {
    RECOMMENDED.push({
      icon: "💌",
      text: `신규 ${stats.newThisMonth}건`,
      cta: "웰컴 메시지",
      href: "/partner/customers/segments",
      color: "from-violet-100 to-violet-50 border-violet-300",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#D4E4BC]">
          CRM · Customer Hub
        </p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold md:text-3xl">
          <span>👥</span>
          <span>고객 관리</span>
        </h1>
        <p className="mt-1 text-sm text-[#E8F0E4]">
          기관·개인·기업 고객을 한눈에 보고 관리하세요.
        </p>
      </section>

      {/* 4 stat cards */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STAT_CARDS.map((s) => (
          <div
            key={s.label}
            className={`rounded-2xl border bg-gradient-to-br ${s.accent} p-4 shadow-sm`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[#6B6560]">
              <span className="text-lg">{s.icon}</span>
              <span>{s.label}</span>
            </div>
            <div className={`mt-2 text-2xl font-extrabold md:text-3xl ${s.valueColor}`}>
              {s.value.toLocaleString("ko-KR")}
              <span className="ml-0.5 text-sm font-semibold">{s.unit}</span>
            </div>
            <div className="mt-0.5 text-[11px] text-[#6B6560]">{s.sub}</div>
          </div>
        ))}
      </section>

      {/* 유형별 분포 + 6개월 추이 */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>📊</span>
            <span>유형별 분포</span>
          </h2>
          <div className="space-y-3">
            {DISTRIBUTION.map((d) => (
              <div key={d.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className={`flex items-center gap-1.5 font-semibold ${d.textColor}`}>
                    <span>{d.icon}</span>
                    <span>{d.label}</span>
                  </span>
                  <span className="text-[#6B6560]">
                    <span className="font-bold text-[#2C2C2C]">{d.count}</span>
                    <span className="ml-1 text-xs">({d.pct}%)</span>
                  </span>
                </div>
                <div
                  className="h-3 w-full overflow-hidden rounded-full bg-[#F5F1E8]"
                  role="progressbar"
                  aria-valuenow={d.pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${d.label} ${d.pct}%`}
                >
                  <div
                    className={`h-full ${d.color} transition-all`}
                    style={{ width: `${d.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>📈</span>
            <span>증가 추이 (최근 6개월)</span>
          </h2>
          <div className="flex h-36 items-end justify-between gap-1.5">
            {monthly.map((m) => {
              const heightPct = (m.count / maxMonthly) * 100;
              return (
                <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-[#2D5A3D]">
                    {m.count}
                  </span>
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-[#3A7A52] to-[#4A7C59] transition-all"
                    style={{ height: `${Math.max(6, heightPct)}%` }}
                    aria-label={`${m.label} ${m.count}명`}
                  />
                  <span className="text-[10px] text-[#6B6560]">{m.label}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* 추천 액션 */}
      {RECOMMENDED.length > 0 && (
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>💡</span>
            <span>추천 액션</span>
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {RECOMMENDED.map((r, i) => (
              <Link
                key={i}
                href={r.href}
                className={`flex flex-col justify-between rounded-2xl border bg-gradient-to-br ${r.color} p-4 transition hover:shadow-md`}
              >
                <div>
                  <div className="text-2xl">{r.icon}</div>
                  <div className="mt-2 text-sm font-semibold text-[#2C2C2C]">
                    {r.text}
                  </div>
                </div>
                <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#2D5A3D]">
                  <span>→</span>
                  <span>{r.cta}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quick links */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>🚀</span>
          <span>빠른 이동</span>
        </h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Link
            href="/partner/customers/org"
            className="flex flex-col items-center rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center transition hover:border-emerald-400 hover:bg-emerald-100"
          >
            <span className="text-2xl">🏫</span>
            <span className="mt-1 text-xs font-semibold text-emerald-800">기관 관리</span>
          </Link>
          <Link
            href="/partner/customers/individual"
            className="flex flex-col items-center rounded-xl border border-violet-200 bg-violet-50 p-3 text-center transition hover:border-violet-400 hover:bg-violet-100"
          >
            <span className="text-2xl">👨‍👩‍👧</span>
            <span className="mt-1 text-xs font-semibold text-violet-800">개인 관리</span>
          </Link>
          <Link
            href="/partner/customers/corporate"
            className="flex flex-col items-center rounded-xl border border-amber-200 bg-amber-50 p-3 text-center transition hover:border-amber-400 hover:bg-amber-100"
          >
            <span className="text-2xl">🏢</span>
            <span className="mt-1 text-xs font-semibold text-amber-800">기업 관리</span>
          </Link>
          <Link
            href="/partner/customers/bulk-import"
            className="flex flex-col items-center rounded-xl border border-sky-200 bg-sky-50 p-3 text-center transition hover:border-sky-400 hover:bg-sky-100"
          >
            <span className="text-2xl">📥</span>
            <span className="mt-1 text-xs font-semibold text-sky-800">엑셀 일괄등록</span>
          </Link>
          <Link
            href="/partner/customers/segments"
            className="flex flex-col items-center rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-3 text-center transition hover:border-fuchsia-400 hover:bg-fuchsia-100"
          >
            <span className="text-2xl">🎯</span>
            <span className="mt-1 text-xs font-semibold text-fuchsia-800">세그먼트</span>
          </Link>
          <Link
            href="/partner/customers/activity"
            className="flex flex-col items-center rounded-xl border border-teal-200 bg-teal-50 p-3 text-center transition hover:border-teal-400 hover:bg-teal-100"
          >
            <span className="text-2xl">📊</span>
            <span className="mt-1 text-xs font-semibold text-teal-800">활동 타임라인</span>
          </Link>
          <Link
            href="/partner/marketing/coupons"
            className="flex flex-col items-center rounded-xl border border-rose-200 bg-rose-50 p-3 text-center transition hover:border-rose-400 hover:bg-rose-100"
          >
            <span className="text-2xl">🎁</span>
            <span className="mt-1 text-xs font-semibold text-rose-800">쿠폰 발행</span>
          </Link>
          <Link
            href="/partner/analytics"
            className="flex flex-col items-center rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-center transition hover:border-indigo-400 hover:bg-indigo-100"
          >
            <span className="text-2xl">📈</span>
            <span className="mt-1 text-xs font-semibold text-indigo-800">상세 분석</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
