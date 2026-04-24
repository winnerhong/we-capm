import Link from "next/link";
import type { ReactNode } from "react";
import { requirePartner } from "@/lib/auth-guard";
import { AcornIcon } from "@/components/acorn-icon";
import { createClient } from "@/lib/supabase/server";
import { loadTeamMemberStats } from "@/lib/team/event-team-queries";
import {
  loadDocumentStats,
  loadExpiringDocuments,
  loadLatestPartnerDocuments,
} from "@/lib/documents/queries";
import { DOC_TYPE_META, DOC_TYPE_KEYS } from "@/lib/documents/types";
import { loadPartnerProfileSnapshot } from "@/lib/profile-completeness/queries";
import { calcCompleteness } from "@/lib/profile-completeness/calculator";
import { PARTNER_PROFILE_SCHEMA } from "@/lib/profile-completeness/schemas/partner";
import { CompletenessNudgeBanner } from "@/components/profile-completeness/NudgeBanner";
import {
  CustomerGroupCard,
  type CustomerItem,
} from "@/app/admin/partners/[id]/customer-group-card";

export const dynamic = "force-dynamic";

type MenuItem = {
  icon: ReactNode;
  label: string;
  href: string;
  desc: string;
};

type ProgramRow = {
  id: string;
  is_published: boolean;
  rating_avg: number | null;
  rating_count: number;
  booking_count: number;
  price_per_person: number;
};

const MENUS: MenuItem[] = [
  { icon: "🗺️", label: "프로그램 관리", href: "/partner/programs", desc: "체험 상품 등록" },
  { icon: "🎨", label: "나만의 숲길", href: "/partner/missions", desc: "QR · 미션" },
  { icon: "👥", label: "고객 관리", href: "/partner/customers", desc: "CRM 허브" },
  { icon: "🎯", label: "세그먼트", href: "/partner/customers/segments", desc: "고객 그룹" },
  { icon: "📡", label: "실시간 활동", href: "/partner/customers/activity", desc: "타임라인" },
  { icon: "📊", label: "분석", href: "/partner/analytics", desc: "성과 리포트" },
  { icon: "💳", label: "결제 관리", href: "/partner/billing", desc: "정산 · 수익" },
  { icon: <AcornIcon size={28} />, label: "도토리 충전", href: "/partner/billing/acorns", desc: "크레딧 충전" },
  { icon: "🛠️", label: "마케팅 센터", href: "/partner/dashboard", desc: "홍보 · 쿠폰" },
  { icon: "⚙️", label: "설정", href: "/partner/settings", desc: "계정 · 프로필" },
  { icon: "🪪", label: "내 정보", href: "/partner/my", desc: "열람 · 해지" },
];

async function loadTasksStatus(
  partnerId: string,
  profilePercent: number,
  programCount: number
): Promise<Array<{ done: boolean; text: string; href: string }>> {
  const supabase = await createClient();

  // 미션 카운트
  let missionCount = 0;
  try {
    const { count } = await (
      supabase.from("partner_missions" as never) as unknown as {
        select: (
          c: string,
          o: { count: "exact"; head: true }
        ) => {
          eq: (k: string, v: string) => Promise<{ count: number | null }>;
        };
      }
    )
      .select("id", { count: "exact", head: true })
      .eq("partner_id", partnerId);
    missionCount = count ?? 0;
  } catch {
    missionCount = 0;
  }

  // 정산계좌 등록 여부
  let hasBank = false;
  try {
    const { data } = await (
      supabase.from("partners") as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: {
                bank_name: string | null;
                account_number: string | null;
              } | null;
            }>;
          };
        };
      }
    )
      .select("bank_name, account_number")
      .eq("id", partnerId)
      .maybeSingle();
    hasBank = Boolean(
      data?.bank_name?.trim() && data?.account_number?.trim()
    );
  } catch {
    hasBank = false;
  }

  return [
    {
      done: profilePercent >= 80,
      text: "숲지기 프로필 작성하기",
      href: "/partner/my#missing",
    },
    {
      done: programCount > 0,
      text: "첫 번째 프로그램 등록하기",
      href: "/partner/programs",
    },
    {
      done: missionCount > 0,
      text: "숲길 QR 미션 만들기",
      href: "/partner/missions",
    },
    {
      done: hasBank,
      text: "정산 계좌 등록하기",
      href: "/partner/my#bank",
    },
  ];
}

