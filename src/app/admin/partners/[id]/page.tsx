import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { loadDocumentStats } from "@/lib/documents/queries";
import { loadTeamMemberStats } from "@/lib/team/event-team-queries";
import { loadPartnerProfileSnapshot } from "@/lib/profile-completeness/queries";
import { calcCompleteness } from "@/lib/profile-completeness/calculator";
import { PARTNER_PROFILE_SCHEMA } from "@/lib/profile-completeness/schemas/partner";
import { CompletenessCard } from "@/components/profile-completeness/CompletenessCard";
import { MissingList } from "@/components/profile-completeness/MissingList";
import { PartnerRowActions } from "../partner-row-actions";
import { AcornIcon } from "@/components/acorn-icon";
import {
  CustomerGroupCard,
  type CustomerItem,
} from "./customer-group-card";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

type PartnerTier = "SPROUT" | "EXPLORER" | "TREE" | "FOREST" | "LEGEND";
type PartnerStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "CLOSED";

type PartnerDetail = {
  id: string;
  name: string;
  username: string;
  business_name: string | null;
  representative_name: string | null;
  business_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  tier: PartnerTier;
  commission_rate: number;
  acorn_balance: number;
  total_sales: number;
  total_events: number;
  avg_rating: number | null;
  status: PartnerStatus;
  created_at: string;
};

const TIER_LABEL: Record<
  PartnerTier,
  { emoji: string; label: string; color: string }
> = {
  SPROUT: { emoji: "🌱", label: "새싹", color: "bg-[#E8F0E4] text-[#2D5A3D]" },
  EXPLORER: {
    emoji: "🌿",
    label: "탐험가",
    color: "bg-[#D4E4BC] text-[#2D5A3D]",
  },
  TREE: { emoji: "🌳", label: "나무", color: "bg-[#A8C686] text-white" },
  FOREST: { emoji: "🏞️", label: "숲", color: "bg-[#2D5A3D] text-white" },
  LEGEND: {
    emoji: "🌟",
    label: "레전드",
    color: "bg-gradient-to-r from-[#B8860B] to-[#FFD700] text-white",
  },
};

const STATUS_LABEL: Record<
  PartnerStatus,
  { dot: string; label: string; text: string }
> = {
  PENDING: { dot: "bg-gray-400", label: "대기중", text: "text-gray-600" },
  ACTIVE: { dot: "bg-green-500", label: "활성", text: "text-green-700" },
  SUSPENDED: {
    dot: "bg-yellow-500",
    label: "정지",
    text: "text-yellow-700",
  },
  CLOSED: { dot: "bg-red-500", label: "폐업", text: "text-red-700" },
};

