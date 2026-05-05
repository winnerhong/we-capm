import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePartner } from "@/lib/auth-guard";
import { hasFeature } from "@/lib/features/guard";
import { FeatureGate } from "@/components/features/feature-gate";
import { CoverImageField } from "@/components/cover-image-field";
import { createTemplateAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewTemplatePage() {
  const partner = await requirePartner();
  const enabled = await hasFeature(partner.id, "EVENT_TEMPLATE");
  if (!enabled) {
    return (
      <FeatureGate featureCode="EVENT_TEMPLATE" featureName="행사 템플릿" />
    );
  }

  async function action(formData: FormData) {
    "use server";
    const res = await createTemplateAction(formData);
    if (!res.ok) throw new Error(res.message);
    redirect(`/partner/event-templates/${res.data!.id}/edit`);
  }

  return (
    <div className="space-y-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/event-templates" className="hover:text-[#2D5A3D]">
          행사 템플릿
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">새 행사 템플릿</span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <h1 className="flex items-center gap-2 text-xl font-bold text-[#2D5A3D] md:text-2xl">
          <span aria-hidden>📦</span>
          <span>새 행사 템플릿</span>
        </h1>
        <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
          기본 정보를 입력한 뒤, 다음 단계에서 프로그램·숲길 등 항목을
          추가하세요.
        </p>
      </header>

      <form
        action={action}
        className="space-y-5 rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-7"
      >
        <Field label="이름" hint="예: 26년 봄 가족 미션트레킹">
          <input
            name="name"
            required
            maxLength={80}
            placeholder="템플릿 이름"
            className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
          />
        </Field>

        <Field label="부제 (선택)">
          <input
            name="subtitle"
            maxLength={200}
            placeholder="한 줄 소개"
            className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
          />
        </Field>

        <Field label="대표 이미지 (선택)">
          <CoverImageField
            name="cover_image_url"
            pathPrefix="event-templates"
            hint="클릭·드래그·붙여넣기(Ctrl+V) 모두 가능 · 500KB 자동 압축"
            compact
          />
        </Field>

        <Field label="설명 (선택)">
          <textarea
            name="description"
            rows={4}
            maxLength={4000}
            placeholder="템플릿 소개 / 특징 / 추천 대상 등"
            className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
          />
        </Field>

        <fieldset className="rounded-2xl border border-[#F0EBE3] bg-[#FFF8F0] p-4">
          <legend className="px-1 text-xs font-semibold text-[#2D5A3D]">
            🎯 권장 운영 정보 (선택 — 기관 가져올 때 참고용)
          </legend>
          <div className="mt-2 grid gap-4 md:grid-cols-3">
            <Field label="권장 진행 시간 (분)">
              <input
                name="recommended_duration_minutes"
                type="number"
                step={5}
                min={0}
                max={6000}
                placeholder="예: 180"
                className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 font-mono text-sm focus:border-[#2D5A3D] focus:outline-none"
              />
            </Field>
            <Field label="권장 최소 인원">
              <input
                name="recommended_capacity_min"
                type="number"
                min={0}
                max={100000}
                className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 font-mono text-sm focus:border-[#2D5A3D] focus:outline-none"
              />
            </Field>
            <Field label="권장 최대 인원">
              <input
                name="recommended_capacity_max"
                type="number"
                min={0}
                max={100000}
                className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 font-mono text-sm focus:border-[#2D5A3D] focus:outline-none"
              />
            </Field>
          </div>
        </fieldset>

        <div className="flex justify-end gap-2 pt-4">
          <Link
            href="/partner/event-templates"
            className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
          >
            취소
          </Link>
          <button
            type="submit"
            className="rounded-xl bg-[#2D5A3D] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#3A7A52]"
          >
            만들기
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-[#2D5A3D]">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-[#8B7F75]">{hint}</p>}
    </div>
  );
}
