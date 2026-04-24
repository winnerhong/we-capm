import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartnerWithRole } from "@/lib/auth-guard";
import { loadPartnerCustomTemplate } from "@/lib/org-documents/custom-template";
import { getBaseTemplate } from "@/lib/org-documents/templates/base";
import {
  isTemplatedDocType,
  type TemplateJson,
} from "@/lib/org-documents/template-json-schema";
import { ORG_DOC_META } from "@/lib/org-documents/types";
import type { TemplateData } from "@/lib/org-documents/template-data";
import { TemplateSectionEditor } from "./editor";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ type: string }>;
};

// 미리보기용 더미 데이터 (기관 정보가 없을 때) — 지사 본인 데이터는 session에서 주입
function buildPreviewData(partner: {
  id: string;
  name: string;
  username: string;
}): TemplateData {
  const now = new Date();
  const today = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
  return {
    partner: {
      business_name: partner.name || partner.username || "_______________",
      business_number: "_______________",
      representative_name: partner.name || "_______________",
      address: "_______________",
      phone: "_______________",
    },
    org: {
      org_name: "(미리보기: 기관명)",
      business_number: "_______________",
      representative_name: "_______________",
      representative_phone: "_______________",
      address: "_______________",
    },
    today,
  };
}

export default async function EditTemplatePage({ params }: PageProps) {
  const { type } = await params;

  if (!isTemplatedDocType(type)) notFound();

  let partner;
  try {
    partner = await requirePartnerWithRole(["OWNER"]);
  } catch {
    return (
      <div className="space-y-4 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center">
        <h1 className="text-xl font-bold text-rose-800">OWNER 권한 필요</h1>
        <Link
          href="/partner/settings/doc-templates"
          className="inline-block rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
        >
          템플릿 목록
        </Link>
      </div>
    );
  }

  const meta = ORG_DOC_META[type];
  const existing = await loadPartnerCustomTemplate(partner.id, type);

  // 초기값: 저장된 SECTIONS 있으면 그걸, 없으면 기본 템플릿
  const initial: TemplateJson =
    existing?.format === "SECTIONS" && existing.sections
      ? existing.sections
      : getBaseTemplate(type);

  const hasSavedSections =
    existing?.format === "SECTIONS" && !!existing.sections;
  const hasFileMode = existing?.format === "FILE";

  const previewData = buildPreviewData(partner);

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
        <span className="font-semibold text-[#2D5A3D]">{meta.label} 편집</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              ✏️
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
                {meta.icon} {meta.label} 편집
              </h1>
              <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
                기본 양식을 불러와 자유롭게 수정하세요. 저장하면 기관이
                다운로드 시 편집한 버전이 사용돼요.
              </p>
            </div>
          </div>
          <Link
            href="/partner/settings/doc-templates"
            className="shrink-0 rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            ← 목록
          </Link>
        </div>

        {/* 상태 뱃지 */}
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          {hasSavedSections && (
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 font-semibold text-violet-800">
              ✏️ 저장된 편집본 있음
            </span>
          )}
          {hasFileMode && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-800">
              ⚠️ 현재 파일 업로드본 사용 중 — 저장 시 섹션 편집본으로 전환돼요
            </span>
          )}
          {!hasSavedSections && !hasFileMode && (
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 font-semibold text-sky-800">
              🌲 토리로 기본 양식으로 시작
            </span>
          )}
        </div>
      </header>

      {/* 에디터 */}
      <TemplateSectionEditor
        docType={type}
        initial={initial}
        previewData={previewData}
        hasSavedSections={hasSavedSections}
      />
    </div>
  );
}
