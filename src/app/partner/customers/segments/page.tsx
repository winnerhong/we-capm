import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CustomSegment = {
  id: string;
  name: string;
  description: string | null;
  segment_type: string | null;
  icon: string | null;
  color: string | null;
  member_count: number;
  created_at: string;
};

type OrgRow = {
  id: string;
  status: string;
  children_count: number;
  total_contracts?: number;
  created_at: string;
  contract_end: string | null;
};

type CustomerRow = {
  id: string;
  status: string;
  last_visit_at: string | null;
  total_events: number;
  total_spent: number;
  children: unknown;
};

type CompanyRow = {
  id: string;
  status: string;
  total_revenue: number;
  next_renewal: string | null;
};

async function loadData(partnerId: string) {
  const supabase = await createClient();
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{ data: unknown[] | null }>;
      };
    };
  };

  const [segRes, orgRes, custRes, coRes] = await Promise.all([
    client.from("partner_segments").select("*").eq("partner_id", partnerId),
    client
      .from("partner_orgs")
      .select("id,status,children_count,created_at,contract_end")
      .eq("partner_id", partnerId),
    client
      .from("partner_customers")
      .select("id,status,last_visit_at,total_events,total_spent,children")
      .eq("partner_id", partnerId),
    client
      .from("partner_companies")
      .select("id,status,total_revenue,next_renewal")
      .eq("partner_id", partnerId),
  ]);

  return {
    custom: (segRes.data ?? []) as CustomSegment[],
    orgs: (orgRes.data ?? []) as OrgRow[],
    customers: (custRes.data ?? []) as CustomerRow[],
    companies: (coRes.data ?? []) as CompanyRow[],
  };
}

