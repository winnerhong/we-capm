"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type {
  FaqItem,
  ProgramVisibility,
  ScheduleItem,
} from "@/lib/partner-programs/types";

export type ProgramCategory = "FOREST" | "CAMPING" | "KIDS" | "FAMILY" | "TEAM" | "ART";

const CATEGORY_SET = new Set<ProgramCategory>(["FOREST", "CAMPING", "KIDS", "FAMILY", "TEAM", "ART"]);

const VISIBILITY_SET = new Set<ProgramVisibility>([
  "DRAFT",
  "ALL",
  "SELECTED",
  "ARCHIVED",
]);

/**
 * Resolve the current partner_id.
 * Priority:
 *   1) cookie `campnic_partner` (partner auth when built)
 *   2) first existing row in partners table (dev fallback)
 *   3) null (orphan row — still valid due to partner_id nullable FK)
 */
async function resolvePartnerId(): Promise<string | null> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get("campnic_partner")?.value;
  if (fromCookie) {
    try {
      const parsed = JSON.parse(fromCookie);
      if (parsed && typeof parsed === "object" && typeof parsed.id === "string") {
        return parsed.id;
      }
    } catch {
      return fromCookie;
    }
  }

  const supabase = await createClient();
  const { data } = await (
    supabase.from("partners") as unknown as {
      select: (c: string) => {
        limit: (n: number) => {
          maybeSingle: () => Promise<{ data: { id: string } | null }>;
        };
      };
    }
  )
    .select("id")
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

function toNumber(value: FormDataEntryValue | null, fallback: number | null = null): number | null {
  if (value === null) return fallback;
  const s = String(value).trim();
  if (s === "") return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function toTags(value: FormDataEntryValue | null): string[] | null {
  if (value === null) return null;
  const s = String(value).trim();
  if (s === "") return null;
  const parts = s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : null;
}

function toStringArray(value: FormDataEntryValue | null): string[] {
  if (value === null) return [];
  const s = String(value).trim();
  if (s === "") return [];
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseJsonArray<T>(
  value: FormDataEntryValue | null,
  validate: (item: unknown) => item is T
): T[] {
  if (value === null) return [];
  const s = String(value).trim();
  if (s === "") return [];
  try {
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(validate);
  } catch {
    return [];
  }
}

function isScheduleItem(x: unknown): x is ScheduleItem {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.time === "string" &&
    typeof r.title === "string" &&
    (r.desc === undefined || typeof r.desc === "string")
  );
}

function isFaqItem(x: unknown): x is FaqItem {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return typeof r.q === "string" && typeof r.a === "string";
}

function collectImages(formData: FormData): string[] {
  // name="images[0]", "images[1]", ..., 또는 여러 "images" 반복
  const out: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "images" || /^images\[\d+\]$/.test(key)) {
      const s = String(value).trim();
      if (s) out.push(s);
    }
  }
  return out;
}

function parseForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  // 카테고리는 자유 입력 허용 (파트너가 직접 만든 카테고리 포함)
  const categoryRaw = String(formData.get("category") ?? "").trim();
  const category: string =
    categoryRaw === "" || categoryRaw === "__NEW__"
      ? "FOREST"
      : categoryRaw.slice(0, 60);

  const duration_hours = toNumber(formData.get("duration_hours"), null);
  const capacity_min = toNumber(formData.get("capacity_min"), 5) ?? 5;
  const capacity_max = toNumber(formData.get("capacity_max"), 30) ?? 30;
  const price_per_person = toNumber(formData.get("price_per_person"), 0) ?? 0;
  const b2b_price_per_person = toNumber(formData.get("b2b_price_per_person"), null);
  const location_region = String(formData.get("location_region") ?? "").trim() || null;
  const location_detail = String(formData.get("location_detail") ?? "").trim() || null;
  const image_url = String(formData.get("image_url") ?? "").trim() || null;
  const tags = toTags(formData.get("tags"));

  if (!title) throw new Error("프로그램 제목을 입력해 주세요");
  if (price_per_person <= 0) throw new Error("개인 1인당 가격을 입력해 주세요");
  if (capacity_min > capacity_max) throw new Error("최소 인원이 최대 인원보다 클 수 없어요");

  return {
    title,
    description,
    category,
    duration_hours,
    capacity_min,
    capacity_max,
    price_per_person,
    b2b_price_per_person,
    location_region,
    location_detail,
    image_url,
    tags,
  };
}

