import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";
import { ImageUploader } from "@/components/image-uploader";
import { CategoryPicker } from "@/components/category-picker";
import { updateProgramAction, type ProgramCategory } from "../../actions";
import type {
  FaqItem,
  PartnerProgramRow,
  ProgramVisibility,
  ScheduleItem,
} from "@/lib/partner-programs/types";
import { VisibilitySection } from "./visibility-section";
import { ScheduleEditor } from "./schedule-editor";
import { FaqEditor } from "./faq-editor";
import type { OrgOption } from "./assignments-picker";

export const dynamic = "force-dynamic";

const CATEGORY_OPTIONS: Array<{
  value: ProgramCategory;
  label: string;
  icon: string;
}> = [
  { value: "FOREST", label: "숲 체험", icon: "🌲" },
  { value: "CAMPING", label: "캠핑", icon: "⛺" },
  { value: "KIDS", label: "유아·키즈", icon: "👶" },
  { value: "FAMILY", label: "가족", icon: "👨‍👩‍👧" },
  { value: "TEAM", label: "기업 팀빌딩", icon: "🏢" },
  { value: "ART", label: "아트·공예", icon: "🎨" },
];

// ---- JSON 안전 변환 (jsonb 컬럼에서 불명확한 shape 방어) ----
function toScheduleItems(raw: unknown): ScheduleItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) => {
    if (!x || typeof x !== "object") return [];
    const r = x as Record<string, unknown>;
    if (typeof r.time !== "string" || typeof r.title !== "string") return [];
    return [
      {
        time: r.time,
        title: r.title,
        desc: typeof r.desc === "string" ? r.desc : undefined,
      },
    ];
  });
}

function toFaqItems(raw: unknown): FaqItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) => {
    if (!x || typeof x !== "object") return [];
    const r = x as Record<string, unknown>;
    if (typeof r.q !== "string" || typeof r.a !== "string") return [];
    return [{ q: r.q, a: r.a }];
  });
}

async function loadProgram(id: string): Promise<PartnerProgramRow | null> {
  const supabase = await createClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: Record<string, unknown> | null;
            error: unknown;
          }>;
        };
      };
    };
  };

  const { data, error } = await sb
    .from("partner_programs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[partner/programs/[id]/edit] load error", error);
    return null;
  }
  if (!data) return null;

  // 느슨한 매핑 (Supabase 클라이언트 타입 미정의 방어)
  const r = data as Record<string, unknown>;
  return {
    id: String(r.id),
    partner_id: String(r.partner_id ?? ""),
    title: String(r.title ?? ""),
    description: (r.description as string | null) ?? null,
    long_description: (r.long_description as string | null) ?? null,
    category: (r.category as PartnerProgramRow["category"]) ?? "FOREST",
    duration_hours: (r.duration_hours as number | null) ?? null,
    capacity_min: Number(r.capacity_min ?? 5),
    capacity_max: Number(r.capacity_max ?? 30),
    price_per_person: Number(r.price_per_person ?? 0),
    b2b_price_per_person: (r.b2b_price_per_person as number | null) ?? null,
    location_region: (r.location_region as string | null) ?? null,
    location_detail: (r.location_detail as string | null) ?? null,
    image_url: (r.image_url as string | null) ?? null,
    images: Array.isArray(r.images) ? (r.images as string[]) : [],
    tags: (r.tags as string[] | null) ?? null,
    schedule_items: toScheduleItems(r.schedule_items),
    required_items: Array.isArray(r.required_items)
      ? (r.required_items as string[])
      : [],
    safety_notes: (r.safety_notes as string | null) ?? null,
    target_audience: (r.target_audience as string | null) ?? null,
    faq: toFaqItems(r.faq),
    linked_trail_id: (r.linked_trail_id as string | null) ?? null,
    visibility: (r.visibility as ProgramVisibility) ?? "DRAFT",
    is_published: Boolean(r.is_published),
    rating_avg: (r.rating_avg as number | null) ?? null,
    rating_count: Number(r.rating_count ?? 0),
    booking_count: Number(r.booking_count ?? 0),
    created_at: String(r.created_at ?? ""),
  };
}

