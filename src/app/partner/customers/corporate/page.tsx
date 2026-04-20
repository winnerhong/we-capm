import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  PIPELINE_STAGES,
  updatePipelineStageAction,
  type PipelineStage,
} from "./actions";
import { StageSelect } from "./stage-select";

export const dynamic = "force-dynamic";

type CompanyRow = {
  id: string;
  company_name: string;
  business_number: string | null;
  representative_name: string | null;
  industry: string | null;
  employee_count: number | null;
  total_contracts: number;
  total_revenue: number;
  active_contracts: number;
  next_renewal: string | null;
  status: PipelineStage;
  pipeline_stage: string | null;
  tags: string[] | null;
  created_at: string;
};

type ContactLite = {
  company_id: string;
  name: string;
  is_primary: boolean;
};

const STAGE_META: Record<
  PipelineStage,
  { label: string; emoji: string; bg: string; border: string; text: string; dot: string }
> = {
  LEAD: {
    label: "리드",
    emoji: "🌱",
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-700",
    dot: "bg-slate-400",
  },
  PROPOSED: {
    label: "제안 발송",
    emoji: "📨",
    bg: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-800",
    dot: "bg-sky-500",
  },
  NEGOTIATING: {
    label: "협상중",
    emoji: "🤝",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    dot: "bg-amber-500",
  },
  CONTRACTED: {
    label: "계약 체결",
    emoji: "📝",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-800",
    dot: "bg-indigo-500",
  },
  ACTIVE: {
    label: "계약중",
    emoji: "✅",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
    dot: "bg-emerald-500",
  },
  RENEWAL: {
    label: "갱신 예정",
    emoji: "🔄",
    bg: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-800",
    dot: "bg-violet-500",
  },
  CHURNED: {
    label: "종료",
    emoji: "📦",
    bg: "bg-zinc-50",
    border: "border-zinc-200",
    text: "text-zinc-600",
    dot: "bg-zinc-400",
  },
};

function formatBiz(raw: string | null): string {
  if (!raw) return "-";
  const d = raw.replace(/\D/g, "");
  if (d.length !== 10) return raw;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

function formatWon(n: number | null | undefined): string {
  if (!n) return "0원";
  return `${n.toLocaleString("ko-KR")}원`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR");
  } catch {
    return iso;
  }
}

const EMPLOYEE_RANGES = [
  { value: "", label: "전체 규모" },
  { value: "1-10", label: "1-10명" },
  { value: "11-50", label: "11-50명" },
  { value: "51-200", label: "51-200명" },
  { value: "201-1000", label: "201-1,000명" },
  { value: "1000+", label: "1,000명 이상" },
];

function matchRange(count: number | null, range: string): boolean {
  if (!range) return true;
  if (count === null || count === undefined) return false;
  if (range === "1-10") return count <= 10;
  if (range === "11-50") return count >= 11 && count <= 50;
  if (range === "51-200") return count >= 51 && count <= 200;
  if (range === "201-1000") return count >= 201 && count <= 1000;
  if (range === "1000+") return count > 1000;
  return true;
}

