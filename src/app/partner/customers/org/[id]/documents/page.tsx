import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartnerWithRole } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  loadLatestOrgDocuments,
  loadOrgDocumentStats,
  loadExpiringOrgDocuments,
} from "@/lib/org-documents/queries";
import {
  ORG_DOC_META,
  ORG_DOC_STATUS_META,
  ORG_DOC_TYPE_KEYS,
  UPLOADER_META,
  type OrgDocPhase,
  type OrgDocType,
  type OrgDocumentRow,
} from "@/lib/org-documents/types";
import { OrgDocReviewActions } from "./[docId]/review-actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ docs?: string }>;
};

type OrgSummaryRow = {
  id: string;
  partner_id: string | null;
  org_name: string;
  business_number: string | null;
  tax_email: string | null;
  representative_name: string | null;
};

const PHASE_META: Record<
  OrgDocPhase,
  { label: string; sub: string; emoji: string; accent: string }
> = {
  TAX: {
    label: "세금계산서용 · 필수",
    sub: "사업자·통장·계약서 (세금계산서 발행 필수)",
    emoji: "🔴",
    accent: "border-rose-200",
  },
  OPERATION: {
    label: "운영 서류 · 필수",
    sub: "시설 이용·개인정보 동의",
    emoji: "🟠",
    accent: "border-orange-200",
  },
  OPTIONAL: {
    label: "선택 서류",
    sub: "기관이 보유한 경우에만",
    emoji: "🟢",
    accent: "border-emerald-200",
  },
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
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

function daysUntil(iso: string | null | undefined) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
}

async function loadOrg(id: string): Promise<OrgSummaryRow | null> {
  const supabase = await createClient();
  const { data } = await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: OrgSummaryRow | null }>;
        };
      };
    }
  )
    .select("id,partner_id,org_name,business_number,tax_email,representative_name")
    .eq("id", id)
    .maybeSingle();

  return data ?? null;
}

