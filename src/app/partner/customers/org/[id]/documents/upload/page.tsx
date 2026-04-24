import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartnerWithRole } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { DocFileUploader } from "@/components/doc-file-uploader";
import {
  ORG_DOC_META,
  ORG_DOC_TYPE_KEYS,
  type OrgDocType,
} from "@/lib/org-documents/types";
import { uploadOnBehalfAction } from "../actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
};

type OrgRow = {
  id: string;
  partner_id: string | null;
  org_name: string;
};

async function loadOrg(id: string): Promise<OrgRow | null> {
  const supabase = await createClient();
  const { data } = await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: OrgRow | null }>;
        };
      };
    }
  )
    .select("id,partner_id,org_name")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

export default async function PartnerUploadOnBehalfPage({
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
          대행 업로드는 <b>OWNER</b> 또는 <b>FINANCE</b> 역할만 이용할 수
          있어요.
        </p>
      </div>
    );
  }

  const typeRaw = sp.type ?? "";
  if (!ORG_DOC_TYPE_KEYS.includes(typeRaw as OrgDocType)) {
    notFound();
  }
  const docType = typeRaw as OrgDocType;
  const meta = ORG_DOC_META[docType];

  const org = await loadOrg(orgId);
  if (!org) notFound();
  if (!org.partner_id || org.partner_id !== session.id) {
    return (
      <div className="space-y-4 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center">
        <h1 className="text-xl font-bold text-rose-800">접근 불가</h1>
        <p className="text-sm text-rose-700">
          이 기관에 서류를 업로드할 권한이 없어요.
        </p>
      </div>
    );
  }

  const action = uploadOnBehalfAction.bind(null, orgId);

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
        <Link
          href={`/partner/customers/org/${orgId}/documents`}
          className="hover:text-[#2D5A3D]"
        >
          서류
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">대행 업로드</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-[#E8F0E4] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            {meta.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
                {meta.label} 대행 업로드
              </h1>
              <span className="rounded-md border border-sky-300 bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">
                🏡 지사 대행
              </span>
            </div>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              {org.org_name} · {meta.desc}
            </p>
          </div>
          {meta.required && (
            <span className="shrink-0 rounded-md bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-700">
              필수
            </span>
          )}
        </div>
      </header>

      {/* 안내 박스 */}
      <aside className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-900 md:text-sm">
        <p className="font-semibold">💡 대행 업로드 안내</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>기관 대신 지사 담당자가 업로드하는 기능이에요</li>
          <li>
            업로드 기록에 <b>🏡 지사 대행</b> 배지가 표시돼요
          </li>
          <li>
            허용 형식: <b>PDF · JPG · PNG · WebP</b> · 최대 <b>5MB</b>
          </li>
          <li>업로드 후 상태는 <b>검토중</b>으로 저장돼요 (직접 승인 별도)</li>
          {meta.hasExpiry && (
            <li className="text-amber-700">
              ⏰ 이 서류는 유효기간이 있어요. 만료일을 입력해 주세요
            </li>
          )}
        </ul>
      </aside>

      {/* 폼 */}
      <form
        action={action}
        className="space-y-5 rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6"
      >
        <input type="hidden" name="doc_type" value={docType} />

        <div>
          <label className="mb-2 block text-sm font-semibold text-[#2D5A3D]">
            파일 첨부 <span className="text-rose-500">*</span>
          </label>
          <DocFileUploader
            partnerId={`orgs/${orgId}`}
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
            placeholder="대행 사유나 특이사항 (예: 기관 담당자 요청으로 지사가 대리 업로드)"
            className="w-full resize-none rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-[#D4E4BC] pt-4 sm:flex-row sm:items-center sm:justify-end">
          <Link
            href={`/partner/customers/org/${orgId}/documents`}
            className="inline-flex items-center justify-center rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm font-semibold text-[#6B6560] hover:bg-[#F0EBE3]"
          >
            취소
          </Link>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-sky-700 hover:to-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
          >
            🏡 대행 업로드
          </button>
        </div>
      </form>
    </div>
  );
}