export default async function SegmentsListPage() {
  const partner = await requirePartner();
  const { custom, orgs, customers, companies } = await loadData(partner.id);

  const now = new Date();
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Default 자동 계산
  const vipOrgs = orgs.filter((o) => o.status === "ACTIVE").length; // 연매출은 스키마에 없어 ACTIVE 대체
  const vipCompanies = companies.filter((c) => c.total_revenue >= 10_000_000).length;
  const vipCount = vipOrgs + vipCompanies;

  const churnRisk = customers.filter((c) => {
    if (c.status === "CHURNED") return false;
    if (!c.last_visit_at) return false;
    return new Date(c.last_visit_at) < threeMonthsAgo;
  }).length;

  const loyal = customers.filter((c) => (c.total_events ?? 0) >= 5).length;

  const dormant = customers.filter((c) => {
    if (!c.last_visit_at) return false;
    return new Date(c.last_visit_at) < sixMonthsAgo;
  }).length;

  // 생일 D-7: children JSON에서 birthday 필드가 있으면 매칭. 없으면 0.
  const birthdayFamilies = customers.filter((c) => {
    try {
      const children = Array.isArray(c.children) ? c.children : [];
      for (const child of children as { birthday?: string }[]) {
        if (!child?.birthday) continue;
        const [_, mm, dd] = child.birthday.split("-");
        if (!mm || !dd) continue;
        const thisYear = new Date(now.getFullYear(), Number(mm) - 1, Number(dd));
        const diff = thisYear.getTime() - now.getTime();
        if (diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000) return true;
      }
      return false;
    } catch {
      return false;
    }
  }).length;

  // unused var guard
  void sevenDaysLater;

  const DEFAULT_SEGMENTS = [
    {
      icon: "👑",
      name: "VIP 기관/기업",
      desc: "연매출 1천만원 이상 · 주요 계약",
      count: vipCount,
      color: "border-amber-300 bg-amber-50 hover:bg-amber-100",
      accent: "text-amber-700",
    },
    {
      icon: "⚠️",
      name: "이탈 위험",
      desc: "3개월 이상 미방문",
      count: churnRisk,
      color: "border-rose-300 bg-rose-50 hover:bg-rose-100",
      accent: "text-rose-700",
    },
    {
      icon: "💖",
      name: "단골 가족",
      desc: "5회 이상 참여",
      count: loyal,
      color: "border-violet-300 bg-violet-50 hover:bg-violet-100",
      accent: "text-violet-700",
    },
    {
      icon: "💤",
      name: "휴면 고객",
      desc: "6개월 이상 미방문",
      count: dormant,
      color: "border-stone-300 bg-stone-50 hover:bg-stone-100",
      accent: "text-stone-700",
    },
    {
      icon: "🎂",
      name: "생일 가족",
      desc: "아이 생일 D-7 이내",
      count: birthdayFamilies,
      color: "border-pink-300 bg-pink-50 hover:bg-pink-100",
      accent: "text-pink-700",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-700 via-violet-600 to-violet-700 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-fuchsia-100">
              Segments · 고객 그룹
            </p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold md:text-3xl">
              <span>🎯</span>
              <span>고객 그룹</span>
            </h1>
            <p className="mt-1 text-sm text-fuchsia-100">
              규칙 기반으로 고객을 자동 그룹화합니다.
            </p>
          </div>
          <Link
            href="/partner/customers/segments/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-violet-700 shadow-sm transition hover:bg-violet-50"
          >
            <span>➕</span>
            <span>새 세그먼트 만들기</span>
          </Link>
        </div>
      </section>

      {/* 기본 세그먼트 (자동) */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>✨</span>
            <span>기본 세그먼트</span>
          </h2>
          <span className="text-xs text-[#6B6560]">자동 계산 · 실시간 업데이트</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {DEFAULT_SEGMENTS.map((s) => (
            <div
              key={s.name}
              className={`rounded-2xl border p-4 shadow-sm transition ${s.color}`}
            >
              <div className="flex items-start justify-between">
                <div className="text-3xl">{s.icon}</div>
                <div className={`text-right ${s.accent}`}>
                  <div className="text-xs font-semibold">대상</div>
                  <div className="text-2xl font-extrabold">
                    {s.count.toLocaleString("ko-KR")}
                    <span className="ml-0.5 text-xs font-semibold">명</span>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-sm font-bold text-[#2C2C2C]">{s.name}</div>
                <div className="mt-0.5 text-xs text-[#6B6560]">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 사용자 세그먼트 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>🛠️</span>
            <span>내가 만든 세그먼트</span>
          </h2>
          <span className="text-xs text-[#6B6560]">{custom.length}개</span>
        </div>
        {custom.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
            <div className="text-4xl">🌱</div>
            <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
              아직 만든 세그먼트가 없어요
            </p>
            <p className="mt-1 text-xs text-[#6B6560]">
              규칙을 조합해서 나만의 고객 그룹을 만들어 보세요.
            </p>
            <Link
              href="/partner/customers/segments/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-700"
            >
              <span>➕</span>
              <span>첫 세그먼트 만들기</span>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {custom.map((s) => (
              <Link
                key={s.id}
                href={`/partner/customers/segments/${s.id}`}
                className="group rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm transition hover:border-violet-400 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl"
                    style={{ backgroundColor: `${s.color ?? "#2D5A3D"}20` }}
                  >
                    {s.icon ?? "🎯"}
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-semibold text-[#6B6560]">대상</div>
                    <div className="text-xl font-extrabold text-violet-700">
                      {(s.member_count ?? 0).toLocaleString("ko-KR")}
                      <span className="ml-0.5 text-xs font-semibold">명</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-sm font-bold text-[#2C2C2C] group-hover:text-violet-700">
                    {s.name}
                  </div>
                  {s.description && (
                    <div className="mt-0.5 line-clamp-2 text-xs text-[#6B6560]">
                      {s.description}
                    </div>
                  )}
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#6B6560]">
                    {s.segment_type === "ORG"
                      ? "🏫 기관"
                      : s.segment_type === "CUSTOMER"
                      ? "👨‍👩‍👧 개인"
                      : s.segment_type === "COMPANY"
                      ? "🏢 기업"
                      : "🔀 혼합"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