function formatWon(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

async function safeLoadTeamStats(
  partnerId: string
): Promise<{ active: number; pending: number; total: number } | null> {
  try {
    const r = await loadTeamMemberStats(partnerId);
    if (!r) return null;
    return {
      active: Number(r.active ?? 0),
      pending: Number(r.pending ?? 0),
      total: Number(r.total ?? 0),
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* 고객 현황 로더 (기관 · 개인 · 기업)                                    */
/* ------------------------------------------------------------------ */

const CUSTOMER_LIST_LIMIT = 100;

type OrgRow = {
  id: string;
  org_name: string;
  status: string | null;
  auto_username: string | null;
  created_at: string;
};

type CustomerRowIndividual = {
  id: string;
  parent_name: string;
  parent_phone: string | null;
  status: string | null;
  created_at: string;
};

type CompanyRow = {
  id: string;
  company_name: string;
  status: string | null;
  business_number: string | null;
  created_at: string;
};

async function loadPartnerCustomersAll(partnerId: string) {
  const supabase = await createClient();

  const [orgsResp, orgsCountResp, indResp, indCountResp, compResp, compCountResp] =
    await Promise.all([
      (
        supabase.from("partner_orgs" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => {
                limit: (n: number) => Promise<{ data: OrgRow[] | null }>;
              };
            };
          };
        }
      )
        .select("id,org_name,status,auto_username,created_at")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false })
        .limit(CUSTOMER_LIST_LIMIT),
      (
        supabase.from("partner_orgs" as never) as unknown as {
          select: (
            c: string,
            o: { count: "exact"; head: true }
          ) => {
            eq: (k: string, v: string) => Promise<{ count: number | null }>;
          };
        }
      )
        .select("id", { count: "exact", head: true })
        .eq("partner_id", partnerId),
      (
        supabase.from("partner_customers" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => {
                limit: (
                  n: number
                ) => Promise<{ data: CustomerRowIndividual[] | null }>;
              };
            };
          };
        }
      )
        .select("id,parent_name,parent_phone,status,created_at")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false })
        .limit(CUSTOMER_LIST_LIMIT),
      (
        supabase.from("partner_customers" as never) as unknown as {
          select: (
            c: string,
            o: { count: "exact"; head: true }
          ) => {
            eq: (k: string, v: string) => Promise<{ count: number | null }>;
          };
        }
      )
        .select("id", { count: "exact", head: true })
        .eq("partner_id", partnerId),
      (
        supabase.from("partner_companies" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => {
                limit: (
                  n: number
                ) => Promise<{ data: CompanyRow[] | null }>;
              };
            };
          };
        }
      )
        .select("id,company_name,status,business_number,created_at")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false })
        .limit(CUSTOMER_LIST_LIMIT),
      (
        supabase.from("partner_companies" as never) as unknown as {
          select: (
            c: string,
            o: { count: "exact"; head: true }
          ) => {
            eq: (k: string, v: string) => Promise<{ count: number | null }>;
          };
        }
      )
        .select("id", { count: "exact", head: true })
        .eq("partner_id", partnerId),
    ]);

  return {
    orgs: orgsResp.data ?? [],
    orgsTotal: orgsCountResp.count ?? 0,
    individuals: indResp.data ?? [],
    individualsTotal: indCountResp.count ?? 0,
    companies: compResp.data ?? [],
    companiesTotal: compCountResp.count ?? 0,
  };
}

async function loadQuickStats(partnerId: string) {
  const supabase = await createClient();
  try {
    const { data, error } = await (
      supabase.from("partner_programs") as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => Promise<{
            data: ProgramRow[] | null;
            error: unknown;
          }>;
        };
      }
    )
      .select(
        "id,is_published,rating_avg,rating_count,booking_count,price_per_person"
      )
      .eq("partner_id", partnerId);

    if (error || !data) return { revenue: 0, active: 0, avgRating: null as number | null };

    const active = data.filter((p) => p.is_published).length;
    const totalRevenue = data.reduce(
      (s, p) => s + (p.booking_count ?? 0) * (p.price_per_person ?? 0),
      0
    );
    const rated = data.filter(
      (p) => (p.rating_count ?? 0) > 0 && p.rating_avg != null
    );
    const avgRating =
      rated.length > 0
        ? rated.reduce((s, p) => s + (p.rating_avg ?? 0), 0) / rated.length
        : null;

    return {
      revenue: Math.round(totalRevenue * 0.35), // mock 이번달 비율
      active,
      avgRating,
    };
  } catch {
    return { revenue: 0, active: 0, avgRating: null as number | null };
  }
}

/**
 * 이번달 매출 (settlements 테이블 기반).
 *  - 현재 월(period_start가 이번달)의 gross_sales를 합산
 *  - 테이블 없거나 데이터 없으면 0
 */
