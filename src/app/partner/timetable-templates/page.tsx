// 지사 타임테이블 기본 템플릿 — 목록 + 새 템플릿 진입점.

import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { loadTimetableTemplates } from "@/lib/timetable-templates/queries";
import { fmtDuration } from "@/components/timetable/slot-form";
import { TemplateRowActions } from "./template-row-actions";

export const dynamic = "force-dynamic";

export default async function PartnerTimetableTemplatesPage() {
  const partner = await requirePartner();
  const templates = await loadTimetableTemplates(partner.id, {
    includeArchived: true,
  });

  const active = templates.filter((t) => !t.is_archived);
  const archived = templates.filter((t) => t.is_archived);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">타임테이블 템플릿</span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="text-3xl" aria-hidden>
              📋
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#2D5A3D]">
                타임테이블 템플릿
              </h1>
              <p className="mt-1 text-xs text-[#6B6560]">
                자주 쓰는 행사 진행표를 미리 만들어 두면, 기관이 행사 타임테이블
                편집기에서 한 번 클릭으로 슬롯 전체를 불러올 수 있어요.
              </p>
            </div>
          </div>
          <Link
            href="/partner/timetable-templates/new"
            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2 text-xs font-bold text-white shadow-md hover:from-[#234a30]"
          >
            🌱 새 템플릿
          </Link>
        </div>
      </header>

      {active.length === 0 ? (
        <section className="rounded-3xl border-2 border-dashed border-[#D4E4BC] bg-white/70 px-6 py-10 text-center">
          <p className="text-3xl" aria-hidden>
            📋
          </p>
          <p className="mt-2 text-sm font-bold text-[#2D5A3D]">
            아직 만든 템플릿이 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            자주 진행하는 행사 진행표를 템플릿으로 만들어 두세요
          </p>
        </section>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {active.map((t) => {
            const totalMin = t.slots.reduce((s, x) => s + x.duration_min, 0);
            return (
              <li
                key={t.id}
                className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm"
              >
                <h3 className="truncate text-sm font-bold text-[#2D5A3D]">
                  {t.name}
                </h3>
                {t.description && (
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-[#6B6560]">
                    {t.description}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[#8B7F75]">
                  <span className="rounded-full bg-[#E8F0E4] px-2 py-0.5 font-semibold text-[#2D5A3D]">
                    슬롯 {t.slots.length}개
                  </span>
                  <span>누적 {fmtDuration(totalMin)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Link
                    href={`/partner/timetable-templates/new?edit=${t.id}`}
                    className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-1 text-[10px] font-bold text-[#2D5A3D] hover:bg-[#F5F1E8]"
                  >
                    ✏ 수정
                  </Link>
                  <TemplateRowActions
                    id={t.id}
                    label={t.name}
                    archived={false}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {archived.length > 0 && (
        <details className="rounded-2xl border border-[#E5D3B8] bg-[#FFF8F0] p-3">
          <summary className="cursor-pointer text-xs font-bold text-[#8B6F47]">
            📦 보관함 ({archived.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {archived.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[12px]"
              >
                <span className="flex-1 truncate text-[#6B6560]">
                  {t.name}
                  <span className="ml-1 text-[10px] text-[#8B7F75]">
                    · 슬롯 {t.slots.length}개
                  </span>
                </span>
                <TemplateRowActions id={t.id} label={t.name} archived={true} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
