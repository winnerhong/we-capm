import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";
import type { CustomerStatus, CustomerTier } from "./actions";

type Child = { name: string; age: number | null };

type Customer = {
  id: string;
  parent_name: string;
  parent_phone: string;
  email: string | null;
  children: Child[] | null;
  interests: string[] | null;
  tags: string[] | null;
  tier: CustomerTier;
  status: CustomerStatus;
  total_events: number;
  total_spent: number;
  ltv: number;
  last_visit_at: string | null;
  created_at: string;
};

const TIER_META: Record<
  CustomerTier,
  { label: string; icon: string; chip: string; order: number }
> = {
  SPROUT: {
    label: "새싹",
    icon: "🌱",
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    order: 1,
  },
  EXPLORER: {
    label: "탐험가",
    icon: "🌿",
    chip: "bg-lime-50 text-lime-800 border-lime-200",
    order: 2,
  },
  TREE: {
    label: "나무",
    icon: "🌳",
    chip: "bg-teal-50 text-teal-800 border-teal-200",
    order: 3,
  },
  FOREST: {
    label: "숲",
    icon: "🏞️",
    chip: "bg-[#E8F0E4] text-[#2D5A3D] border-[#2D5A3D]/30",
    order: 4,
  },
};

const STATUS_META: Record<
  CustomerStatus,
  { label: string; chip: string }