/** Phase 1 — 기획 필드 + visibility 확장 파싱 */
function parseExtended(formData: FormData) {
  const long_description =
    String(formData.get("long_description") ?? "").trim() || null;
  const safety_notes = String(formData.get("safety_notes") ?? "").trim() || null;
  const target_audience =
    String(formData.get("target_audience") ?? "").trim() || null;

  const schedule_items = parseJsonArray(
    formData.get("schedule_items"),
    isScheduleItem
  );
  const faq = parseJsonArray(formData.get("faq"), isFaqItem);

  const required_items = toStringArray(formData.get("required_items"));
  const images = collectImages(formData);

  const linkedRaw = String(formData.get("linked_trail_id") ?? "").trim();
  const linked_trail_id = linkedRaw === "" ? null : linkedRaw;

  const visibilityRaw = String(formData.get("visibility") ?? "").trim();
  const visibility: ProgramVisibility | null = VISIBILITY_SET.has(
    visibilityRaw as ProgramVisibility
  )
    ? (visibilityRaw as ProgramVisibility)
    : null;

  return {
    long_description,
    safety_notes,
    target_audience,
    schedule_items,
    faq,
    required_items,
    images,
    linked_trail_id,
    visibility,
  };
}

export async function createProgramAction(formData: FormData) {
  const supabase = await createClient();
  const partner_id = await resolvePartnerId();
  const base = parseForm(formData);
  const ext = parseExtended(formData);

  const visibility: ProgramVisibility = ext.visibility ?? "DRAFT";

  const payload: Record<string, unknown> = {
    ...base,
    partner_id,
    long_description: ext.long_description,
    safety_notes: ext.safety_notes,
    target_audience: ext.target_audience,
    schedule_items: ext.schedule_items,
    faq: ext.faq,
    required_items: ext.required_items,
    images: ext.images,
    linked_trail_id: ext.linked_trail_id,
    visibility,
  };

  const { error } = await (
    supabase.from("partner_programs") as unknown as {
      insert: (row: unknown) => Promise<{ error: { message: string } | null }>;
    }
  ).insert(payload as never);

  if (error) throw new Error(`프로그램 저장 실패: ${error.message}`);

  revalidatePath("/partner/programs");
  redirect("/partner/programs");
}

export async function updateProgramAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const base = parseForm(formData);
  const ext = parseExtended(formData);

  // visibility 저장 포함 — 값 있을 때만 반영 (폼에서 항상 hidden으로 넣도록 UI 처리)
  const payload: Record<string, unknown> = {
    ...base,
    long_description: ext.long_description,
    safety_notes: ext.safety_notes,
    target_audience: ext.target_audience,
    schedule_items: ext.schedule_items,
    faq: ext.faq,
    required_items: ext.required_items,
    images: ext.images,
    linked_trail_id: ext.linked_trail_id,
  };
  if (ext.visibility) {
    payload.visibility = ext.visibility;
    // is_published는 deprecated — 새 코드는 visibility만 씀 (읽기 쪽에서 호환 매핑)
  }

  const { error } = await (
    supabase.from("partner_programs") as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update(payload as never)
    .eq("id", id);

  if (error) throw new Error(`프로그램 수정 실패: ${error.message}`);

  // SELECTED visibility일 때 assignments 동기화 (assigned_org_ids hidden input)
  if (ext.visibility === "SELECTED") {
    const rawOrgIds = String(formData.get("assigned_org_ids") ?? "").trim();
    const orgIds = rawOrgIds
      ? rawOrgIds.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    await syncAssignments(id, orgIds);
  } else if (ext.visibility === "ALL" || ext.visibility === "DRAFT" || ext.visibility === "ARCHIVED") {
    // SELECTED가 아니면 할당 제거 (ALL은 모든 기관 자동 노출이므로 junction 불필요)
    await syncAssignments(id, []);
  }

  revalidatePath("/partner/programs");
  revalidatePath(`/partner/programs/${id}/edit`);
  redirect("/partner/programs");
}

