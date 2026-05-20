// 타임테이블 템플릿 신규 등록 / 편집 — ?edit=<id> 가 있으면 편집 모드.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartner } from "@/lib/auth-guard";
import { loadTimetableTemplateById } from "@/lib/timetable-templates/queries";
import { TemplateForm } from "./template-form";

export const dynamic = "force-dynamic";

export default async function NewTimetableTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const partner = await requirePartner();
  const sp = await searchParams;
  const editId = sp?.edit;
  const existing = editId ? await loadTimetableTemplateById(editId) : null;
  if (editId && !existing) notFound();
  if (existing && existing.partner_id !== partner.id) notFound();
  const isEdit = Boolean(existing);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link
          href="/partner/timetable-templates"
          className="hover:text-[#2D5A3D]"
        >
          타임테이블 템플릿
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">
          {isEdit ? "템플릿 편집" : "새 템플릿"}
        </span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            📋
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D]">
              {isEdit ? "타임테이블 템플릿 편집" : "새 타임테이블 템플릿"}
            </h1>
            <p className="mt-1 text-xs text-[#6B6560]">
              슬롯의 종류·소요시간·순서를 정해 두면, 기관이 행사 타임테이블에서
              이 템플릿을 그대로 불러올 수 있어요. 시작 시각은 행사마다 자동
              계산됩니다.
            </p>
          </div>
        </div>
      </header>

      <TemplateForm
        initial={
          existing
            ? {
                id: existing.id,
                name: existing.name,
                description: existing.description ?? "",
                slots: existing.slots.map((s) => ({
                  id: s.id,
                  slot_kind: s.slot_kind,
                  title: s.title,
                  description: s.description,
                  location: s.location,
                  icon_emoji: s.icon_emoji,
                  duration_min: s.duration_min,
                })),
              }
            : null
        }
      />
    </div>
  );
}
