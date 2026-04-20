"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type ProgramCategory = "FOREST" | "CAMPING" | "KIDS" | "FAMILY" | "TEAM" | "ART";

const CATEGORY_SET = new Set<ProgramCategory>(["FOREST", "CAMPING", "KIDS", "FAMILY", "TEAM", "ART"]);

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
  if (fromCookie) return fromCookie;

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

function parseForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  const categoryRaw = String(formData.get("category") ?? "FOREST");
  const category: ProgramCategory = CATEGORY_SET.has(categoryRaw as ProgramCategory)
    ? (categoryRaw as ProgramCategory)
    : "FOREST";

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

export async function createProgramAction(formData: FormData) {
  const supabase = await createClient();
  const partner_id = await resolvePartnerId();
  const data = parseForm(formData);

  const { error } = await (
    supabase.from("partner_programs") as unknown as {
      insert: (row: unknown) => Promise<{ error: { message: string } | null }>;
    }
  ).insert({
    ...data,
    partner_id,
    is_published: false,
  } as never);

  if (error) throw new Error(`프로그램 저장 실패: ${error.message}`);

  revalidatePath("/partner/programs");
  redirect("/partner/programs");
}

export async function updateProgramAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const data = parseForm(formData);

  const { error } = await (
    supabase.from("partner_programs") as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update(data as never)
    .eq("id", id);

  if (error) throw new Error(`프로그램 수정 실패: ${error.message}`);

  revalidatePath("/partner/programs");
  redirect("/partner/programs");
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

export async function togglePublishAction(id: string) {
  const supabase = await createClient();

  const { data } = await (
    supabase.from("partner_programs") as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: { is_published: boolean } | null }>;
        };
      };
    }
  )
    .select("is_published")
    .eq("id", id)
    .maybeSingle();

  const next = !(data?.is_published ?? false);

  const { error } = await (
    supabase.from("partner_programs") as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({ is_published: next } as never)
    .eq("id", id);

  if (error) throw new Error(`게시 상태 변경 실패: ${error.message}`);

  revalidatePath("/partner/programs");
}
