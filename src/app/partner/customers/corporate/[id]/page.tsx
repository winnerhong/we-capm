import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { updatePipelineStageAction } from "../actions";
import {
  PIPELINE_STAGES,
  type PipelineStage,
  type ContactRole,
} from "../types";
import { StageSelect } from "../stage-select";

export const dynamic = "force-dynamic";

type CompanyDetail = {
  id: string;
  partner_id: string;
  company_name: string;
  business_number: string | null;
  representative_name: string | null;
  representative_phone: string | null;
  company_email: string | null;
  industry: string | null;
  employee_count: number | null;
  website: string | null;
  total_contracts: number;
  total_revenue: number;
  active_contracts: number;
  next_renewal: string | null;
  interests: string[] | null;
  status: PipelineStage;
  pipeline_stage: string | null;
  tags: string[] | null;
  memo: string | null;
  auto_username: string | null;
  created_at: string;
};

type Contact = {
  id: string;
  company_id: string;
  role: ContactRole | null;
  name: string;
  phone: string | null;
  email: string | null;
  department: string | null;
  is_primary: boolean;
  notes: string | null;
};

const STAGE_META: Record<
  PipelineStage,
  { label: string; emoji: string; bg: string; border: string; text: string }
> = {
  LEAD: { label: "리드", emoji: "🌱", bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700" },
  PROPOSED: { label: "제안 발송", emoji: "📨", bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-800" },
  NEGOTIATING: { label: "협상중", emoji: "🤝", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800" },
  CONTRACTED: { label: "계약 체결", emoji: "📝", bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-800" },
  ACTIVE: { label: "계약중", emoji: "✅", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800" },
  RENEWAL: { label: "갱신 예정", emoji: "🔄", bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-800" },
  CHURNED: { label: "종료", emoji: "📦", bg: "bg-zinc-50", border: "border-zinc-200", text: "text-zinc-600" },
};

const ROLE_META: Record<
  ContactRole,
  { label: string; emoji: string; chip: string }
> = {
  HR: { label: "인사", emoji: "👔", chip: "bg-sky-50 text-sky-800 border-sky-200" },
  ESG: { label: "ESG", emoji: "🌱", chip: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  FINANCE: { label: "재무", emoji: "💰", chip: "bg-amber-50 text-amber-800 border-amber-200" },
  CEO: { label: "대표", emoji: "👑", chip: "bg-violet-50 text-violet-800 border-violet-200" },
  MARKETING: { label: "마케팅", emoji: "📢", chip: "bg-rose-50 text-rose-800 border-rose-200" },
  OTHER: { label: "기타", emoji: "👤", chip: "bg-zinc-50 text-zinc-700 border-zinc-200" },
};

const INTEREST_LABEL: Record<string, { label: string; emoji: string }> = {
  ESG: { label: "ESG", emoji: "🌱" },
  TEAMBUILDING: { label: "팀빌딩", emoji: "🏃" },
  FAMILY_DAY: { label: "가족데이", emoji: "👨‍👩‍👧" },
  SENIOR: { label: "시니어", emoji: "🌸" },
  YOUTH: { label: "청년", emoji: "⚡" },
};

function formatBiz(raw: string | null): string {
  if (!raw) return "-";
  const d = raw.replace(/\D/g, "");
  if (d.length !== 10) return raw;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

function formatPhone(raw: string | null): string {
  if (!raw) return "-";
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
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

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

async function loadCompany(id: string): Promise<CompanyDetail | null> {
  const supabase = await createClient();
  const { data, error } = await (
    supabase.from("partner_companies" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: CompanyDetail | null;
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .select(
      "id,partner_id,company_name,business_number,representative_name,representative_phone,company_email,industry,employee_count,website,total_contracts,total_revenue,active_contracts,next_renewal,interests,status,pipeline_stage,tags,memo,auto_username,created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[corporate/detail] load error", error);
    return null;
  }
  return data;
}

async function loadContacts(companyId: string): Promise<Contact[]> {
  const supabase = await createClient();
  const { data, error } = await (
    supabase.from("partner_company_contacts" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (k: string, o: { ascending: boolean }) => {
            order: (k: string, o: { ascending: boolean }) => Promise<{
              data: Contact[] | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .select("id,company_id,role,name,phone,email,department,is_primary,notes")
    .eq("company_id", companyId)
    .order("is_primary", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    console.error("[corporate/detail] contacts error", error);
    return [];
  }
  return data ?? [];
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const partner = await requirePartner();
  const { id } = await params;

  const company = await loadCompany(id);
  if (!company || company.partner_id !== partner.id) notFound();

  const contacts = await loadContacts(id);
  const stageMeta = STAGE_META[company.status] ?? STAGE_META.LEAD;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link
          href="/partner/customers/corporate"
          className="hover:text-[#1E3A5F]"
        >
          기업 고객
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#1E3A5F]">{company.company_name}</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#1E3A5F]/20 bg-gradient-to-br from-[#E8F0E4] via-white to-[#DEE7F1] p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <span className="text-3xl" aria-hidden>
              🏢
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-[#1E3A5F] md:text-2xl">
                  {company.company_name}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${stageMeta.bg} ${stageMeta.border} ${stageMeta.text}`}
                >
                  {stageMeta.emoji} {stageMeta.label}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
                {company.industry ?? "업종 미지정"}
                {company.employee_count ? ` · 직원 ${company.employee_count}명` : ""}
                {company.website && (
                  <>
                    {" · "}
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#1E3A5F] hover:underline"
                    >
                      🔗 홈페이지
                    </a>
                  </>
                )}
              </p>
              {/* 단계 변경 */}
              <div className="mt-3 max-w-xs">
                <StageSelect
                  companyId={company.id}
                  options={PIPELINE_STAGES.filter(
                    (s) => s !== company.status
                  ).map((s) => ({
                    value: s,
                    label: `${STAGE_META[s].emoji} ${STAGE_META[s].label}`,
                  }))}
                  onChangeAction={async (cid: string, stage: string) => {
                    "use server";
                    await updatePipelineStageAction(cid, stage);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/partner/customers/corporate/${company.id}/contacts`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#1E3A5F]/30 bg-white px-3 py-2 text-xs font-semibold text-[#1E3A5F] hover:bg-[#DEE7F1]"
            >
              👥 담당자 관리 ({contacts.length})
            </Link>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white/50 px-3 py-2 text-xs font-semibold text-[#8B7F75] cursor-not-allowed"
              title="준비 중"
            >
              💼 제안서
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white/50 px-3 py-2 text-xs font-semibold text-[#8B7F75] cursor-not-allowed"
              title="준비 중"
            >
              ✏️ 편집
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#1E3A5F]/50 to-[#2D5A3D]/50 px-3 py-2 text-xs font-bold text-white cursor-not-allowed"
              title="준비 중"
            >
              🤝 새 계약
            </button>
          </div>
        </div>
      </header>

      {/* KPI */}
      <section aria-label="거래 요약" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-[#1E3A5F]/20 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-[#6B6560]">총 계약수</p>
          <p className="mt-1 text-2xl font-extrabold text-[#1E3A5F]">
            {company.total_contracts}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[11px] font-semibold text-emerald-700">진행중</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-900">
            {company.active_contracts}
          </p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-[11px] font-semibold text-indigo-700">총 매출</p>
          <p className="mt-1 text-xl font-extrabold text-indigo-900">
            {formatWon(company.total_revenue)}
          </p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <p className="text-[11px] font-semibold text-violet-700">갱신 예정</p>
          <p className="mt-1 text-xl font-extrabold text-violet-900">
            {formatDate(company.next_renewal)}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 좌측: 정보 + 타임라인 */}
        <div className="space-y-6 lg:col-span-2">
          {/* 회사 정보 */}
          <section className="rounded-2xl border border-[#1E3A5F]/20 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1E3A5F]">
              <span aria-hidden>📋</span>
              <span>회사 & 사업자 정보</span>
            </h2>
            <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <InfoRow label="회사명" value={company.company_name} />
              <InfoRow
                label="사업자등록번호"
                value={formatBiz(company.business_number)}
                mono
              />
              <InfoRow
                label="대표자"
                value={company.representative_name ?? "-"}
              />
              <InfoRow
                label="대표자 연락처"
                value={formatPhone(company.representative_phone)}
              />
              <InfoRow label="업종" value={company.industry ?? "-"} />
              <InfoRow
                label="직원수"
                value={
                  company.employee_count
                    ? `${company.employee_count.toLocaleString("ko-KR")}명`
                    : "-"
                }
              />
              <InfoRow label="이메일" value={company.company_email ?? "-"} />
              <InfoRow
                label="홈페이지"
                value={
                  company.website ? (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#1E3A5F] hover:underline"
                    >
                      {company.website}
                    </a>
                  ) : (
                    "-"
                  )
                }
              />
            </dl>

            {company.interests && company.interests.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-[#1E3A5F]">
                  관심 분야
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {company.interests.map((i) => {
                    const meta = INTEREST_LABEL[i] ?? { label: i, emoji: "🎯" };
                    return (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full border border-[#1E3A5F]/20 bg-[#DEE7F1] px-2.5 py-0.5 text-[11px] font-semibold text-[#1E3A5F]"
                      >
                        <span aria-hidden>{meta.emoji}</span>
                        {meta.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* 거래 이력 / 계약 타임라인 */}
          <section className="rounded-2xl border border-[#1E3A5F]/20 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1E3A5F]">
              <span aria-hidden>📅</span>
              <span>거래 이력 (계약 타임라인)</span>
            </h2>

            <ol className="relative border-l-2 border-[#1E3A5F]/20 pl-4">
              <TimelineItem
                emoji="🌱"
                title="리드 등록"
                subtitle={formatDateTime(company.created_at)}
                color="border-slate-300 bg-white"
                active
              />
              {company.total_contracts === 0 ? (
                <li className="relative py-3">
                  <span className="absolute -left-[25px] top-3 flex h-5 w-5 items-center justify-center rounded-full border-2 border-dashed border-[#D4E4BC] bg-white text-[10px]">
                    ⏳
                  </span>
                  <p className="text-xs text-[#8B7F75]">
                    아직 체결된 계약이 없습니다. 제안서를 발송하고 협상 단계로
                    이동해 보세요.
                  </p>
                </li>
              ) : (
                <li className="relative py-3">
                  <span className="absolute -left-[25px] top-3 flex h-5 w-5 items-center justify-center rounded-full border-2 border-emerald-400 bg-white text-[10px]">
                    📝
                  </span>
                  <p className="text-sm font-semibold text-[#1E3A5F]">
                    {company.total_contracts}건의 계약이 등록되어 있어요
                  </p>
                  <p className="text-[11px] text-[#6B6560]">
                    (상세 계약 목록 모듈 준비 중)
                  </p>
                </li>
              )}
            </ol>
          </section>

          {/* 계약 목록 */}
          <section className="rounded-2xl border border-[#1E3A5F]/20 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1E3A5F]">
              <span aria-hidden>📝</span>
              <span>계약 목록</span>
            </h2>
            <div className="rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-6 text-center">
              <p className="text-sm font-semibold text-[#6B6560]">
                진행중 {company.active_contracts}건 · 완료{" "}
                {Math.max(0, company.total_contracts - company.active_contracts)}건
              </p>
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                계약 생성/조회 모듈은 현재 준비 중입니다.
              </p>
            </div>
          </section>

          {/* ESG 리포트 */}
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-800">
              <span aria-hidden>🌱</span>
              <span>ESG 리포트</span>
            </h2>
            <p className="text-xs text-emerald-900">
              기업이 진행한 ESG 프로그램에 대한 리포트를 PDF로 제공할 수 있어요.
            </p>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white/70 px-3 py-1.5 text-xs font-semibold text-emerald-800 cursor-not-allowed"
              title="계약 체결 후 이용 가능"
            >
              📄 ESG 리포트 다운로드
            </button>
          </section>

          {/* 메모 */}
          <section className="rounded-2xl border border-[#1E3A5F]/20 bg-white p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#1E3A5F]">
              <span aria-hidden>📝</span>
              <span>내부 메모</span>
            </h2>
            {company.memo ? (
              <p className="whitespace-pre-wrap rounded-xl bg-[#FFF8F0] p-3 text-sm text-[#2C2C2C]">
                {company.memo}
              </p>
            ) : (
              <p className="text-xs text-[#8B7F75]">
                기록된 메모가 없습니다.
              </p>
            )}
          </section>
        </div>

        {/* 우측: 담당자 요약 */}
        <aside className="space-y-6">
          <section className="rounded-2xl border border-[#1E3A5F]/20 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-[#1E3A5F]">
                <span aria-hidden>👥</span>
                <span>담당자</span>
              </h2>
              <Link
                href={`/partner/customers/corporate/${company.id}/contacts`}
                className="text-[11px] font-semibold text-[#1E3A5F] hover:underline"
              >
                전체 관리 →
              </Link>
            </div>
            {contacts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-4 text-center">
                <p className="text-xs text-[#6B6560]">
                  등록된 담당자가 없어요
                </p>
                <Link
                  href={`/partner/customers/corporate/${company.id}/contacts`}
                  className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[#1E3A5F] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#152b47]"
                >
                  + 담당자 추가
                </Link>
              </div>
            ) : (
              <ul className="space-y-2">
                {contacts.slice(0, 4).map((c) => {
                  const meta = c.role
                    ? ROLE_META[c.role] ?? ROLE_META.OTHER
                    : ROLE_META.OTHER;
                  return (
                    <li
                      key={c.id}
                      className="rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#1E3A5F] truncate">
                          {c.name}
                        </span>
                        {c.is_primary && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-[#1E3A5F] px-2 py-0.5 text-[10px] font-bold text-white">
                            ⭐ 주담당
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span
                          className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.chip}`}
                        >
                          {meta.emoji} {meta.label}
                        </span>
                        {c.department && (
                          <span className="text-[10px] text-[#6B6560]">
                            · {c.department}
                          </span>
                        )}
                      </div>
                      {(c.phone || c.email) && (
                        <div className="mt-1 text-[11px] text-[#6B6560]">
                          {c.phone && <div>📞 {formatPhone(c.phone)}</div>}
                          {c.email && (
                            <div className="truncate">✉️ {c.email}</div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
                {contacts.length > 4 && (
                  <li className="text-center text-[11px] text-[#8B7F75]">
                    외 {contacts.length - 4}명 더 있어요
                  </li>
                )}
              </ul>
            )}
          </section>

          {/* Auto account */}
          {company.auto_username && (
            <section className="rounded-2xl border border-[#1E3A5F]/20 bg-[#F5F1E8] p-5 shadow-sm">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#1E3A5F]">
                <span aria-hidden>🔑</span>
                <span>자동 생성 계정</span>
              </h2>
              <p className="text-[11px] text-[#6B6560]">기업 담당자 접속 ID</p>
              <code className="mt-1 block rounded-lg bg-white px-3 py-2 font-mono text-xs text-[#1E3A5F] break-all">
                {company.auto_username}
              </code>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] font-semibold text-[#6B6560]">{label}</dt>
      <dd
        className={`mt-0.5 text-sm text-[#2C2C2C] ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function TimelineItem({
  emoji,
  title,
  subtitle,
  color,
  active,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  color: string;
  active?: boolean;
}) {
  return (
    <li className="relative py-3">
      <span
        className={`absolute -left-[25px] top-3 flex h-5 w-5 items-center justify-center rounded-full border-2 text-[10px] ${color} ${
          active ? "ring-2 ring-[#1E3A5F]/30" : ""
        }`}
      >
        {emoji}
      </span>
      <p className="text-sm font-semibold text-[#1E3A5F]">{title}</p>
      <p className="text-[11px] text-[#6B6560]">{subtitle}</p>
    </li>
  );
}
