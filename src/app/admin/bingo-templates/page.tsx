import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guard";
import { loadGlobalTemplates } from "@/lib/bingo/template-queries";
import { createGlobalTemplateAction } from "@/lib/bingo/template-actions";
import { BINGO_SIZES } from "@/lib/bingo/types";

export const dynamic = "force-dynamic";

export default async function BingoTemplatesPage() {
  await requireAdmin();
  const templates = await loadGlobalTemplates();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-[#2D5A3D]">📋 빙고 문구 템플릿</h1>
        <p className="mt-1 text-sm text-[#6B6560]">
          자주 쓰는 문구 세트를 템플릿으로 만들면, 기관 운영자가 빙고 보드에서
          한 번에 불러올 수 있어요. (전역 공용 템플릿)
        </p>
      </header>

      {/* 새 템플릿 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-[#2D5A3D]">➕ 새 템플릿</h2>
        <form action={createGlobalTemplateAction} className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            name="name"
            required
            maxLength={40}
            placeholder="템플릿 이름 (예: 가족 특징 빙고)"
            className="min-w-[220px] flex-1 rounded-lg border-2 border-[#D4E4BC] bg-[#FFFDF8] px-3 py-2 text-sm text-[#2D5A3D] focus:border-emerald-500 focus:outline-none"
          />
          <select
            name="size"
            defaultValue={4}
            className="rounded-lg border-2 border-[#D4E4BC] bg-white px-3 py-2 text-sm font-bold text-[#2D5A3D]"
          >
            {BINGO_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}×{s}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
          >
            만들기
          </button>
        </form>
      </section>

      {/* 목록 */}
      {templates.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFFDF8] px-4 py-10 text-center text-sm text-[#8B7F75]">
          아직 템플릿이 없어요. 위에서 새 템플릿을 만들어 보세요.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const placed = t.tiles.filter((x) => x.fixed_position != null).length;
            return (
              <Link
                key={t.id}
                href={`/admin/bingo-templates/${t.id}`}
                className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm transition hover:border-emerald-400 hover:shadow"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#FAE7D0] px-2 py-0.5 text-[10px] font-bold text-[#6B4423]">
                    {t.size}×{t.size}
                  </span>
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200">
                    문구 {t.tiles.length}
                  </span>
                  {placed > 0 && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                      📌 {placed}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm font-bold text-[#2D5A3D]">{t.name}</p>
                {t.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-[#6B6560]">
                    {t.description}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
