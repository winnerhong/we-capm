import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartnerWithRole } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { loadTemplateData } from "@/lib/org-documents/template-data";
import { loadPartnerCustomTemplate } from "@/lib/org-documents/custom-template";
import { signedDocUrl } from "@/lib/documents/signed-url";
import { ORG_DOC_META, type OrgDocType } from "@/lib/org-documents/types";
import { PrintShell } from "@/lib/org-documents/templates/print-shell";
import { TaxContractTemplate } from "@/lib/org-documents/templates/tax-contract";
import { FacilityConsentTemplate } from "@/lib/org-documents/templates/facility-consent";
import { PrivacyConsentTemplate } from "@/lib/org-documents/templates/privacy-consent";
import { JsonTemplateRenderer } from "@/lib/org-documents/templates/json-renderer";
import { isTemplatedDocType } from "@/lib/org-documents/template-json-schema";

export const dynamic = "force-dynamic";

const TEMPLATED_TYPES = [
  "TAX_CONTRACT",
  "FACILITY_CONSENT",
  "PRIVACY_CONSENT",
] as const satisfies readonly OrgDocType[];

type TemplatedType = (typeof TEMPLATED_TYPES)[number];

type PageProps = {
  params: Promise<{ id: string; doc_type: string }>;
};

type OrgOwnerRow = { id: string; partner_id: string | null };

async function loadOrgOwner(id: string): Promise<OrgOwnerRow | null> {
  const supabase = await createClient();
  const { data } = await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: OrgOwnerRow | null }>;
        };
      };
    }
  )
    .select("id,partner_id")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

function fmtSize(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default async function PartnerOrgDocumentTemplatePage({
  params,
}: PageProps) {
  const { id: orgId, doc_type } = await params;

  let session;
  try {
    session = await requirePartnerWithRole(["OWNER", "FINANCE"]);
  } catch {
    return (
      <div className="space-y-4 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center">
        <h1 className="text-xl font-bold text-rose-800">접근 권한 없음</h1>
        <p className="text-sm text-rose-700">
          서류 템플릿 조회는 <b>OWNER</b> 또는 <b>FINANCE</b> 역할만 이용할 수
          있어요.
        </p>
        <Link
          href={`/partner/customers/org/${orgId}/documents`}
          className="inline-block rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
        >
          서류 관리로 돌아가기
        </Link>
      </div>
    );
  }

  const owner = await loadOrgOwner(orgId);
  if (!owner) notFound();
  if (!owner.partner_id || owner.partner_id !== session.id) notFound();

  if (!(TEMPLATED_TYPES as readonly string[]).includes(doc_type)) {
    notFound();
  }
  const docType = doc_type as TemplatedType;
  const meta = ORG_DOC_META[docType];
  const uploadHref = `/partner/customers/org/${orgId}/documents/upload?type=${docType}`;

  // 지사 자기 커스텀 템플릿 조회
  const custom = await loadPartnerCustomTemplate(session.id, docType);

  // SECTIONS 모드: 섹션 편집본을 JSON 렌더러로 출력
  if (custom?.format === "SECTIONS" && custom.sections && isTemplatedDocType(docType)) {
    const data = await loadTemplateData(orgId);
    if (!data) notFound();
    return (
      <PrintShell title={meta.label} uploadHref={uploadHref}>
        <JsonTemplateRenderer
          docType={docType}
          tmpl={custom.sections}
          data={data}
        />
      </PrintShell>
    );
  }

  if (custom?.format === "FILE" && custom.file_url) {
    const url = await signedDocUrl(custom.file_url, 3600);
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-5 md:p-8">
        <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
          <Link
            href={`/partner/customers/org/${orgId}`}
            className="hover:text-[#2D5A3D]"
          >
            기관 상세
          </Link>
          <span className="mx-2">/</span>
          <Link
            href={`/partner/customers/org/${orgId}/documents`}
            className="hover:text-[#2D5A3D]"
          >
            서류
          </Link>
          <span className="mx-2">/</span>
          <span className="font-semibold text-[#2D5A3D]">
            {meta.label} 템플릿
          </span>
        </nav>

        <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              {meta.icon}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
                {meta.label} 템플릿
              </h1>
              <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
                지사에 등록된 <b>커스텀 양식</b>입니다.
              </p>
            </div>
            <Link
              href="/partner/settings/doc-templates"
              className="shrink-0 rounded-lg border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              ⚙️ 템플릿 관리
            </Link>
          </div>
        </header>

        <section className="rounded-3xl border border-[#D4E4BC] bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] text-4xl">
              📄
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[#2D5A3D]">
                {custom.file_name ?? `${meta.label}-template.pdf`}
              </p>
              <p className="mt-0.5 text-xs text-[#6B6560]">
                {fmtSize(custom.file_size)}
                {custom.version > 1 && (
                  <span className="ml-1 rounded bg-[#E8F0E4] px-1 text-[10px] font-semibold text-[#2D5A3D]">
                    v{custom.version}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-[#8B7F75]">
                {new Date(custom.uploaded_at).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                })}{" "}
                게시
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            {url ? (
              <a
                href={url}
                download={custom.file_name ?? `${docType}.pdf`}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2D5A3D] px-5 py-3 text-sm font-bold text-white shadow hover:bg-[#3A7A52]"
              >
                📥 다운로드
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex cursor-not-allowed items-center justify-center gap-1.5 rounded-xl bg-zinc-300 px-5 py-3 text-sm font-bold text-white"
              >
                다운로드 URL 생성 실패
              </button>
            )}
            <Link
              href={uploadHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#2D5A3D] bg-white px-5 py-3 text-sm font-bold text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              📤 날인 후 업로드 바로가기
            </Link>
          </div>
        </section>
      </div>
    );
  }

  // 커스텀 없으면 기존 HTML 템플릿
  const data = await loadTemplateData(orgId);
  if (!data) notFound();

  return (
    <PrintShell title={meta.label} uploadHref={uploadHref}>
      {docType === "TAX_CONTRACT" && <TaxContractTemplate data={data} />}
      {docType === "FACILITY_CONSENT" && (
        <FacilityConsentTemplate data={data} />
      )}
      {docType === "PRIVACY_CONSENT" && <PrivacyConsentTemplate data={data} />}
    </PrintShell>
  );
}