async function loadOrgs(partnerId: string): Promise<OrgOption[]> {
  const supabase = await createClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: OrgOption[] | null; error: unknown }>;
        };
      };
    };
  };

  const { data, error } = await sb
    .from("partner_orgs")
    .select("id,org_name,org_type,org_phone,representative_phone")
    .eq("partner_id", partnerId)
    .order("org_name", { ascending: true });

  if (error) {
    console.error("[partner/programs/[id]/edit] orgs load error", error);
    return [];
  }
  return data ?? [];
}

async function loadAssignedOrgIds(programId: string): Promise<string[]> {
  const supabase = await createClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{
          data: Array<{ org_id: string }> | null;
          error: unknown;
        }>;
      };
    };
  };

  const { data, error } = await sb
    .from("partner_program_assignments")
    .select("org_id")
    .eq("program_id", programId);

  if (error) {
    console.error("[partner/programs/[id]/edit] assignments load error", error);
    return [];
  }
  return (data ?? []).map((r) => r.org_id);
}

type TrailOption = { id: string; name: string };

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

async function loadTrails(partnerId: string): Promise<TrailOption[]> {
  const supabase = await createClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: TrailOption[] | null; error: unknown }>;
        };
      };
    };
  };
  try {
    const { data } = await sb
      .from("partner_trails")
      .select("id,name")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false });
    return data ?? [];
  } catch {
    return [];
  }
}

// 갤러리 슬롯 수 (고정)
const IMAGE_SLOTS = 5;