async function loadMonthlySales(partnerId: string): Promise<{
  gross: number;
  net: number;
  status: string | null;
}> {
  const supabase = await createClient();
  try {
    const now = new Date();
    const startIso = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              gte: (k: string, v: string) => Promise<{
                data: {
                  gross_sales: number;
                  net_amount: number;
                  status: string;
                }[] | null;
              }>;
            };
          };
        };
      }
    )
      .from("settlements")
      .select("gross_sales, net_amount, status")
      .eq("partner_id", partnerId)
      .gte("period_start", startIso);

    if (!data || data.length === 0) {
      return { gross: 0, net: 0, status: null };
    }
    const gross = data.reduce((s, r) => s + (r.gross_sales ?? 0), 0);
    const net = data.reduce((s, r) => s + (r.net_amount ?? 0), 0);
    return { gross, net, status: data[0]?.status ?? null };
  } catch {
    return { gross: 0, net: 0, status: null };
  }
}

export default async function PartnerDashboardPage() {
  const partner = await requirePartner();
  const showTeamCard = partner.role === "OWNER" || partner.role === "MANAGER";
  const [
    quick,
    monthly,
    teamStats,
    docStats,
    docExpiring,
    docLatestMap,
    profileSnap,
    customers,
  ] = await Promise.all([
    loadQuickStats(partner.id),
    loadMonthlySales(partner.id),
    showTeamCard ? safeLoadTeamStats(partner.id) : Promise.resolve(null),
    loadDocumentStats(partner.id),
    loadExpiringDocuments(partner.id),
    loadLatestPartnerDocuments(partner.id),
    loadPartnerProfileSnapshot(partner.id),
    loadPartnerCustomersAll(partner.id),
  ]);
  const profileCompleteness = calcCompleteness(
    PARTNER_PROFILE_SCHEMA,
    profileSnap
  );

  const tasks = await loadTasksStatus(
    partner.id,
    profileCompleteness.percent,
    quick.active
  );

  // 서류 이슈 카운트
  const docRejected = docStats.rejected;
  const docExpiringCount = docExpiring.length;
  const docMissingRequired = DOC_TYPE_KEYS.filter(
    (k) => DOC_TYPE_META[k].required && !docLatestMap.has(k)
  ).length;
  const hasDocIssues =
    docRejected > 0 || docExpiringCount > 0 || docMissingRequired > 0;
  const docTone: "rose" | "amber" = docRejected > 0 ? "rose" : "amber";

  const statusLabelMap: Record<string, string> = {
    DRAFT: "집계 중",
    REVIEW: "검토 중",
    APPROVED: "승인됨",
    PAID: "지급 완료",
    DISPUTED: "이의 제기",
  };
  const monthlyStatusLabel = monthly.status
    ? statusLabelMap[monthly.status] ?? monthly.status
    : "집계 전";

  // 활성 구독자 = 이 지사의 기관 고객 수 (partner_orgs) + 개인 고객 (partner_customers ACTIVE)
  const activeSubscriberCount =
    customers.orgsTotal + customers.individualsTotal;

  const STATS = [
    {
      icon: <AcornIcon size={18} />,
      label: "이번달 수입",
      value: formatWon(monthly.gross),
      sub: monthlyStatusLabel,
    },
    {
      icon: "🌿",
      label: "진행중 프로그램",
      value: `${quick.active}개`,
      sub: "게시 중",
    },
    {
      icon: "👨‍👩‍👧",
      label: "활성 고객",
      value: `${activeSubscriberCount}명`,
      sub: `기관 ${customers.orgsTotal} · 개인 ${customers.individualsTotal}`,
    },
    {
      icon: "⭐",
      label: "평균 리뷰",
      value: quick.avgRating != null ? quick.avgRating.toFixed(2) : "-",
      sub: quick.avgRating != null ? "집계 기준" : "리뷰 없음",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Forest gradient welcome header */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-sm md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#D4E4BC]">
              Today · 오늘의 숲지기 현황
            </p>
            <h1 className="mt-2 text-2xl font-bold md:text-3xl">
              안녕하세요, {partner.name} 숲지기님 🌲
            </h1>
            <p className="mt-1 text-sm text-[#E8F0E4]">
              오늘도 숲길을 가꾸어주셔서 감사해요.
            </p>
          </div>
          <div className="hidden text-right md:block">
            <div className="text-5xl">🏡</div>
          </div>
        </div>
      </section>

      {/* 프로필 완성도 배너 (80% 미만일 때만) */}
      <CompletenessNudgeBanner
        result={profileCompleteness}
        href="/partner/my#missing"
      />

      {/* 📄 서류 경고 배너 (이슈가 있을 때만) */}
      {hasDocIssues && (
        <section
          className={`rounded-2xl border shadow-sm ${
            docTone === "rose"
              ? "border-rose-300 bg-rose-50"
              : "border-amber-300 bg-amber-50"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden
                className="text-xl"
              >
                {docTone === "rose" ? "🚨" : "⏰"}
              </span>
              <div className="min-w-0">
                <h2
                  className={`text-sm font-bold ${
                    docTone === "rose" ? "text-rose-900" : "text-amber-900"
                  }`}
                >
                  서류 주의
                </h2>
                <p
                  className={`mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold ${
                    docTone === "rose" ? "text-rose-800" : "text-amber-800"
                  }`}
                >
                  {docRejected > 0 && <span>• 반려 {docRejected}건</span>}
                  {docExpiringCount > 0 && (
                    <span>• 만료 임박 {docExpiringCount}건</span>
                  )}
                  {docMissingRequired > 0 && (
                    <span>• 미제출 {docMissingRequired}건</span>
                  )}
                </p>
              </div>
            </div>
            <Link
              href="/partner/settings/documents"
              className={`inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                docTone === "rose"
                  ? "border border-rose-400 bg-white text-rose-800 hover:bg-rose-100"
                  : "border border-amber-400 bg-white text-amber-800 hover:bg-amber-100"
              }`}
            >
              📄 서류로 →
            </Link>
          </div>
        </section>
      )}

      {/* 4 Stat cards */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[#6B6560]">
              <span className="text-lg">{s.icon}</span>
              <span>{s.label}</span>
            </div>
            <div className="mt-2 text-xl font-bold text-[#2D5A3D] md:text-2xl">
              {s.value}
            </div>
            <div className="mt-0.5 text-[11px] text-[#B5AFA8]">{s.sub}</div>
          </div>
        ))}
      </section>

      {/* 빠른 분석 widget */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-gradient-to-br from-white to-[#E8F0E4] p-4 shadow-sm md:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>⚡</span>
            <span>빠른 분석</span>
          </h2>
          <Link
            href="/partner/analytics"
            className="text-xs font-semibold text-[#3A7A52] hover:text-[#2D5A3D] hover:underline"
          >
            전체 분석 보기 →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          <div className="rounded-xl border border-[#E5D3B8] bg-[#FFF8F0] p-3">
            <p className="text-[10px] font-semibold text-[#8B6F47] md:text-[11px]">
              💰 이번달 매출
            </p>
            <p className="mt-1 truncate text-base font-extrabold text-[#6B4423] md:text-lg">
              {formatWon(quick.revenue)}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-[10px] font-semibold text-emerald-700 md:text-[11px]">
              🌿 활성 프로그램
            </p>
            <p className="mt-1 text-base font-extrabold text-emerald-900 md:text-lg">
              {quick.active}
              <span className="ml-0.5 text-xs font-semibold">개</span>
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-[10px] font-semibold text-amber-700 md:text-[11px]">
              ⭐ 평균 평점
            </p>
            <p className="mt-1 text-base font-extrabold text-amber-900 md:text-lg">
              {quick.avgRating != null ? quick.avgRating.toFixed(2) : "-"}
            </p>
          </div>
        </div>
      </section>

      {/* 👥 고객 현황 — 기관 · 개인 · 기업 */}
      <section>
        <div className="mb-2 flex items-end justify-between px-1">
          <h2 className="text-sm font-semibold text-[#6B6560]">
            👥 고객 현황
          </h2>
          <Link
            href="/partner/customers"
            className="text-xs font-semibold text-[#3A7A52] hover:text-[#2D5A3D] hover:underline"
          >
            전체 고객 관리 →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <CustomerGroupCard
            title="🏫 기관 고객"
            total={customers.orgsTotal}
            emptyMsg="아직 등록된 기관이 없어요"
            items={customers.orgs.map<CustomerItem>((o) => ({
              id: o.id,
              name: o.org_name,
              sub: o.auto_username ? `@${o.auto_username}` : null,
              status: o.status,
              impersonateHref: `/api/partner/impersonate-org?id=${o.id}`,
            }))}
          />

          <CustomerGroupCard
            title="👨‍👩‍👧 개인 고객"
            total={customers.individualsTotal}
            emptyMsg="아직 등록된 개인 고객이 없어요"
            items={customers.individuals.map<CustomerItem>((c) => ({
              id: c.id,
              name: c.parent_name,
              sub: c.parent_phone,
              status: c.status,
              impersonateHref: null,
              disabledReason: "상세 보기",
            }))}
          />

          <CustomerGroupCard
            title="💼 기업 고객"
            total={customers.companiesTotal}
            emptyMsg="아직 등록된 기업 고객이 없어요"
            items={customers.companies.map<CustomerItem>((c) => ({
              id: c.id,
              name: c.company_name,
              sub: c.business_number,
              status: c.status,
              impersonateHref: null,
              disabledReason: "준비 중",
            }))}
          />
        </div>
      </section>

      {/* 👥 팀 현황 (OWNER/MANAGER 전용) */}
      {showTeamCard && (
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                aria-hidden
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F0E4] text-lg"
              >
                👥
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#2D5A3D]">팀 현황</h2>
                {teamStats ? (
                  <p className="mt-0.5 text-xs text-[#6B6560]">
                    활성{" "}
                    <strong className="text-[#2D5A3D]">
                      {teamStats.active}명
                    </strong>
                    {teamStats.pending > 0 && (
                      <>
                        {" "}
                        ·{" "}
                        <span className="font-semibold text-rose-600">
                          대기 {teamStats.pending}명
                        </span>
                      </>
                    )}
                    {teamStats.total > 0 && (
                      <>
                        {" "}· 전체 {teamStats.total}명
                      </>
                    )}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-[#8B7F75]">
                    팀원을 초대해 함께 숲을 가꿔보세요
                  </p>
                )}
              </div>
            </div>
            <Link
              href="/partner/settings/team"
              className="inline-flex items-center gap-1 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              팀 관리 →
            </Link>
          </div>
        </section>
      )}

      {/* 💰 이번달 매출 하이라이트 (settlements 기반) */}
      <section className="rounded-2xl border-2 border-[#E5D3B8] bg-gradient-to-br from-[#FFF8F0] via-[#F5E6D3] to-[#E8D4B8] p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#8B6F47]">
              <span>💰</span>
              <span>이번달 매출</span>
            </p>
            <p className="mt-2 text-3xl font-extrabold text-[#6B4423] md:text-4xl">
              {formatWon(monthly.gross)}
            </p>
            <p className="mt-1 text-[11px] text-[#8B6F47]">
              예상 정산액 {formatWon(monthly.net)} ·{" "}
              <span className="font-semibold">{monthlyStatusLabel}</span>
            </p>
          </div>
          <Link
            href="/partner/billing/settlements"
            className="inline-flex items-center gap-1 rounded-xl border border-[#C4956A] bg-white px-3 py-2 text-xs font-semibold text-[#6B4423] transition hover:bg-[#FFF8F0]"
          >
            정산 상세 →
          </Link>
        </div>
      </section>

      {/* 9-menu grid 3x3 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm md:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>🌳</span>
          <span>숲지기 빠른메뉴</span>
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {MENUS.map((m) => (
            <Link
              key={m.label}
              href={m.href}
              className="group flex flex-col items-center justify-center rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-3 text-center transition hover:border-[#3A7A52] hover:bg-[#E8F0E4] md:p-4"
            >
              <div className="text-2xl md:text-3xl">{m.icon}</div>
              <div className="mt-1.5 text-xs font-semibold text-[#2D5A3D] md:text-sm">
                {m.label}
              </div>
              <div className="mt-0.5 hidden text-[10px] text-[#6B6560] md:block">
                {m.desc}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 오늘의 할 일 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>✅</span>
            <span>오늘의 할 일</span>
          </h2>
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li key={t.text}>
                <Link
                  href={t.href}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                    t.done
                      ? "border-[#D4E4BC] bg-[#E8F0E4]"
                      : "border-[#D4E4BC] bg-[#FFF8F0] hover:bg-[#F5F1E8]"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      t.done
                        ? "border-[#3A7A52] bg-[#3A7A52] text-white"
                        : "border-[#D4E4BC] bg-white"
                    }`}
                  >
                    {t.done ? "✓" : ""}
                  </span>
                  <span
                    className={`flex-1 text-sm ${
                      t.done
                        ? "text-[#B5AFA8] line-through"
                        : "text-[#2C2C2C]"
                    }`}
                  >
                    {t.text}
                  </span>
                  {!t.done && (
                    <span className="text-[11px] font-semibold text-[#3A7A52]">
                      →
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* 최근 숲길 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>🌲</span>
            <span>최근 숲길</span>
          </h2>
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-4 py-10 text-center">
            <div className="text-3xl">🌱</div>
            <p className="mt-2 text-sm font-semibold text-[#2D5A3D]">
              아직 만든 숲길이 없어요
            </p>
            <p className="mt-1 text-xs text-[#6B6560]">곧 열릴 기능입니다 🌱</p>
          </div>
        </section>
      </div>
    </div>
  );
}