async function syncAssignments(programId: string, orgIds: string[]) {
  const supabase = await createClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
      insert: (
        rows: unknown[]
      ) => Promise<{ error: { message: string } | null }>;
    };
  };

  // 단순화: 전체 삭제 후 재삽입 (선택된 기관이 적을 때 충분히 빠름)
  const { error: delErr } = await sb
    .from("partner_program_assignments")
    .delete()
    .eq("program_id", programId);
  if (delErr) throw new Error(`할당 초기화 실패: ${delErr.message}`);

  if (orgIds.length === 0) return;

  const rows = orgIds.map((org_id) => ({ program_id: programId, org_id }));
  const { error: insErr } = await sb
    .from("partner_program_assignments")
    .insert(rows);
  if (insErr) throw new Error(`할당 저장 실패: ${insErr.message}`);
}

/** 가벼운 visibility 토글 — 목록 페이지 등에서 사용 */
export async function updateProgramVisibilityAction(
  id: string,
  visibility: ProgramVisibility
) {
  if (!VISIBILITY_SET.has(visibility)) {
    throw new Error("잘못된 공개 범위입니다");
  }
  const supabase = await createClient();
  const { error } = await (
    supabase.from("partner_programs") as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({ visibility } as never)
    .eq("id", id);

  if (error) throw new Error(`공개 범위 변경 실패: ${error.message}`);

  if (visibility !== "SELECTED") {
    await syncAssignments(id, []);
  }
  revalidatePath("/partner/programs");
  revalidatePath(`/partner/programs/${id}/edit`);
}

/** assignments만 별도 동기화 (SELECTED일 때 쓰기) */
export async function setProgramAssignmentsAction(
  programId: string,
  orgIds: string[]
) {
  await syncAssignments(programId, orgIds);
  revalidatePath("/partner/programs");
  revalidatePath(`/partner/programs/${programId}/edit`);
}

/** 프로그램 복제 */
export async function duplicateProgramAction(id: string) {
  const supabase = await createClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
        };
      };
      insert: (row: unknown) => Promise<{ error: { message: string } | null }>;
    };
  };

  const { data, error } = await sb
    .from("partner_programs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`복제 실패: ${String((error as { message?: string })?.message ?? error)}`);
  if (!data) throw new Error("원본 프로그램을 찾을 수 없어요");

  const { id: _omitId, created_at: _omitCreated, ...rest } =
    data as Record<string, unknown>;
  void _omitId;
  void _omitCreated;

  // is_published는 deprecated — 새 쓰기에는 포함하지 않음
  const { is_published: _omitIsPub, ...restWithoutLegacy } = rest as {
    is_published?: unknown;
    [k: string]: unknown;
  };
  void _omitIsPub;

  const copy: Record<string, unknown> = {
    ...restWithoutLegacy,
    title: `[복사본] ${String(rest.title ?? "프로그램")}`,
    visibility: "DRAFT",
    rating_avg: null,
    rating_count: 0,
    booking_count: 0,
  };

  const { error: insErr } = await sb.from("partner_programs").insert(copy);
  if (insErr) throw new Error(`복제 저장 실패: ${insErr.message}`);

  revalidatePath("/partner/programs");
}

export async function deleteProgramAction(id: string) {
  const supabase = await createClient();
  const { error } = await (
    supabase.from("partner_programs") as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .delete()
    .eq("id", id);

  if (error) throw new Error(`프로그램 삭제 실패: ${error.message}`);

  revalidatePath("/partner/programs");
}

/**
 * Legacy 게시 토글 — 새 visibility 모델에 맞춰 DRAFT ↔ ALL 로 변환.
 * 읽기는 visibility 우선, fallback은 레거시 is_published.
 */
export async function togglePublishAction(id: string) {
  const supabase = await createClient();

  const { data } = await (
    supabase.from("partner_programs") as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: {
              visibility: ProgramVisibility | null;
              is_published: boolean | null;
            } | null;
          }>;
        };
      };
    }
  )
    .select("visibility, is_published")
    .eq("id", id)
    .maybeSingle();

  const currentlyPublished =
    data?.visibility === "ALL" ||
    data?.visibility === "SELECTED" ||
    (data?.visibility == null && data?.is_published === true);

  const nextVisibility: ProgramVisibility = currentlyPublished ? "DRAFT" : "ALL";

  const { error } = await (
    supabase.from("partner_programs") as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({ visibility: nextVisibility } as never)
    .eq("id", id);

  if (error) throw new Error(`게시 상태 변경 실패: ${error.message}`);

  // SELECTED에서 내려온 게 아니므로 assignments는 건드리지 않음
  // (명시적으로 ALL → DRAFT만 전환)

  revalidatePath("/partner/programs");
  revalidatePath(`/partner/programs/${id}`);
}
