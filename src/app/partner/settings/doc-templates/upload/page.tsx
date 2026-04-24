import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartnerWithRole } from "@/lib/auth-guard";
import { DocFileUploader } from "@/components/doc-file-uploader";
import { ORG_DOC_META, type OrgDocType } from "@/lib/org-documents/types";
import { uploadCustomTemplateAction } from "../actions";

export const dynamic = "force-dynamic";

const TEMPLATED_TYPES = [
  "TAX_CONTRACT",
  "FACILITY_CONSENT",
  "PRIVACY_CONSENT",
] as const satisfies readonly OrgDocType[];

type TemplatedType = (typeof TEMPLATED_TYPES)[number];

type PageProps = {
  searchParams: Promise<{ type?: string }>;
};

export default async function UploadCustomTemplatePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const typeRaw = sp.type ?? "";
  if (!(TEMPLATED_TYPES as readonly string[]).includes(typeRaw)) {
    notFound();
  }
  const docType = typeRaw as TemplatedType;
  const meta = ORG_DOC_META[docType];

  let session;
  try {
    session = await requirePartnerWithRole(["OWNER"]);
  } catch {
    return (
      <div className="space-y-4 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center">
        <h1 className="text-xl font-bold text-rose-800">접근 권한 없음</h1>
        <p className="text-sm text-rose-700">
          서류 템플릿 업로드는 <b>OWNER</b> 역할만 이용할 수 있어요.
        </p>
        <Link
          href="/partner/settings/doc-templates"
          className="inline-block rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
        >
          템플릿 목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/settings" className="hover:text-[#2D5A3D]">
          설정
        </Link>
        <span className="mx-2">/</span>
        <Link
          href="/partner/settings/doc-templates"
          className="hover:text-[#2D5A3D]"
        >
          서류 템플릿
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">
          {meta.label} 업로드
        </span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            {meta.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              {meta.label} 커스텀 템플릿 업로드
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              지사 자체 양식 PDF를 업로드하면 기관 다운로드 시 이 파일이
              제공됩니다.
            </p>
          </div>
        </div>
      </header>

      {/* 안내 박스 */}
      <aside className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-4 text-xs text-[#6B6560] md:text-sm">
        <p className="font-semibold text-[#2D5A3D]">💡 업로드 안내</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            허용 형식: <b>PDF · JPG · PNG · WebP</b> · 최대 <b>5MB</b>
          </li>
          <li>
            지사 로고·연락처·특화 조항이 반영된 <b>최종본 PDF</b>를 권장해요
          </li>
          <li>이미 업로드된 템플릿이 있다면 덮어쓰기(재업로드) 됩니다</li>
          <li>업로드 즉시 기관 다운로드에 적용되니 최종본을 업로드해 주세요</li>
        </ul>
      </aside>

      {/* 폼 */}
      <form
        action={uploadCustomTemplateAction}
        className="space-y-5 rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6"
      >
        <input type="hidden" name="doc_type" value={docType} />

        <div>
          <label className="mb-2 block text-sm font-semibold text-[#2D5A3D]">
            템플릿 파일 <span className="text-rose-500">*</span>
          </label>
          <DocFileUploader
            partnerId={`templates/${session.id}`}
            docType={docType}
            maxMb={5}
          />
          <p className="mt-2 text-[11px] text-[#8B7F75]">
            저장 경로: <span className="font-mono">partner-documents/templates/{session.id}/{docType}/…</span>
          </p>
        </div>

        <div>
          <label
            htmlFor="notes"
            className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
          >
            메모 (선택)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={500}
            placeholder="이 템플릿 버전에 대한 내부 메모 (예: 2026년 1분기 개정판)"
            className="w-full resize-none rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-[#D4E4BC] pt-4 sm:flex-row sm:items-center sm:justify-end">
          <Link
            href="/partner/settings/doc-templates"
            className="inline-flex items-center justify-center rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm font-semibold text-[#6B6560] hover:bg-[#F0EBE3]"
          >
            취소
          </Link>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40"
          >
            📤 템플릿 등록
          </button>
        </div>
      </form>
    </div>
  );
}