function fmtNumber(n: number) {
  return n.toLocaleString("ko-KR");
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

/* ------------------------------------------------------------------ */
/* 고객 현황 (기관 · 개인 · 기업)                                       */
/* ------------------------------------------------------------------ */

type OrgCustomer = {
  id: string;
  org_name: string;
  status: string | null;
  auto_username: string | null;
  created_at: string;
};

type IndividualCustomer = {
  id: string;
  parent_name: string;
  parent_phone: string | null;
  status: string | null;
  created_at: string;
};

type CompanyCustomer = {
  id: string;
  company_name: string;
  status: string | null;
  business_number: string | null;
  created_at: string;
};

type CustomerSnapshot = {
  orgs: OrgCustomer[];
  orgsTotal: number;
  individuals: IndividualCustomer[];
  individualsTotal: number;
  /** 개인 고객 전화번호 → app_users.id 매핑 (임퍼소네이트용) */
  individualAppUserByPhone: Map<string, string>;
  companies: CompanyCustomer[];
  companiesTotal: number;
};

const LIST_LIMIT = 100;

async function loadPartnerCustomers(
  partnerId: string
): Promise<CustomerSnapshot> {
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
                limit: (n: number) => Promise<{ data: OrgCustomer[] | null }>;
              };
            };
          };
        }
      )
        .select("id,org_name,status,auto_username,created_at")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT),
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
                ) => Promise<{ data: IndividualCustomer[] | null }>;
              };
            };
          };
        }
      )
        .select("id,parent_name,parent_phone,status,created_at")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT),
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
                ) => Promise<{ data: CompanyCustomer[] | null }>;
              };
            };
          };
        }
      )
        .select("id,company_name,status,business_number,created_at")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT),
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

  const individuals = indResp.data ?? [];
  const phones = individuals
    .map((c) => (c.parent_phone ?? "").replace(/\D/g, ""))
    .filter((p) => p.length > 0);

  // phone → app_user id 매핑 (로그인↗ 버튼용)
  const individualAppUserByPhone = new Map<string, string>();
  if (phones.length > 0) {
    const usersResp = (await (
      supabase.from("app_users" as never) as unknown as {
        select: (c: string) => {
          in: (
            k: string,
            v: string[]
          ) => Promise<{ data: Array<{ id: string; phone: string }> | null }>;
        };
      }
    )
      .select("id,phone")
      .in("phone", phones)) as {
      data: Array<{ id: string; phone: string }> | null;
    };
    for (const u of usersResp.data ?? []) {
      individualAppUserByPhone.set(u.phone, u.id);
    }
  }

  return {
    orgs: orgsResp.data ?? [],
    orgsTotal: orgsCountResp.count ?? 0,
    individuals,
    individualsTotal: indCountResp.count ?? 0,
    individualAppUserByPhone,
    companies: compResp.data ?? [],
    companiesTotal: compCountResp.count ?? 0,
  };
}

async function loadPartnerDetail(id: string): Promise<PartnerDetail | null> {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase.from("partners") as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: PartnerDetail | null }>;
          };
        };
      }
    )
      .select(
        "id,name,username,business_name,representative_name,business_number,phone,email,address,bank_name,account_number,account_holder,tier,commission_rate,acorn_balance,total_sales,total_events,avg_rating,status,created_at"
      )
      .eq("id", id)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