export default async function PartnerOrgDocumentsPage({
  params,
  searchParams,
}: PageProps) {
  const { id: orgId } = await params;
  const sp = await searchParams;

  let session;
  try {
    session = await requirePartnerWithRole(["OWNER", "FINANCE"]);
  } catch {
    return (
      <div className="space-y-4 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center">
        <h1 className="text-xl font-bold text-rose-800">접근 권한 없음</h1>
        <p className="text-sm text-rose-700">
          기관 서류 관리는 <b>OWNER</b> 또는 <b>FINANCE</b> 역할만 이용할 수
          있어요.
        </p>
        <Link
          href={`/partner/customers/org/${orgId}`}
          className="inline-block rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
        >
          기관 상세로 돌아가기
        </Link>
      </div>
    );
  }

  const org = await loadOrg(orgId);
  if (!org) notFound();
  if (!org.partner_id || org.partner_id !== session.id) {
    return (
      <div className="space-y-4 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center">
        <h1 className="text-xl font-bold text-rose-800">접근 불가</h1>
        <p className="text-sm text-rose-700">
          이 기관의 서류를 관리할 권한이 없어요.
        </p>
        <Link
          href="/partner/customers/org"
          className="inline-block rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
        >
          기관 목록으로
        </Link>
      </div>
    );
  }

  const [latestMap, stats, expiring] = await Promise.all([
    loadLatestOrgDocuments(orgId),
    loadOrgDocumentStats(orgId),
    loadExpiringOrgDocuments(orgId),
  ]);

  const byPhase: Record<OrgDocPhase, OrgDocType[]> = {
    TAX: [],
    OPERATION: [],
    OPTIONAL: [],
  };
  for (const k of ORG_DOC_TYPE_KEYS) {
    byPhase[ORG_DOC_META[k].phase].push(k);
  }

  const justUploaded = sp.docs === "uploaded";
  const totalTypes = ORG_DOC_TYPE_KEYS.length;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/customers/org" className="hover:text-[#2D5A3D]">
          기관 고객
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/partner/customers/org/${orgId}`}
          className="hover:text-[#2D5A3D]"
        >
          {org.org_name}
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">서류 관리</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-sky-50 p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              📄
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
                {org.org_name} 서류 관리
              </h1>
              <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
                기관이 직접 올린 서류 승인/반려, 필요 시 대행 업로드도 가능해요
              </p>
            </div>
          </div>
        </div>

        {/* 기관 요약 */}
        <div className="mt-4 grid grid-cols-1 gap-2 text-xs md:grid-cols-3">
          <InfoChip label="담당자" value={org.representative_name ?? "-"} />
          <InfoChip label="사업자번호" value={org.business_number ?? "-"} />
          <InfoChip label="세금계산서 이메일" value={org.tax_email ?? "-"} />
        </div>
      </header>

      {/* 대행 업로드 완료 토스트 */}
      {justUploaded && (
        <div
          role="status"
          className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800"
        >
          🏡 대행 업로드가 완료됐어요. <b>검토중</b> 상태로 저장됐으며, 승인 시
          기관에도 표시돼요.
        </div>
      )}

      {/* 누락 경고 */}
      {stats.missingRequired.length > 0 && (
        <aside
          role="alert"
          className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl" aria-hidden>
              🚨
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-rose-900">
                필수 서류 {stats.missingRequired.length}건 누락
              </h2>
              <ul className="mt-2 space-y-1 text-xs text-rose-800">
                {stats.missingRequired.map((t) => {
                  const meta = ORG_DOC_META[t];
                  return (
                    <li
                      key={t}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <span aria-hidden>{meta.icon}</span>
                      <span className="font-semibold">{meta.label}</span>
                      <Link
                        href={`/partner/customers/org/${orgId}/documents/upload?type=${t}`}
                        className="ml-auto rounded-md border border-sky-400 bg-white px-2 py-0.5 text-[11px] font-semibold text-sky-800 hover:bg-sky-100"
                      >
                        🏡 대행 업로드
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </aside>
      )}

      {/* 만료 임박 */}
      {expiring.length > 0 && (
        <aside className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-2xl" aria-hidden>
              ⏰
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-amber-900">
                만료 임박 서류 {expiring.length}건
              </h2>
              <ul className="mt-2 space-y-1 text-xs text-amber-800">
                {expiring.map((d) => {
                  const days = daysUntil(d.expires_at);
                  const meta = ORG_DOC_META[d.doc_type];
                  return (
                    <li
                      key={d.id}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <span>{meta.icon}</span>
                      <span className="font-semibold">{meta.label}</span>
                      <span className="text-amber-700">
                        — {fmtDate(d.expires_at)}
                        {typeof days === "number" && (
                          <>
                            {" "}
                            ({days < 0 ? `만료 ${-days}일 경과` : `D-${days}`})
                          </>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </aside>
      )}

      {/* 통계 4카드 */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="제출"
          value={`${stats.submitted}/${totalTypes}`}
          emoji="📦"
          tone="green"
        />
        <StatCard
          label="승인"
          value={String(stats.approved)}
          emoji="✅"
          tone="emerald"
        />
        <StatCard
          label="검토중"
          value={String(stats.pending)}
          emoji="⏳"
          tone="amber"
        />
        <StatCard
          label="반려"
          value={String(stats.rejected)}
          emoji="❌"
          tone="rose"
        />
      </section>

      {/* 3개 섹션 */}
      {(["TAX", "OPERATION", "OPTIONAL"] as OrgDocPhase[]).map((phase) => {
        const meta = PHASE_META[phase];
        const types = byPhase[phase];
        return (
          <section
            key={phase}
            className={`rounded-3xl border-2 bg-white p-4 shadow-sm md:p-6 ${meta.accent}`}
          >
            <header className="mb-4 flex items-center gap-2">
              <span className="text-lg" aria-hidden>
                {meta.emoji}
              </span>
              <div>
                <h2 className="text-base font-bold text-[#2D5A3D] md:text-lg">
                  {meta.label}
                </h2>
                <p className="text-xs text-[#6B6560]">{meta.sub}</p>
              </div>
            </header>

            <div className="grid gap-3 md:grid-cols-2">
              {types.map((t) => (
                <PartnerDocCard
                  key={t}
                  type={t}
                  row={latestMap.get(t) ?? null}
                  orgId={orgId}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ---------- 하위 컴포넌트 ---------- */

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-2">
      <p className="text-[10px] font-semibold text-[#8B7F75]">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-[#2D5A3D]">
        {value}
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  emoji,
  tone,
}: {
  label: string;
  value: string;
  emoji: string;
  tone: "green" | "emerald" | "amber" | "rose";
}) {
  const toneMap: Record<string, string> = {
    green: "border-[#D4E4BC] bg-[#E8F0E4]",
    emerald: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    rose: "border-rose-200 bg-rose-50",
  };
  const textMap: Record<string, string> = {
    green: "text-[#2D5A3D]",
    emerald: "text-emerald-800",
    amber: "text-amber-800",
    rose: "text-rose-800",
  };
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${toneMap[tone]}`}
      role="group"
      aria-label={label}
    >
      <div className="flex items-center gap-2 text-xs font-semibold">
        <span aria-hidden>{emoji}</span>
        <span className={textMap[tone]}>{label}</span>
      </div>
      <div className={`mt-1 text-2xl font-bold md:text-3xl ${textMap[tone]}`}>
        {value}
      </div>
    </div>
  );
}