async function loadCompanies(partnerId: string): Promise<CompanyRow[]> {
  const supabase = await createClient();
  const { data, error } = await (
    supabase.from("partner_companies" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (k: string, o: { ascending: boolean }) => Promise<{
            data: CompanyRow[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .select(
      "id,company_name,business_number,representative_name,industry,employee_count,total_contracts,total_revenue,active_contracts,next_renewal,status,pipeline_stage,tags,created_at"
    )
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[corporate/list] load error", error);
    return [];
  }
  return data ?? [];
}

async function loadPrimaryContacts(companyIds: string[]): Promise<Map<string, string>> {
  if (companyIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await (
    supabase.from("partner_company_contacts" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => Promise<{
          data: ContactLite[] | null;
          error: { message: string } | null;
        }>;
      };
    }
  )
    .select("company_id,name,is_primary")
    .in("company_id", companyIds);

  if (error || !data) return new Map();

  const map = new Map<string, string>();
  // Prefer primary contact; fallback to first
  for (const c of data) {
    const existing = map.get(c.company_id);
    if (!existing || c.is_primary) {
      map.set(c.company_id, c.name);
    }
  }
  return map;
}

type SearchParams = {
  view?: string;
  stage?: string;
  industry?: string;
  size?: string;
};

export default async function CorporateCustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const partner = await requirePartner();
  const sp = (await searchParams) ?? {};
  const view = sp.view === "kanban" ? "kanban" : "list";
  const stageFilter = (sp.stage ?? "") as PipelineStage | "";
  const industryFilter = sp.industry ?? "";
  const sizeFilter = sp.size ?? "";

  const companies = await loadCompanies(partner.id);
  const contactsMap = await loadPrimaryContacts(companies.map((c) => c.id));

  const industries = Array.from(
    new Set(companies.map((c) => c.industry).filter(Boolean) as string[])
  ).sort();

  const filtered = companies.filter((c) => {
    if (stageFilter && c.status !== stageFilter) return false;
    if (industryFilter && c.industry !== industryFilter) return false;
    if (!matchRange(c.employee_count, sizeFilter)) return false;
    return true;
  });

  const total = companies.length;
  const leads = companies.filter((c) => c.status === "LEAD").length;
  const negotiating = companies.filter((c) => c.status === "NEGOTIATING").length;
  const contracted = companies.filter(
    (c) => c.status === "CONTRACTED" || c.status === "ACTIVE"
  ).length;
  const churned = companies.filter((c) => c.status === "CHURNED").length;

  const qsBase = new URLSearchParams();
  if (stageFilter) qsBase.set("stage", stageFilter);
  if (industryFilter) qsBase.set("industry", industryFilter);
  if (sizeFilter) qsBase.set("size", sizeFilter);

  const listQS = new URLSearchParams(qsBase);
  listQS.set("view", "list");
  const kanbanQS = new URLSearchParams(qsBase);
  kanbanQS.set("view", "kanban");

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[#6B6560]">고객</span>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#1E3A5F]">기업 고객 (B2B)</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#1E3A5F]/20 bg-gradient-to-br from-[#E8F0E4] via-white to-[#DEE7F1] p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              🏢
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#1E3A5F] md:text-2xl">
                기업 고객 (B2B)
              </h1>
              <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
                팀빌딩·ESG·가족데이 프로그램 파트너십 계약을 관리하세요.
              </p>
            </div>
          </div>
          <Link
            href="/partner/customers/corporate/new"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#1E3A5F] to-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white shadow-md hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]/40"
          >
            <span aria-hidden>➕</span>
            <span>새 기업 등록</span>
          </Link>
        </div>
      </header>

      {/* Stats */}
      <section aria-label="통계" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-2xl border border-[#1E3A5F]/20 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-[#6B6560]">전체</p>
          <p className="mt-1 text-2xl font-extrabold text-[#1E3A5F]">{total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-semibold text-slate-700">리드</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{leads}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[11px] font-semibold text-amber-700">협상중</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-900">{negotiating}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[11px] font-semibold text-emerald-700">계약중</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-900">{contracted}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-[11px] font-semibold text-zinc-600">종료</p>
          <p className="mt-1 text-2xl font-extrabold text-zinc-800">{churned}</p>
        </div>
      </section>

      {/* Filter + View toggle */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="view" value={view} />

          <div className="flex-1 min-w-[140px]">
            <label
              htmlFor="stage"
              className="mb-1 block text-[11px] font-semibold text-[#1E3A5F]"
            >
              단계
            </label>
            <select
              id="stage"
              name="stage"
              defaultValue={stageFilter}
              className="w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
            >
              <option value="">전체 단계</option>
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_META[s].emoji} {STAGE_META[s].label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[140px]">
            <label
              htmlFor="industry"
              className="mb-1 block text-[11px] font-semibold text-[#1E3A5F]"
            >
              업종
            </label>
            <select
              id="industry"
              name="industry"
              defaultValue={industryFilter}
              className="w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
            >
              <option value="">전체 업종</option>
              {industries.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[140px]">
            <label
              htmlFor="size"
              className="mb-1 block text-[11px] font-semibold text-[#1E3A5F]"
            >
              직원수
            </label>
            <select
              id="size"
              name="size"
              defaultValue={sizeFilter}
              className="w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
            >
              {EMPLOYEE_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152b47] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]/40"
            >
              필터 적용
            </button>
            <Link
              href="/partner/customers/corporate"
              className="rounded-lg border border-[#D4E4BC] bg-white px-4 py-2 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
            >
              초기화
            </Link>
          </div>
        </form>

        {/* View toggle */}
        <div
          role="tablist"
          aria-label="보기 모드"
          className="mt-4 inline-flex items-center gap-1 rounded-xl border border-[#D4E4BC] bg-[#F5F1E8] p-1"
        >
          <Link
            role="tab"
            aria-selected={view === "list"}
            href={`?${listQS.toString()}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              view === "list"
                ? "bg-white text-[#1E3A5F] shadow-sm"
                : "text-[#6B6560] hover:text-[#1E3A5F]"
            }`}
          >
            📋 LIST
          </Link>
          <Link
            role="tab"
            aria-selected={view === "kanban"}
            href={`?${kanbanQS.toString()}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              view === "kanban"
                ? "bg-white text-[#1E3A5F] shadow-sm"
                : "text-[#6B6560] hover:text-[#1E3A5F]"
            }`}
          >
            🗂 KANBAN
          </Link>
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#1E3A5F]/20 bg-white p-10 text-center">
          <div className="text-5xl" aria-hidden>
            🏢
          </div>
          <p className="mt-3 text-sm font-semibold text-[#1E3A5F]">
            {total === 0
              ? "아직 등록된 기업 고객이 없어요"
              : "조건에 맞는 기업이 없어요"}
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            {total === 0
              ? "첫 번째 기업 고객을 등록해 파트너십 기회를 잡아 보세요."
              : "필터를 조정해 보세요."}
          </p>
          {total === 0 && (
            <Link
              href="/partner/customers/corporate/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#1E3A5F] px-4 py-2 text-xs font-bold text-white hover:bg-[#152b47]"
            >
              <span aria-hidden>➕</span>
              <span>새 기업 등록</span>
            </Link>
          )}
        </div>
      ) : view === "kanban" ? (
        <KanbanView companies={filtered} contactsMap={contactsMap} />
      ) : (
        <ListView companies={filtered} contactsMap={contactsMap} />
      )}
    </div>
  );
}

function ListView({
  companies,
  contactsMap,
}: {
  companies: CompanyRow[];
  contactsMap: Map<string, string>;
}) {
  return (
    <section
      aria-label="기업 목록"
      className="overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-[#F5F1E8] text-[#1E3A5F]">
            <tr className="text-left text-[11px] font-bold uppercase tracking-wide">
              <th className="px-4 py-3">회사명</th>
              <th className="px-4 py-3">사업자번호</th>
              <th className="px-4 py-3">담당자</th>
              <th className="px-4 py-3 text-right">계약수</th>
              <th className="px-4 py-3 text-right">총매출</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">갱신일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F5F1E8] text-[#2C2C2C]">
            {companies.map((c) => {
              const meta = STAGE_META[c.status] ?? STAGE_META.LEAD;
              return (
                <tr key={c.id} className="hover:bg-[#FFF8F0]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/partner/customers/corporate/${c.id}`}
                      className="font-semibold text-[#1E3A5F] hover:underline"
                    >
                      {c.company_name}
                    </Link>
                    {c.industry && (
                      <div className="mt-0.5 text-[11px] text-[#6B6560]">
                        {c.industry}
                        {c.employee_count ? ` · ${c.employee_count}명` : ""}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[#6B6560]">
                    {formatBiz(c.business_number)}
                  </td>
                  <td className="px-4 py-3 text-[#2C2C2C]">
                    {contactsMap.get(c.id) ?? (
                      <span className="text-xs text-[#8B7F75]">미지정</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {c.total_contracts}
                    {c.active_contracts > 0 && (
                      <span className="ml-1 text-[11px] text-emerald-700">
                        (진행 {c.active_contracts})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-[#1E3A5F]">
                    {formatWon(c.total_revenue)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.bg} ${meta.border} ${meta.text}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
                        aria-hidden
                      />
                      {meta.emoji} {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6B6560]">
                    {formatDate(c.next_renewal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function KanbanView({
  companies,
  contactsMap,
}: {
  companies: CompanyRow[];
  contactsMap: Map<string, string>;
}) {
  return (
    <section
      aria-label="파이프라인 칸반"
      className="overflow-x-auto pb-2"
    >
      <div className="flex gap-3 min-w-max">
        {PIPELINE_STAGES.map((stage) => {
          const meta = STAGE_META[stage];
          const items = companies.filter((c) => c.status === stage);
          return (
            <div
              key={stage}
              className={`w-72 flex-shrink-0 rounded-2xl border-2 ${meta.border} ${meta.bg}`}
            >
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-black/5">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden />
                  <span className={`text-xs font-bold ${meta.text}`}>
                    {meta.emoji} {meta.label}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center justify-center rounded-full bg-white px-2 py-0.5 text-[10px] font-bold ${meta.text}`}
                >
                  {items.length}
                </span>
              </div>
              <div className="space-y-2 p-2 max-h-[70vh] overflow-y-auto">
                {items.length === 0 ? (
                  <p className="py-4 text-center text-[11px] text-[#8B7F75]">
                    비어있음
                  </p>
                ) : (
                  items.map((c) => (
                    <KanbanCard
                      key={c.id}
                      company={c}
                      contact={contactsMap.get(c.id) ?? null}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function KanbanCard({
  company,
  contact,
}: {
  company: CompanyRow;
  contact: string | null;
}) {
  const otherStages = PIPELINE_STAGES.filter((s) => s !== company.status);

  return (
    <article className="rounded-xl border border-white bg-white p-3 shadow-sm hover:shadow-md transition">
      <Link
        href={`/partner/customers/corporate/${company.id}`}
        className="block font-bold text-[#1E3A5F] hover:underline truncate"
      >
        {company.company_name}
      </Link>
      {company.industry && (
        <p className="mt-0.5 text-[11px] text-[#6B6560] truncate">
          {company.industry}
          {company.employee_count ? ` · ${company.employee_count}명` : ""}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="text-[#6B6560]">
          👤 {contact ?? <span className="text-[#8B7F75]">미지정</span>}
        </span>
        {company.total_contracts > 0 && (
          <span className="font-semibold text-[#2D5A3D]">
            📝 {company.total_contracts}
          </span>
        )}
      </div>

      {company.total_revenue > 0 && (
        <p className="mt-1 text-xs font-bold text-[#1E3A5F]">
          {formatWon(company.total_revenue)}
        </p>
      )}

      {/* Stage 이동 */}
      <div className="mt-2">
        <StageSelect
          companyId={company.id}
          options={otherStages.map((s) => ({
            value: s,
            label: `${STAGE_META[s].emoji} ${STAGE_META[s].label}`,
          }))}
          onChangeAction={async (id: string, stage: string) => {
            "use server";
            await updatePipelineStageAction(id, stage);
          }}
        />
      </div>
    </article>
  );
}
