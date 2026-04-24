import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  ORG_PROGRAM_STATUS_META,
  CATEGORY_META,
  type OrgProgramRow,
  type OrgProgramStatus,
} from "@/lib/org-programs/types";
import { ImageUploader } from "@/components/image-uploader";
import { updateOrgProgramAction } from "../../../actions";
import { DangerActions } from "./danger-actions";

async function updateFormAdapter(id: string, formData: FormData): Promise<void> {
  "use server";
  await updateOrgProgramAction(id, formData);
}

const CATEGORY_KEYS = ["FOREST", "CAMPING", "KIDS", "FAMILY", "TEAM", "ART"] as const;

export default async function EditOrgProgramPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string }>;
}) {
  const { orgId, id } = await params;
  const org = await requireOrg();

  const supabase = await createClient();
  const { data } = await (supabase.from("org_programs" as never) as any)
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  const program = data as OrgProgramRow | null;
  if (!program) notFound();

  const statusMeta =
    ORG_PROGRAM_STATUS_META[program.status as OrgProgramStatus] ??
    ORG_PROGRAM_STATUS_META.ACTIVATED;

  const updateWithId = updateFormAdapter.bind(null, program.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="mb-4 flex flex-wrap items-center gap-1 text-xs text-[#6B6560]"
      >
        <Link href={`/org/${orgId}/templates`} className="hover:text-[#2D5A3D]">
          📋 템플릿
        </Link>
        <span aria-hidden>›</span>
        <Link href={`/org/${orgId}/programs`} className="hover:text-[#2D5A3D]">
          🗂️ 내 프로그램
        </Link>
        <span aria-hidden>›</span>
        <span className="font-semibold text-[#2D5A3D]">편집</span>
      </nav>

      {/* Header */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[#2D5A3D] sm:text-3xl">
            ✏️ 프로그램 편집
          </h1>
          <p className="mt-1 text-sm text-[#6B6560]">
            기관에 맞게 자유롭게 수정하고 공개하세요
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.color}`}
          >
            {statusMeta.icon} {statusMeta.label}
          </span>
          <DangerActions
            programId={program.id}
            isPublished={program.is_published}
          />
        </div>
      </header>

      {/* Form */}
      <form action={updateWithId} className="space-y-5">
        {/* Section 1: Basic */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-[#2D5A3D]">
            🌿 기본 정보
          </h2>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="title"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                제목 <span className="text-rose-600">*</span>
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                defaultValue={program.title}
                autoComplete="off"
                className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                설명
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                defaultValue={program.description ?? ""}
                className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
              />
            </div>

            <div>
              <label
                htmlFor="category"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                카테고리
              </label>
              <select
                id="category"
                name="category"
                defaultValue={program.category}
                className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
              >
                {CATEGORY_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {CATEGORY_META[k].icon} {CATEGORY_META[k].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="duration_hours"
                  className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
                >
                  소요 시간 (시간)
                </label>
                <input
                  id="duration_hours"
                  name="duration_hours"
                  type="number"
                  step="0.5"
                  min="0"
                  inputMode="decimal"
                  defaultValue={program.duration_hours ?? ""}
                  className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
                />
              </div>
              <div>
                <label
                  htmlFor="capacity_min"
                  className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
                >
                  최소 정원
                </label>
                <input
                  id="capacity_min"
                  name="capacity_min"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  defaultValue={program.capacity_min}
                  className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
                />
              </div>
              <div>
                <label
                  htmlFor="capacity_max"
                  className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
                >
                  최대 정원
                </label>
                <input
                  id="capacity_max"
                  name="capacity_max"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  defaultValue={program.capacity_max}
                  className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Price & Location */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-[#2D5A3D]">
            💰 가격 & 위치
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="price_per_person"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                1인당 가격 (원)
              </label>
              <input
                id="price_per_person"
                name="price_per_person"
                type="number"
                min="0"
                step="100"
                inputMode="numeric"
                defaultValue={program.price_per_person}
                className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
              />
            </div>
            <div>
              <label
                htmlFor="location_detail"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                세부 장소
              </label>
              <input
                id="location_detail"
                name="location_detail"
                type="text"
                defaultValue={program.location_detail ?? ""}
                autoComplete="off"
                placeholder="예: 본관 2층 숲체험실"
                className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
              />
            </div>
          </div>
        </section>

        {/* Section 3: Image */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-[#2D5A3D]">
            🖼️ 이미지
          </h2>
          <ImageUploader
            name="image_url"
            defaultValue={program.image_url ?? ""}
            folder="org-programs"
            maxKb={500}
            label="대표 이미지"
          />
        </section>

        {/* Section 4: Customizing */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-[#2D5A3D]">
            🎨 커스터마이징
          </h2>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="custom_notes"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                내부 메모
              </label>
              <textarea
                id="custom_notes"
                name="custom_notes"
                rows={3}
                defaultValue={program.custom_notes ?? ""}
                placeholder="직원 공유용 메모 (참가자에게는 보이지 않아요)"
                className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
              />
            </div>
            <div className="rounded-xl border border-dashed border-[#C4956A] bg-[#FFF8F0] p-3 text-xs text-[#8B6B3F]">
              🎨 테마 커스터마이징은 곧 제공돼요
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={`/org/${orgId}/programs`}
            className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-center text-sm font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8]"
          >
            취소
          </Link>
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#4A7C59] px-6 py-3 text-sm font-bold text-white shadow-sm hover:opacity-90"
          >
            💾 저장
          </button>
        </div>
      </form>

      {/* Source tracking */}
      {program.source_program_id && (
        <p className="mt-6 text-center text-[11px] text-[#8B7F75]">
          📋 원본 템플릿 id: {program.source_program_id}
        </p>
      )}
    </div>
  );
}