function PartnerDocCard({
  type,
  row,
  orgId,
}: {
  type: OrgDocType;
  row: OrgDocumentRow | null;
  orgId: string;
}) {
  const meta = ORG_DOC_META[type];

  // 미제출 — 대행 업로드 버튼
  if (!row) {
    return (
      <article className="flex flex-col justify-between rounded-2xl border-2 border-dashed border-[#D4E4BC] bg-[#FFF8F0]/50 p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden>
              {meta.icon}
            </span>
            <h3 className="text-sm font-bold text-[#2D5A3D]">{meta.label}</h3>
            {meta.required ? (
              <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                필수
              </span>
            ) : (
              <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                선택
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#6B6560]">{meta.desc}</p>
          <p className="mt-2 text-[11px] text-[#8B7F75]">
            기관이 아직 제출하지 않았어요
          </p>
          {meta.hasTemplate && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-[#E8F0E4] px-2 py-0.5 text-[11px] font-semibold text-[#2D5A3D]">
              💡 지사·기관 정보가 미리 채워져 있어요
            </p>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {meta.hasTemplate && (
            <Link
              href={`/partner/customers/org/${orgId}/documents/template/${type}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#2D5A3D] bg-white px-3 py-2 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              📥 템플릿
            </Link>
          )}
          <Link
            href={`/partner/customers/org/${orgId}/documents/upload?type=${type}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
          >
            🏡 대행 업로드
          </Link>
        </div>
      </article>
    );
  }

  const status = row.status;
  const statusMeta = ORG_DOC_STATUS_META[status];
  const uploaderMeta = UPLOADER_META[row.uploaded_by];
  const expDays = daysUntil(row.expires_at);

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl" aria-hidden>
              {meta.icon}
            </span>
            <h3 className="truncate text-sm font-bold text-[#2D5A3D]">
              {meta.label}
            </h3>
            {meta.required && (
              <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                필수
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-[#8B7F75]">
            {row.file_name ?? "파일"}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${statusMeta.color}`}
        >
          {statusMeta.icon} {statusMeta.label}
        </span>
      </header>

      {/* 업로더 배지 */}
      <div>
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${uploaderMeta.chip}`}
        >
          {uploaderMeta.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] text-[#6B6560]">
        <div>
          <dt className="text-[10px] text-[#8B7F75]">제출</dt>
          <dd>{fmtDate(row.submitted_at)}</dd>
        </div>
        {row.expires_at && (
          <div>
            <dt className="text-[10px] text-[#8B7F75]">만료</dt>
            <dd
              className={
                typeof expDays === "number" && expDays <= 30
                  ? "font-semibold text-amber-700"
                  : ""
              }
            >
              {fmtDate(row.expires_at)}
              {typeof expDays === "number" && expDays >= 0 && (
                <span className="ml-1 text-[10px]">(D-{expDays})</span>
              )}
            </dd>
          </div>
        )}
        {row.version > 1 && (
          <div>
            <dt className="text-[10px] text-[#8B7F75]">버전</dt>
            <dd>v{row.version}</dd>
          </div>
        )}
      </div>

      {/* 반려 사유 */}
      {status === "REJECTED" && row.reject_reason && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
          <p className="font-semibold">❌ 반려 사유</p>
          <p className="mt-1 whitespace-pre-wrap">{row.reject_reason}</p>
        </div>
      )}

      {/* PENDING → 승인/반려 인라인 */}
      {status === "PENDING" && (
        <OrgDocReviewActions orgId={orgId} documentId={row.id} compact />
      )}

      {/* 버튼 */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/partner/customers/org/${orgId}/documents/${row.id}`}
          className="rounded-lg border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
        >
          🔍 상세
        </Link>
        {meta.hasTemplate &&
          (status === "REJECTED" || status === "EXPIRED") && (
            <Link
              href={`/partner/customers/org/${orgId}/documents/template/${type}`}
              className="rounded-lg border border-[#2D5A3D] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              📥 템플릿
            </Link>
          )}
        {(status === "REJECTED" ||
          status === "APPROVED" ||
          status === "EXPIRED") && (
          <Link
            href={`/partner/customers/org/${orgId}/documents/upload?type=${type}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              status === "EXPIRED"
                ? "bg-amber-600 text-white hover:bg-amber-700"
                : "border border-sky-500 bg-white text-sky-700 hover:bg-sky-50"
            }`}
          >
            {status === "EXPIRED" ? "🔄 갱신 대행" : "🏡 대행 재업로드"}
          </Link>
        )}
      </div>
    </article>
  );
}