export default async function AdminPartnerDetailPage({ params }: PageProps) {
  const { id } = await params;

  try {
    await requireAdmin();
  } catch {
    return (
      <div className="space-y-4 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center">
        <h1 className="text-xl font-bold text-rose-800">관리자 권한 필요</h1>
        <Link
          href="/admin"
          className="inline-block rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
        >
          관리자 로그인
        </Link>
      </div>
    );
  }

  const partner = await loadPartnerDetail(id);
  if (!partner) notFound();

  const [docStats, teamStats, snap, customers] = await Promise.all([
    loadDocumentStats(id),
    loadTeamMemberStats(id).catch(() => ({
      total: 0,
      active: 0,
      pending: 0,
      suspended: 0,
    })),
    loadPartnerProfileSnapshot(id),
    loadPartnerCustomers(id),
  ]);

  const completeness = calcCompleteness(PARTNER_PROFILE_SCHEMA, snap);

  const tierMeta = TIER_LABEL[partner.tier];
  const statusMeta = STATUS_LABEL[partner.status];
  const displayName = partner.business_name ?? partner.name;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/admin" className="hover:text-[#2D5A3D]">
          관리자
        </Link>
        <span className="mx-2">/</span>
        <Link href="/admin/partners" className="hover:text-[#2D5A3D]">
          숲지기 관리
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">{displayName}</span>
      </nav>

      {/* 헤더 */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tierMeta.color}`}
              >
                {tierMeta.emoji} {tierMeta.label}
              </span>
              <span
                className={`flex items-center gap-1.5 rounded-full border border-white bg-white/70 px-2 py-0.5 text-[11px] font-semibold ${statusMeta.text}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
                {statusMeta.label}
              </span>
              <span className="rounded-full border border-white bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-[#6B6560]">
                🗓 {fmtDate(partner.created_at)} 가입
              </span>
            </div>
            <h1 className="mt-2 truncate text-2xl font-bold text-[#2D5A3D] md:text-3xl">
              🏡 {displayName}
            </h1>
            <p className="mt-0.5 text-xs text-[#6B6560] md:text-sm">
              @{partner.username}
              {partner.phone && ` · 📞 ${partner.phone}`}
              {partner.email && ` · 📧 ${partner.email}`}
            </p>
            {partner.business_number && (
              <p className="mt-0.5 font-mono text-[11px] text-[#6B6560]">
                사업자등록번호 · {partner.business_number}
              </p>
            )}
          </div>
          <Link
            href="/admin/partners"
            className="shrink-0 rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            ← 목록
          </Link>
        </div>

        {/* 빠른 액션 */}
        <div className="mt-4 border-t border-white/70 pt-3">
          <PartnerRowActions
            id={partner.id}
            status={partner.status}
            tier={partner.tier}
            name={partner.name}
          />
        </div>
      </header>

      {/* 완성도 카드 */}
      <CompletenessCard result={completeness} missingAnchor="#missing" />

      {/* 스탯 그리드 */}
      <section>
        <h2 className="mb-2 px-1 text-sm font-semibold text-[#6B6560]">
          📊 운영 스탯
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            icon="💰"
            label="누적 매출"
            value={`${fmtNumber(partner.total_sales ?? 0)}원`}
          />
          <StatCard
            icon={<AcornIcon size={18} />}
            label="도토리 잔액"
            value={fmtNumber(partner.acorn_balance ?? 0)}
          />
          <StatCard
            icon="💼"
            label="수수료율"
            value={`${partner.commission_rate}%`}
          />
          <StatCard
            icon="⭐"
            label="평균 평점"
            value={
              partner.avg_rating != null
                ? partner.avg_rating.toFixed(2)
                : "-"
            }
            sub={`총 ${fmtNumber(partner.total_events ?? 0)}회 행사`}
          />
        </div>
      </section>

      {/* 고객 현황 — 기관 · 개인 · 기업 */}
      <section>
        <h2 className="mb-2 px-1 text-sm font-semibold text-[#6B6560]">
          👥 고객 현황
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <CustomerGroupCard
            title="🏫 기관 고객"
            total={customers.orgsTotal}
            emptyMsg="등록된 기관이 없어요"
            items={customers.orgs.map<CustomerItem>((o) => ({
              id: o.id,
              name: o.org_name,
              sub: o.auto_username ? `@${o.auto_username}` : null,
              status: o.status,
              impersonateHref: `/api/admin/impersonate?role=org&id=${o.id}`,
            }))}
          />

          <CustomerGroupCard
            title="👨‍👩‍👧 개인 고객"
            total={customers.individualsTotal}
            emptyMsg="등록된 개인 고객이 없어요"
            items={customers.individuals.map<CustomerItem>((c) => {
              const phoneKey = (c.parent_phone ?? "").replace(/\D/g, "");
              const appUserId = phoneKey
                ? customers.individualAppUserByPhone.get(phoneKey)
                : undefined;
              return {
                id: c.id,
                name: c.parent_name,
                sub: c.parent_phone,
                status: c.status,
                impersonateHref: appUserId
                  ? `/api/admin/impersonate?role=user&id=${appUserId}`
                  : null,
                disabledReason: appUserId ? undefined : "미가입",
              };
            })}
          />

          <CustomerGroupCard
            title="💼 기업 고객"
            total={customers.companiesTotal}
            emptyMsg="등록된 기업 고객이 없어요"
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

      {/* 서류 요약 + 팀 요약 */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* 서류 요약 */}
        <article className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <header className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
              <span>📄</span>
              <span>서류 현황</span>
            </h3>
            <Link
              href={`/admin/partners/${partner.id}/documents`}
              className="text-xs font-semibold text-[#2D5A3D] hover:underline"
            >
              상세 →
            </Link>
          </header>
          <div className="grid grid-cols-4 gap-2">
            <MiniStat
              label="제출"
              value={`${docStats.submitted}/${docStats.totalRequired}`}
              tone="green"
            />
            <MiniStat
              label="승인"
              value={String(docStats.approved)}
              tone="emerald"
            />
            <MiniStat
              label="검토"
              value={String(docStats.pending)}
              tone="amber"
            />
            <MiniStat
              label="반려"
              value={String(docStats.rejected)}
              tone="rose"
            />
          </div>
          {docStats.pending > 0 && (
            <Link
              href={`/admin/partners/${partner.id}/documents`}
              className="mt-3 block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              ⏳ 검토 대기 {docStats.pending}건 — 지금 검토하기 →
            </Link>
          )}
        </article>

        {/* 팀 요약 */}
        <article className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <header className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
              <span>👥</span>
              <span>팀 현황</span>
            </h3>
            <span className="text-[11px] text-[#8B7F75]">
              전체 {teamStats.total}명
            </span>
          </header>
          <div className="grid grid-cols-3 gap-2">
            <MiniStat
              label="활성"
              value={String(teamStats.active)}
              tone="emerald"
            />
            <MiniStat
              label="대기"
              value={String(teamStats.pending)}
              tone="amber"
            />
            <MiniStat
              label="정지"
              value={String(teamStats.suspended)}
              tone="rose"
            />
          </div>
          {teamStats.total === 0 && (
            <p className="mt-3 rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-3 text-center text-xs text-[#6B6560]">
              아직 등록된 팀원이 없어요
            </p>
          )}
        </article>
      </section>

      {/* 회사/정산 정보 */}
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
            <span>🏡</span>
            <span>회사 정보</span>
          </h3>
          <dl className="space-y-2 text-sm">
            <InfoRow label="상호" value={partner.business_name ?? "-"} />
            <InfoRow
              label="대표자"
              value={partner.representative_name ?? partner.name ?? "-"}
            />
            <InfoRow
              label="사업자번호"
              value={partner.business_number ?? "-"}
              mono
            />
            <InfoRow label="연락처" value={partner.phone ?? "-"} mono />
            <InfoRow label="이메일" value={partner.email ?? "-"} />
            <InfoRow label="주소" value={partner.address ?? "-"} multiline />
          </dl>
        </article>

        <article className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
            <span>🏦</span>
            <span>정산 계좌</span>
          </h3>
          <dl className="space-y-2 text-sm">
            <InfoRow label="은행" value={partner.bank_name ?? "-"} />
            <InfoRow
              label="계좌번호"
              value={partner.account_number ?? "-"}
              mono
            />
            <InfoRow label="예금주" value={partner.account_holder ?? "-"} />
          </dl>
          {(!partner.bank_name ||
            !partner.account_number ||
            !partner.account_holder) && (
            <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
              ⚠️ 정산 계좌 미완료 — 정산 지급이 불가능해요
            </p>
          )}
        </article>
      </section>

      {/* 미완료 리스트 */}
      <MissingList result={completeness} id="missing" />
    </div>
  );
}

/* ---------- 하위 ---------- */

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>
          {icon}
        </span>
        <span className="text-[11px] font-semibold text-[#6B6560]">
          {label}
        </span>
      </div>
      <div className="mt-1 truncate text-xl font-bold text-[#2D5A3D]">
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[10px] text-[#8B7F75]">{sub}</div>}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "emerald" | "amber" | "rose";
}) {
  const bg: Record<typeof tone, string> = {
    green: "border-[#D4E4BC] bg-[#E8F0E4] text-[#2D5A3D]",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
  };
  return (
    <div className={`rounded-xl border px-2 py-2 text-center ${bg[tone]}`}>
      <div className="text-[10px] font-semibold">{label}</div>
      <div className="mt-0.5 text-lg font-bold">{value}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
  multiline,
}: {
  label: string;
  value: string;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div
      className={`flex ${multiline ? "items-start" : "items-center"} justify-between gap-3`}
    >
      <dt className="shrink-0 text-xs text-[#8B7F75]">{label}</dt>
      <dd
        className={`text-right font-semibold text-[#2C2C2C] ${
          mono ? "font-mono text-sm tracking-tight" : "text-sm"
        } ${multiline ? "whitespace-pre-wrap leading-relaxed" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
