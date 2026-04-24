import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { loadOrgDocumentStats } from "@/lib/org-documents/queries";
import { loadOrgProfileSnapshot } from "@/lib/profile-completeness/queries";
import { calcCompleteness } from "@/lib/profile-completeness/calculator";
import { buildOrgProfileSchema } from "@/lib/profile-completeness/schemas/org";
import { CompletenessCard } from "@/components/profile-completeness/CompletenessCard";
import { MissingList } from "@/components/profile-completeness/MissingList";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

type OrgStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "CLOSED";
type OrgType =
  | "DAYCARE"
  | "KINDERGARTEN"
  | "ELEMENTARY"
  | "MIDDLE"
  | "HIGH"
  | "EDUCATION_OFFICE"
  | "OTHER";

type OrgDetail = {
  id: string;
  partner_id: string;
  org_name: string;
  org_type: OrgType | null;
  representative_name: string | null;
  representative_phone: string | null;
  email: string | null;
  address: string | null;
  business_number: string | null;
  tax_email: string | null;
  children_count: number | null;
  class_count: number | null;
  teacher_count: number | null;
  commission_rate: number | null;
  discount_rate: number | null;
  contract_start: string | null;
  contract_end: string | null;
  internal_memo: string | null;
  status: OrgStatus;
  created_at: string;
};

const TYPE_LABEL: Record<OrgType, string> = {
  DAYCARE: "어린이집",
  KINDERGARTEN: "유치원",
  ELEMENTARY: "초등학교",
  MIDDLE: "중학교",
  HIGH: "고등학교",
  EDUCATION_OFFICE: "교육청",
  OTHER: "기타",
};

const STATUS_LABEL: Record<
  OrgStatus,
  { dot: string; label: string; text: string }
> = {
  ACTIVE: { dot: "bg-green-500", label: "활성", text: "text-green-700" },
  INACTIVE: { dot: "bg-gray-400", label: "비활성", text: "text-gray-600" },
  SUSPENDED: {
    dot: "bg-yellow-500",
    label: "정지",
    text: "text-yellow-700",
  },
  CLOSED: { dot: "bg-red-500", label: "종료", text: "text-red-700" },
};

function fmtDate(iso: string | null) {
  if (!iso) return "-";
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

function fmtNumber(n: number) {
  return n.toLocaleString("ko-KR");
}

async function loadOrgDetail(id: string): Promise<OrgDetail | null> {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase.from("partner_orgs" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: OrgDetail | null }>;
          };
        };
      }
    )
      .select(
        "id,partner_id,org_name,org_type,representative_name,representative_phone,email,address,business_number,tax_email,children_count,class_count,teacher_count,commission_rate,discount_rate,contract_start,contract_end,internal_memo,status,created_at"
      )
      .eq("id", id)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

async function loadPartnerName(
  partnerId: string
): Promise<{ name: string; businessName: string | null } | null> {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase.from("partners" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: { name: string; business_name: string | null } | null;
            }>;
          };
        };
      }
    )
      .select("name,business_name")
      .eq("id", partnerId)
      .maybeSingle();
    if (!data) return null;
    return { name: data.name, businessName: data.business_name };
  } catch {
    return null;
  }
}

