import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartnerWithRole } from "@/lib/auth-guard";
import { DocFileUploader } from "@/components/doc-file-uploader";
import {
  DOC_TYPE_META,
  DOC_TYPE_KEYS,
  type DocType,
} from "@/lib/documents/types";
import { submitDocumentAction } from "../actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ type?: string }>;
};

export default async function UploadDocumentPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const typeRaw = sp.type ?? "";
  if (!DOC_TYPE_KEYS.includes(typeRaw as DocType)) {
    notFound();
  }
  const docType = typeRaw as DocType;
  const meta = DOC_TYPE_META[docType];

  let session;
  try {
    session = await requirePartnerWithRole(["OWNER", "FINANCE"]);
  } catch {
    return (
      <div className="space-y-4 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center">
        <h1 className="text-xl font-bold text-rose-800">접근 권한 없음</h1>
        <p className="text-sm text-rose-700">
          서류 제출은 <b>OWNER</b> 또는 <b>FINANCE</b> 역할만 이용할 수 있어요.
        </p>
        <Link
          href="/partner/settings/documents"
          className="inline-block rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
        >
          서류 목록으로
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
        <Link href="/partner/settings/documents" className="hover:text-[#2D5A3D]">
          서류 제출
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">{meta.label} 업로드</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            {meta.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              {meta.label} 업로드
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">{meta.desc}</p>
          </div>
          {meta.required && (
            <span className="shrink-0 rounded-md bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-700">
              필수
            </span>
          )}
        </div>
      </header>

      {/* 안내 박스 */}
      <aside className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-4 text-xs text-[#6B6560] md:text-sm">
        <p className="font-semibold text-[#2D5A3D]">💡 업로드 안내</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>허용 형식: <b>PDF · JPG · PNG · WebP</b></li>
          <li>최대 <b>5MB</b> (이미지는 자동 500KB 이하로 압축돼요)</li>
          <li>제출 후 <b>1~2 영업일 내</b> 관리자가 검토해요</li>
          <li>반려될 경우 사유와 함께 다시 업로드 요청이 올 수 있어요</li>
          {meta.hasExpiry && (
            <li className="text-amber-700">
              ⏰ 이 서류는 <b>유효기간</b>이 있어요. 만료 30일 전에 알려드려요
            </li>
          )}
        </ul>
      </aside>

      {/* 폼 */}
      <form
        action={submitDocumentAction}
        className="space-y-5 rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6"
      >
        <input type="hidden" name="doc_type" value={docType} />

        <div>
          <label className="mb-2 block text-sm font-semibold text-[#2D5A3D]">
            파일 첨부 <span className="text-rose-500">*</span>
          </label>
          <DocFileUploader
            partnerId={session.id}
            docType={docType}
            maxMb={5}
          />
        </div>

        {meta.hasExpiry && (
          <div>
            <label
              htmlFor="expires_at"
              className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
            >
              유효기간 만료일 <span className="text-rose-500">*</span>
            </label>
            <input
              id="expires_at"
              name="expires_at"
              type="date"
              required
              min={new Date().toISOString().split("T")[0]}
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30 md:max-w-xs"
            />
            <p className="mt-1 text-[11px] text-[#8B7F75]">
              서류 원본에 기재된 만료일을 입력해 주세요
            </p>
          </div>
        )}

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
            placeholder="관리자에게 전달할 특이사항이 있으면 적어 주세요 (선택)"
            className="w-full resize-none rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-[#D4E4BC] pt-4 sm:flex-row sm:items-center sm:justify-end">
          <Link
            href="/partner/settings/documents"
            className="inline-flex items-center justify-center rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm font-semibold text-[#6B6560] hover:bg-[#F0EBE3]"
          >
            취소
          </Link>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40"
          >
            📤 제출하기
          </button>
        </div>
      </form>
    </div>
  );
}