export default async function EditProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const partner = await requirePartner();
  const { id } = await params;

  const [program, orgs, assigned, trails, customCategories] = await Promise.all([
    loadProgram(id),
    loadOrgs(partner.id),
    loadAssignedOrgIds(id),
    loadTrails(partner.id),
    loadCustomCategories(partner.id),
  ]);

  if (!program) notFound();
  // 소유자 검증 (dev 환경에서 partner_id가 null일 수 있음 — 비교 우회)
  if (program.partner_id && program.partner_id !== partner.id) notFound();

  const tagsText = program.tags?.join(", ") ?? "";
  const requiredItemsText = program.required_items.join(", ");
  const galleryDefaults: string[] = Array.from({ length: IMAGE_SLOTS }, (_, i) =>
    program.images[i] ?? ""
  );

  async function action(formData: FormData) {
    "use server";
    await updateProgramAction(id, formData);
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
        <span className="font-semibold text-[#2D5A3D]">프로그램 편집</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            🗺️
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              프로그램 편집
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              상세 기획 · 배포 대상 · 갤러리까지 한 페이지에서 관리합니다.
            </p>
          </div>
        </div>
      </header>

      <form action={action} className="space-y-6">
        {/* 1. 기본 정보 */}
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
                defaultValue={program.title}
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
                한 줄 설명
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={program.description ?? ""}
                placeholder="카탈로그에 표시되는 짧은 요약 (1~2 문장)"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="category"
                  className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
                >
                  카테고리 <span className="text-rose-600">*</span>
                </label>
                <CategoryPicker
                  name="category"
                  defaultValue={program.category}
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
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                  defaultValue={program.duration_hours ?? ""}
                  placeholder="예) 3"
                  className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
                />
              </div>
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
                  defaultValue={program.capacity_min}
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
                  defaultValue={program.capacity_max}
                  className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
                />
              </div>
            </div>

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
                    defaultValue={program.price_per_person}
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
                    defaultValue={program.b2b_price_per_person ?? ""}
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
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  defaultValue={program.location_region ?? ""}
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
                  defaultValue={program.location_detail ?? ""}
                  autoComplete="off"
                  placeholder="예) 토리숲 캠핑장 B구역"
                  className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
                />
              </div>
            </div>

            {/* 대표 이미지 */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
                대표 이미지
              </label>
              <ImageUploader
                name="image_url"
                defaultValue={program.image_url ?? ""}
                folder="programs"
                maxKb={500}
              />
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                카탈로그 썸네일로 쓰입니다. 비우면 카테고리 이모지가 표시됩니다.
              </p>
            </div>
          </div>
        </section>

        {/* 2. 상세 기획 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>📋</span>
            <span>상세 기획</span>
          </h2>

          <div className="space-y-5">
            {/* 2-1 long_description */}
            <div>
              <label
                htmlFor="long_description"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                상세 설명
              </label>
              <textarea
                id="long_description"
                name="long_description"
                rows={8}
                defaultValue={program.long_description ?? ""}
                placeholder="프로그램의 전체 흐름, 특장점, 스토리를 자유롭게 적어주세요. 마크다운 가능."
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>

            {/* 2-2 schedule_items */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
                🕐 일정표
              </label>
              <ScheduleEditor defaultValue={program.schedule_items} />
            </div>

            {/* 2-3 required_items */}
            <div>
              <label
                htmlFor="required_items"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                🎒 준비물 (쉼표로 구분)
              </label>
              <input
                id="required_items"
                name="required_items"
                type="text"
                defaultValue={requiredItemsText}
                autoComplete="off"
                placeholder="예) 운동화, 물 500ml, 모자, 간식"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                참여자에게 사전 공지되는 준비물 체크리스트입니다.
              </p>
            </div>

            {/* 2-4 safety_notes */}
            <div>
              <label
                htmlFor="safety_notes"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                ⚠️ 주의사항
              </label>
              <textarea
                id="safety_notes"
                name="safety_notes"
                rows={3}
                defaultValue={program.safety_notes ?? ""}
                placeholder="⚠️ 안전에 대한 안내사항 (우천 시 취소, 반려동물 제한 등)"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>

            {/* 2-5 target_audience */}
            <div>
              <label
                htmlFor="target_audience"
                className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
              >
                👥 참여 대상
              </label>
              <input
                id="target_audience"
                name="target_audience"
                type="text"
                defaultValue={program.target_audience ?? ""}
                autoComplete="off"
                placeholder="예) 5~7세 가족 / 초등 저학년 / 휠체어 접근 가능"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>
          </div>
        </section>

        {/* 3. 추가 이미지 갤러리 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>🖼️</span>
            <span>추가 이미지 갤러리</span>
          </h2>
          <p className="mb-4 text-[11px] text-[#6B6560]">
            대표 이미지 외 추가로 노출할 사진 최대 {IMAGE_SLOTS}장. 빈 슬롯은
            저장 시 자동으로 건너뜁니다.
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {galleryDefaults.map((value, i) => (
              <div
                key={i}
                className="rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3"
              >
                <p className="mb-2 text-[11px] font-semibold text-[#2D5A3D]">
                  슬롯 {i + 1}
                </p>
                <ImageUploader
                  name={`images[${i}]`}
                  defaultValue={value}
                  folder="programs"
                  maxKb={500}
                />
              </div>
            ))}
          </div>
        </section>

        {/* 4. FAQ */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>❓</span>
            <span>자주 묻는 질문 (FAQ)</span>
          </h2>
          <p className="mb-4 text-[11px] text-[#6B6560]">
            참여자·기관이 자주 궁금해하는 내용을 미리 정리해 두세요.
          </p>
          <FaqEditor defaultValue={program.faq} />
        </section>

        {/* 5. 연계 숲길 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>🗺️</span>
            <span>연계 숲길</span>
          </h2>
          <p className="mb-4 text-[11px] text-[#6B6560]">
            QR·미션 숲길을 연계하면 기관이 이 프로그램 활성화 시 숲길도 함께
            받아가요.
          </p>

          <label
            htmlFor="linked_trail_id"
            className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
          >
            숲길 선택
          </label>
          <select
            id="linked_trail_id"
            name="linked_trail_id"
            defaultValue={program.linked_trail_id ?? ""}
            className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30 md:max-w-md"
          >
            <option value="">(선택 안 함)</option>
            {trails.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {trails.length === 0 && (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              아직 등록된 숲길이 없어요.{" "}
              <Link
                href="/partner/trails/new"
                className="font-semibold underline"
              >
                새 숲길 만들기 →
              </Link>
            </p>
          )}
        </section>

        {/* 6. 배포 대상 */}
        <VisibilitySection
          defaultValue={program.visibility}
          orgs={orgs}
          defaultAssignedOrgIds={assigned}
        />

        {/* 7. 액션 */}
        <div className="sticky bottom-0 z-10 -mx-2 flex flex-wrap items-center justify-end gap-2 border-t border-[#D4E4BC] bg-[#FFF8F0]/95 px-2 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0">
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
            <span aria-hidden>💾</span>
            <span>변경사항 저장</span>
          </button>
        </div>
      </form>
    </div>
  );
}