> = {
  ACTIVE: {
    label: "활성",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  INACTIVE: {
    label: "비활성",
    chip: "bg-zinc-100 text-zinc-600 border-zinc-200",
  },
  DORMANT: {
    label: "휴면",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
  },
  CHURNED: {
    label: "이탈",
    chip: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

type SearchParams = {
  tier?: string;
  status?: string;
  tag?: string;
  q?: string;
};

async function loadCustomers(partnerId: string): Promise<Customer[]> {
  const supabase = await createClient();
  const columns =
    "id,parent_name,parent_phone,email,children,interests,tags,tier,status,total_events,total_spent,ltv,last_visit_at,created_at";

  const { data, error } = await supabase
    .from("partner_customers")
    .select(columns)
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[partner/customers/individual] load error", error);
    return [];
  }
  return (data ?? []) as unknown as Customer[];
}

function formatWon(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  return `${n.toLocaleString("ko-KR")}원`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "-";
  }
}

function isThisMonth(iso: string): boolean {
  try {
    const d = new Date(iso);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  } catch {
    return false;
  }
}

function applyFilters(rows: Customer[], sp: SearchParams): Customer[] {
  const q = (sp.q ?? "").trim().toLowerCase();
  const tier = (sp.tier ?? "").trim();
  const status = (sp.status ?? "").trim();
  const tag = (sp.tag ?? "").trim();

  return rows.filter((r) => {
    if (tier && r.tier !== tier) return false;
    if (status && r.status !== status) return false;
    if (tag) {
      const tags = r.tags ?? [];
      if (!tags.some((t) => t === tag)) return false;
    }
    if (q) {
      const hay = `${r.parent_name} ${r.parent_phone}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export default async function PartnerIndividualCustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const partner = await requirePartner();
  const sp = await searchParams;
  const all = await loadCustomers(partner.id);
  const rows = applyFilters(all, sp);

  const total = all.length;
  const activeCount = all.filter((r) => r.status === "ACTIVE").length;
  const dormantCount = all.filter((r) => r.status === "DORMANT").length;
  const churnRiskCount = all.filter(
    (r) => r.status === "DORMANT" || r.status === "CHURNED"
  ).length;
  const thisMonthCount = all.filter((r) => isThisMonth(r.created_at)).length;

  const tierCounts: Record<CustomerTier, number> = {
    SPROUT: 0,
    EXPLORER: 0,
    TREE: 0,
    FOREST: 0,
  };
  for (const r of all) tierCounts[r.tier] = (tierCounts[r.tier] ?? 0) + 1;
  const maxTier = Math.max(1, ...Object.values(tierCounts));

  // 전체 태그 수집 (필터 select용)
  const tagSet = new Set<string>();
  for (const r of all) for (const t of r.tags ?? []) tagSet.add(t);
  const allTags = Array.from(tagSet).sort();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">개인 고객 (B2C)</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              👨‍👩‍👧
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
                개인 고객 (B2C)
              </h1>
              <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
                가족 단위 고객을 관리하고 맞춤 체험을 제안하세요.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/partner/customers/individual/new"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40"
            >
              <span aria-hidden>➕</span>
              <span>새 고객 등록</span>
            </Link>
            <Link
              href="/partner/customers/individual/bulk"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E5D3B8] bg-white px-4 py-2.5 text-sm font-bold text-[#6B4423] hover:bg-[#FFF8F0]"
            >
              <span aria-hidden>📥</span>
              <span>엑셀 일괄등록</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 통계 */}
      <section
        aria-label="고객 통계"
        className="grid grid-cols-2 gap-3 md:grid-cols-5"
      >
        <StatCard label="전체 고객" value={total} tone="forest" />
        <StatCard label="활성" value={activeCount} tone="emerald" />
        <StatCard label="휴면" value={dormantCount} tone="amber" />
        <StatCard label="이탈 위험" value={churnRiskCount} tone="rose" />
        <StatCard label="이번달 신규" value={thisMonthCount} tone="sky" />
      </section>

      {/* 티어 분포 */}
      <section
        aria-label="티어 분포"
        className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm"
      >
        <h2 className="text-sm font-bold text-[#2D5A3D]">티어 분포</h2>
        <ul className="mt-3 space-y-2.5">
          {(Object.keys(TIER_META) as CustomerTier[])
            .sort((a, b) => TIER_META[a].order - TIER_META[b].order)
            .map((t) => {
              const meta = TIER_META[t];
              const n = tierCounts[t];
              const pct = Math.round((n / maxTier) * 100);
              return (
                <li key={t} className="flex items-center gap-3">
                  <div className="flex w-28 items-center gap-1.5 text-xs font-semibold text-[#2D5A3D]">
                    <span aria-hidden>{meta.icon}</span>
                    <span>{meta.label}</span>
                  </div>
                  <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-[#F4EFE8]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#C4956A] to-[#2D5A3D]"
                      style={{ width: `${pct}%` }}
                      aria-hidden
                    />
                  </div>
                  <span className="w-12 text-right text-xs font-bold text-[#2D5A3D]">
                    {n}
                  </span>
                </li>
              );
            })}
        </ul>
      </section>

      {/* 필터 */}
      <form
        method="get"
        className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm"
      >
        <div className="grid gap-3 md:grid-cols-4">
          <label className="block">
            <span className="text-[11px] font-semibold text-[#6B6560]">
              이름 / 전화번호 검색
            </span>
            <input
              type="text"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="예) 홍길동 / 010-1234-5678"
              inputMode="search"
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-sm text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-[#6B6560]">티어</span>
            <select
              name="tier"
              defaultValue={sp.tier ?? ""}
              className="mt-1 w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-sm text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
            >
              <option value="">전체</option>
              <option value="SPROUT">🌱 새싹</option>
              <option value="EXPLORER">🌿 탐험가</option>
              <option value="TREE">🌳 나무</option>
              <option value="FOREST">🏞️ 숲</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-[#6B6560]">상태</span>
            <select
              name="status"
              defaultValue={sp.status ?? ""}
              className="mt-1 w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-sm text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
            >
              <option value="">전체</option>
              <option value="ACTIVE">활성</option>
              <option value="INACTIVE">비활성</option>
              <option value="DORMANT">휴면</option>
              <option value="CHURNED">이탈</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-[#6B6560]">태그</span>
            <select
              name="tag"
              defaultValue={sp.tag ?? ""}
              className="mt-1 w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-sm text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
            >
              <option value="">전체</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="submit"
            className="rounded-lg bg-[#2D5A3D] px-4 py-2 text-xs font-bold text-white hover:bg-[#234a30]"
          >
            필터 적용
          </button>
          <Link
            href="/partner/customers/individual"
            className="rounded-lg border border-[#E5D3B8] bg-white px-4 py-2 text-xs font-semibold text-[#6B4423] hover:bg-[#FFF8F0]"
          >
            초기화
          </Link>
          <span className="ml-auto text-xs text-[#6B6560]">
            {rows.length.toLocaleString("ko-KR")} / {total.toLocaleString("ko-KR")}명
          </span>
        </div>
      </form>

      {/* 테이블 */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="text-5xl" aria-hidden>
            🌱
          </div>
          <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
            조건에 맞는 고객이 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            첫 번째 가족 고객을 등록해 보세요.
          </p>
          <Link
            href="/partner/customers/individual/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-bold text-white hover:bg-[#234a30]"
          >
            <span aria-hidden>➕</span>
            <span>새 고객 등록</span>
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-[#F4EFE8] text-[#6B4423]">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[11px] font-bold">이름</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-bold">전화</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-bold">아이 수</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-bold">총 방문</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-bold">LTV</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-bold">티어</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-bold">상태</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-bold">최근 방문</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const tier = TIER_META[r.tier] ?? TIER_META.SPROUT;
                  const status = STATUS_META[r.status] ?? STATUS_META.ACTIVE;
                  const childCount = (r.children ?? []).length;
                  return (
                    <tr
                      key={r.id}
                      className="border-t border-[#F4EFE8] hover:bg-[#FFF8F0]"
                    >
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/partner/customers/individual/${r.id}`}
                          className="font-semibold text-[#2D5A3D] hover:underline"
                        >
                          {r.parent_name}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-[#6B6560]">
                        {r.parent_phone}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FAE7D0] px-2 py-0.5 text-[11px] font-bold text-[#6B4423]">
                          <span aria-hidden>👶</span>
                          {childCount}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-[#2D5A3D]">
                        {r.total_events.toLocaleString("ko-KR")}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-[#6B4423]">
                        {formatWon(r.ltv)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tier.chip}`}
                        >
                          <span aria-hidden>{tier.icon}</span>
                          {tier.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.chip}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#6B6560]">
                        {formatDate(r.last_visit_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "forest" | "emerald" | "amber" | "rose" | "sky";
}) {
  const toneClasses: Record<typeof tone, string> = {
    forest: "border-[#D4E4BC] bg-white text-[#2D5A3D]",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    sky: "border-sky-200 bg-sky-50 text-sky-900",
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClasses[tone]}`}>
      <p className="text-[11px] font-semibold opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value.toLocaleString("ko-KR")}</p>
    </div>
  );
}