export default async function AdminOrgDetailPage({ params }: PageProps) {
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

  const org = await loadOrgDetail(id);
  if (!org) notFound();

  const [partnerInfo, docStats, snap] = await Promise.all([
    loadPartnerName(org.partner_id),
    loadOrgDocumentStats(id),
    loadOrgProfileSnapshot(id),
  ]);

  const schema = buildOrgProfileSchema(id);
  const completeness = calcCompleteness(schema, snap);

  const statusMeta = STATUS_LABEL[org.status];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/admin" className="hover:text-[#2D5A3D]">
          관리자
        </Link>
        <span className="mx-2">/</span>
        <Link href="/admin/orgs" className="hover:text-[#2D5A3D]">
          기관 관리
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">{org.org_name}</span>
      </nav>

      {/* 헤더 */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {org.org_type && (
                <span className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[11px] font-semibold text-[#2D5A3D]">
                  {TYPE_LABEL[org.org_type]}
                </span>
              )}
              <span
                className={`flex items-center gap-1.5 rounded-full border border-white bg-white/70 px-2 py-0.5 text-[11px] font-semibold ${statusMeta.text}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`}
                />
                {statusMeta.label}
              </span>
              <span className="rounded-full border border-white bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-[#6B6560]">
                🗓 {fmtDate(org.created_at)} 등록
              </span>
            </div>
            <h1 className="mt-2 truncate text-2xl font-bold text-[#2D5A3D] md:text-3xl">
              🏫 {org.org_name}
            </h1>
            <p className="mt-0.5 text-xs text-[#6B6560] md:text-sm">
              {org.representative_name && `담당: ${org.representative_name}`}
              {org.representative_phone && ` · 📞 ${org.representative_phone}`}
              {org.email && ` · 📧 ${org.email}`}
            </p>
            {org.business_number && (
              <p className="mt-0.5 font-mono text-[11px] text-[#6B6560]">
                사업자등록번호 · {org.business_number}
              </p>
            )}
            {partnerInfo && (
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                소속 지사:{" "}
                <Link
                  href={`/admin/partners/${org.partner_id}`}
                  className="font-semibold text-[#2D5A3D] hover:underline"
                >
                  🏡 {partnerInfo.businessName ?? partnerInfo.name}
                </Link>
              </p>
            )}
          </div>
          <Link
            href="/admin/orgs"
            className="shrink-0 rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            ← 목록
          </Link>
        </div>
      </header>

      {/* 완성도 카드 */}
      <CompletenessCard result={completeness} missingAnchor="#missing" />

      {/* 아동 스탯 */}
      <section>
        <h2 className="mb-2 px-1 text-sm font-semibold text-[#6B6560]">
          👶 운영 규모
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            icon="👶"
            label="아동 수"
            value={
              org.children_count != null
                ? `${fmtNumber(org.children_count)}명`
                : "-"
            }
          />
          <StatCard
            icon="🏫"
            label="학급/반"
            value={
              org.class_count != null ? `${fmtNumber(org.class_count)}개` : "-"
            }
          />
          <StatCard
            icon="👩‍🏫"
            label="교사"
            value={
              org.teacher_count != null
                ? `${fmtNumber(org.teacher_count)}명`
                : "-"
            }
          />
          <StatCard
            icon="💰"
            label="할인율"
            value={
              org.discount_rate != null ? `${org.discount_rate}%` : "-"
            }
            sub={
              org.commission_rate != null
                ? `기본 수수료 ${org.commission_rate}%`
                : undefined
            }
          />
        </div>
      </section>

      {/* 서류 요약 + 계약 */}
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <header className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
              <span>📄</span>
              <span>서류 현황</span>
            </h3>
            <span className="text-[11px] text-[#8B7F75]">
              필수 {docStats.totalRequired}종 중 {docStats.approved}승인
            </span>
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
          {docStats.missingRequired.length > 0 && (
            <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] font-semibold text-rose-800">
              ⚠️ 필수 서류 {docStats.missingRequired.length}종 누락
            </p>
          )}
        </article>

        <article className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
            <span>📝</span>
            <span>계약 정보</span>
          </h3>
          <dl className="space-y-2 text-sm">
            <InfoRow
              label="계약 시작"
              value={fmtDate(org.contract_start)}
            />
            <InfoRow label="계약 종료" value={fmtDate(org.contract_end)} />
            <InfoRow
              label="기본 수수료"
              value={
                org.commission_rate != null ? `${org.commission_rate}%` : "-"
              }
            />
            <InfoRow
              label="기관 할인"
              value={
                org.discount_rate != null ? `${org.discount_rate}%` : "-"
              }
            />
            <InfoRow label="세금계산서 이메일" value={org.tax_email ?? "-"} />
          </dl>
        </article>
      </section>

      {/* 기관 정보 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
          <span>🏫</span>
          <span>기관 정보</span>
        </h3>
        <dl className="grid gap-2 text-sm md:grid-cols-2">
          <InfoRow label="기관명" value={org.org_name} />
          <InfoRow
            label="유형"
            value={org.org_type ? TYPE_LABEL[org.org_type] : "-"}
          />
          <InfoRow
            label="대표/담당자"
            value={org.representative_name ?? "-"}
          />
          <InfoRow
            label="연락처"
            value={org.representative_phone ?? "-"}
            mono
          />
          <InfoRow
            label="사업자등록번호"
            value={org.business_number ?? "-"}
            mono
          />
          <InfoRow label="이메일" value={org.email ?? "-"} />
          <InfoRow
            label="주소"
            value={org.address ?? "-"}
            multiline
            colSpan
          />
        </dl>
      </section>

      {/* 내부 메모 */}
      {org.internal_memo && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-amber-900">📝 지사 내부 메모</h3>
          <p className="mt-1 whitespace-pre-wrap text-xs text-amber-900">
            {org.internal_memo}
          </p>
        </section>
      )}

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
  icon: string;
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
  colSpan,
}: {
  label: string;
  value: string;
  mono?: boolean;
  multiline?: boolean;
  colSpan?: boolean;
}) {
  return (
    <div
      className={`flex ${multiline ? "items-start" : "items-center"} justify-between gap-3 ${colSpan ? "md:col-span-2" : ""}`}
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
