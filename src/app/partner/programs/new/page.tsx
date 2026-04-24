import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";
import {
  createProgramAction,
  updateProgramAction,
  type ProgramCategory,
} from "../actions";
import { CategoryPicker } from "@/components/category-picker";

type ProgramRow = {
  id: string;
  title: string;
  description: string | null;
  category: ProgramCategory;
  duration_hours: number | null;
  capacity_min: number | null;
  capacity_max: number | null;
  price_per_person: number;
  b2b_price_per_person: number | null;
  location_region: string | null;
  location_detail: string | null;
  image_url: string | null;
  tags: string[] | null;
};

const CATEGORY_OPTIONS: Array<{ value: ProgramCategory; label: string; icon: string }> = [
  { value: "FOREST", label: "숲 체험", icon: "🌲" },
  { value: "CAMPING", label: "캠핑", icon: "⛺" },
  { value: "KIDS", label: "유아·키즈", icon: "👶" },
  { value: "FAMILY", label: "가족", icon: "👨‍👩‍👧" },
  { value: "TEAM", label: "기업 팀빌딩", icon: "🏢" },
  { value: "ART", label: "아트·공예", icon: "🎨" },
];

async function loadProgram(id: string): Promise<ProgramRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_programs")
    .select(
      "id,title,description,category,duration_hours,capacity_min,capacity_max,price_per_person,b2b_price_per_person,location_region,location_detail,image_url,tags"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[partner/programs/new] load error", error);
    return null;
  }
  return (data ?? null) as ProgramRow | null;
}

async function loadCustomCategories(partnerId: string): Promise<string[]> {
  const supabase = await createClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{
          data: Array<{ category: string | null }> | null;
        }>;
      };
    };
  };
  const builtIn = new Set(["FOREST", "CAMPING", "KIDS", "FAMILY", "TEAM", "ART"]);
  try {
    const { data } = await sb
      .from("partner_programs")
      .select("category")
      .eq("partner_id", partnerId);
    const set = new Set<string>();
    for (const row of data ?? []) {
      if (row.category && !builtIn.has(row.category)) set.add(row.category);
    }
    return Array.from(set).sort();
  } catch {
    return [];
  }
}

export default async function NewProgramPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const partner = await requirePartner();
  const sp = await searchParams;
  const editId = sp?.edit;
  const existing = editId ? await loadProgram(editId) : null;
  if (editId && !existing) notFound();
  const customCategories = await loadCustomCategories(partner.id);

  const isEdit = Boolean(existing);
  const tagsText = existing?.tags?.join(", ") ?? "";

  async function action(formData: FormData) {
    "use server";
    if (isEdit && existing) {
      await updateProgramAction(existing.id, formData);
    } else {
      await createProgramAction(formData);
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/programs" className="hover:text-[#2D5A3D]">
          프로그램 관리
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">
          {isEdit ? "프로그램 편집" : "새 프로그램"}
        </span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            🗺️
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              {isEdit ? "프로그램 편집" : "새 프로그램 등록"}
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              체험 상품 정보를 입력하고 저장하면 목록에 표시됩니다.
            </p>
          </div>
        </div>
      </header>

      <form action={action} className="space-y-6">
        {/* Section 1: 기본 정보 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>📝</span>
            <span>기본 정보</span>
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
                defaultValue={existing?.title ?? ""}
                autoComplete="off"
                placeholder="예) 가족과 함께하는 숲 놀이 체험"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
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
                defaultValue={existing?.description ?? ""}
                placeholder="프로그램 소개, 주요 활동, 포함 사항 등을 적어주세요."
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>

            <div>
              <label
                htmlFor="category"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                카테고리 <span className="text-rose-600">*</span>
              </label>
              <CategoryPicker
                name="category"
                defaultValue={existing?.category ?? "FOREST"}
                customCategories={customCategories}
                required
              />
            </div>

            <div>
              <label
                htmlFor="tags"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                태그 (쉼표로 구분)
              </label>
              <input
                id="tags"
                name="tags"
                type="text"
                defaultValue={tagsText}
                autoComplete="off"
                placeholder="예) 자연, 힐링, 1박2일"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                쉼표(,)로 구분해서 최대 5개 권장
              </p>
            </div>

            <div>
              <label
                htmlFor="image_url"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                대표 이미지 URL
              </label>
              <input
                id="image_url"
                name="image_url"
                type="url"
                inputMode="url"
                defaultValue={existing?.image_url ?? ""}
                autoComplete="off"
                placeholder="https://..."
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                비워두면 카테고리 이모지가 표시됩니다.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: 운영 정보 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>⚙️</span>
            <span>운영 정보</span>
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                inputMode="decimal"
                min={0}
                step="0.5"
                defaultValue={existing?.duration_hours ?? ""}
                placeholder="예) 3"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="capacity_min"
                  className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
                >
                  최소 인원
                </label>
                <input
                  id="capacity_min"
                  name="capacity_min"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  defaultValue={existing?.capacity_min ?? 5}
                  className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
                />
              </div>
              <div>
                <label
                  htmlFor="capacity_max"
                  className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
                >
                  최대 인원
                </label>
                <input
                  id="capacity_max"
                  name="capacity_max"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  defaultValue={existing?.capacity_max ?? 30}
                  className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="location_region"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                지역
              </label>
              <input
                id="location_region"
                name="location_region"
                type="text"
                defaultValue={existing?.location_region ?? ""}
                autoComplete="off"
                placeholder="예) 경기 가평"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>

            <div>
              <label
                htmlFor="location_detail"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                상세 장소
              </label>
              <input
                id="location_detail"
                name="location_detail"
                type="text"
                defaultValue={existing?.location_detail ?? ""}
                autoComplete="off"
                placeholder="예) 토리숲 캠핑장 B구역"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>
          </div>
        </section>

        {/* Section 3: 가격 정보 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>💰</span>
            <span>가격 정보</span>
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="price_per_person"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                개인 1인당 가격 <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <input
                  id="price_per_person"
                  name="price_per_person"
                  type="number"
                  inputMode="numeric"
                  required
                  min={1}
                  defaultValue={existing?.price_per_person ?? ""}
                  placeholder="50000"
                  className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 pr-10 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
                />
                <span
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6B6560]"
                  aria-hidden
                >
                  원
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="b2b_price_per_person"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                B2B 1인당 가격 (선택)
              </label>
              <div className="relative">
                <input
                  id="b2b_price_per_person"
                  name="b2b_price_per_person"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  defaultValue={existing?.b2b_price_per_person ?? ""}
                  placeholder="기관·기업 단가"
                  className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 pr-10 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
                />
                <span
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6B6560]"
                  aria-hidden
                >
                  원
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                학교·기업 단체 예약 시 적용되는 가격입니다.
              </p>
            </div>
          </div>
        </section>

        {/* 액션 버튼 */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/partner/programs"
            className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
          >
            취소
          </Link>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40"
          >
            <span aria-hidden>{isEdit ? "💾" : "🌱"}</span>
            <span>{isEdit ? "변경사항 저장" : "프로그램 등록"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
