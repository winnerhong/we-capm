import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guard";
import { loadTemplateById } from "@/lib/bingo/template-queries";
import {
  updateTemplateMetaAction,
  deleteTemplateAction,
} from "@/lib/bingo/template-actions";
import { TemplateTilesEditor } from "./template-tiles-editor";

export const dynamic = "force-dynamic";

export default async function BingoTemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();
  const tpl = await loadTemplateById(id);
  if (!tpl || tpl.scope !== "GLOBAL") notFound();

  async function saveMeta(formData: FormData) {
    "use server";
    await updateTemplateMetaAction(
      id,
      String(formData.get("name") ?? ""),
      String(formData.get("description") ?? "")
    );
  }

  async function remove() {
    "use server";
    await deleteTemplateAction(id);
    redirect("/admin/bingo-templates");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <nav className="text-xs text-[#8B7F75]">
        <Link href="/admin/bingo-templates" className="hover:text-[#2D5A3D]">
          📋 빙고 템플릿
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">{tpl.name}</span>
      </nav>

      {/* 메타 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#FAE7D0] px-2 py-0.5 text-[10px] font-bold text-[#6B4423]">
            {tpl.size}×{tpl.size}
          </span>
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200">
            전역 공용
          </span>
        </div>
        <form action={saveMeta} className="mt-3 space-y-2">
          <input
            type="text"
            name="name"
            required
            maxLength={40}
            defaultValue={tpl.name}
            className="w-full rounded-lg border-2 border-[#D4E4BC] bg-[#FFFDF8] px-3 py-2 text-sm font-bold text-[#2D5A3D] focus:border-emerald-500 focus:outline-none"
          />
          <input
            type="text"
            name="description"
            maxLength={120}
            defaultValue={tpl.description ?? ""}
            placeholder="설명 (선택)"
            className="w-full rounded-lg border-2 border-[#D4E4BC] bg-[#FFFDF8] px-3 py-2 text-sm text-[#2D5A3D] focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-bold text-[#2D5A3D] hover:bg-[#F5F1E8]"
          >
            💾 이름·설명 저장
          </button>
        </form>
      </section>

      {/* 타일 편집 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-[#2D5A3D]">
          문구 + 칸 배치
        </h2>
        <TemplateTilesEditor
          templateId={tpl.id}
          size={tpl.size}
          tiles={tpl.tiles}
        />
      </section>

      {/* 삭제 */}
      <section className="rounded-2xl border-2 border-rose-200 bg-rose-50/60 p-5 shadow-sm">
        <h2 className="text-sm font-bold text-rose-800">⚠️ 템플릿 삭제</h2>
        <p className="mt-1 text-xs text-rose-700/80">
          삭제해도 이미 보드에 적용된 문구는 남아있어요.
        </p>
        <form action={remove} className="mt-3">
          <button
            type="submit"
            className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100"
          >
            🗑 이 템플릿 삭제
          </button>
        </form>
      </section>
    </div>
  );
}
