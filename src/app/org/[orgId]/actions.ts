"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org-auth-guard";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { OrgProgramStatus } from "@/lib/org-programs/types";

const ORG_TYPES = new Set([
  "DAYCARE",
  "KINDERGARTEN",
  "ELEMENTARY",
  "MIDDLE",
  "HIGH",
  "EDUCATION_OFFICE",
  "OTHER",
]);

/**
 * 기관 본인이 자기 기본 정보를 수정.
 * partner_orgs 테이블의 일부 필드만 허용 (commission/discount/contract 등 민감 필드는 지사만).
 */
export async function updateOwnOrgInfoAction(formData: FormData): Promise<void> {
  const session = await requireOrg();
  const supabase = await createClient();

  const org_name = String(formData.get("org_name") ?? "").trim();
  const representative_name =
    String(formData.get("representative_name") ?? "").trim() || null;
  const representative_phone =
    String(formData.get("representative_phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const business_number =
    String(formData.get("business_number") ?? "").trim() || null;
  const org_type_raw = String(formData.get("org_type") ?? "").trim();
  const org_type =
    org_type_raw && ORG_TYPES.has(org_type_raw) ? org_type_raw : null;

  const tax_email = String(formData.get("tax_email") ?? "").trim() || null;

  // 토리FM 표시명 — 비워두면 null 저장 → 앱이 기본값 "토리FM" 으로 fallback.
  const fmBrandRaw = String(formData.get("fm_brand_name") ?? "").trim();
  const fm_brand_name =
    fmBrandRaw.length > 0 ? fmBrandRaw.slice(0, 30) : null;

  const parseCount = (key: string): number => {
    const raw = String(formData.get(key) ?? "").trim();
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    if (Number.isNaN(n) || n < 0) return 0;
    return n;
  };

  const children_count = parseCount("children_count");
  const class_count = parseCount("class_count");
  const teacher_count = parseCount("teacher_count");

  if (!org_name) {
    throw new Error("기관명을 입력해 주세요");
  }

  const { error } = await (
    supabase.from("partner_orgs" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .update({
      org_name,
      representative_name,
      representative_phone,
      email,
      address,
      business_number,
      org_type,
      children_count,
      class_count,
      teacher_count,
      tax_email,
      fm_brand_name,
    })
    .eq("id", session.orgId);

  if (error) throw new Error(`저장 실패: ${error.message}`);

  revalidatePath(`/org/${session.orgId}`);
  revalidatePath(`/org/${session.orgId}/settings`);
  redirect(`/org/${session.orgId}/settings?saved=1`);
}

/**
 * 기관 본인이 로그인 비밀번호를 변경.
 * 현재 비밀번호 검증 후 새 비밀번호를 bcrypt 해시로 저장.
 */
export async function changeOrgPasswordAction(formData: FormData): Promise<void> {
  const session = await requireOrg();
  const supabase = await createClient();

  const currentRaw = String(formData.get("current_password") ?? "");
  const newRaw = String(formData.get("new_password") ?? "");
  const confirmRaw = String(formData.get("confirm_password") ?? "");

  if (!currentRaw) throw new Error("현재 비밀번호를 입력해 주세요");
  if (newRaw.length < 6) throw new Error("새 비밀번호는 최소 6자 이상이어야 해요");
  if (newRaw !== confirmRaw) throw new Error("새 비밀번호 확인이 일치하지 않아요");

  // 1) 현재 hash 로드
  const { data: orgRow, error: loadErr } = await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { auto_password_hash: string | null } | null;
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .select("auto_password_hash")
    .eq("id", session.orgId)
    .maybeSingle();

  if (loadErr) throw new Error(`조회 실패: ${loadErr.message}`);
  if (!orgRow?.auto_password_hash) {
    throw new Error("비밀번호가 설정되어 있지 않아요. 지사에 문의해 주세요.");
  }

  // 2) verify current
  const ok = await verifyPassword(currentRaw, orgRow.auto_password_hash);
  if (!ok) throw new Error("현재 비밀번호가 일치하지 않아요");

  // 3) hash new + update
  const newHash = await hashPassword(newRaw);
  const { error: updErr } = await (
    supabase.from("partner_orgs" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .update({ auto_password_hash: newHash })
    .eq("id", session.orgId);

  if (updErr) throw new Error(`변경 실패: ${updErr.message}`);

  revalidatePath(`/org/${session.orgId}/settings`);
  redirect(`/org/${session.orgId}/settings?saved=pw`);
}

type PartnerProgramRow = {
  id: string;
  partner_id: string | null;
  title: string;
  description: string | null;
  category: string;
  duration_hours: number | null;
  capacity_min: number | null;
  capacity_max: number | null;
  price_per_person: number;
  location_detail: string | null;
  image_url: string | null;
  tags: string[] | null;
};

type OrgProgramOwnerRow = {
  id: string;
  org_id: string;
};

/**
 * 템플릿 활성화: partner_programs 스냅샷을 org_programs로 복제
 * 중복 활성화 허용 (같은 기관이 같은 템플릿 여러 번 복제 가능)
 */
export async function activateTemplateAction(sourceProgramId: string) {
  const session = await requireOrg();
  const supabase = await createClient();

  // 1. 원본 템플릿 조회 (visibility 기반 공개 여부 체크, 레거시 is_published fallback)
  const { data: src } = await (supabase.from("partner_programs" as never) as unknown as {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        maybeSingle: () => Promise<{
          data:
            | (PartnerProgramRow & {
                is_published: boolean;
                visibility: "DRAFT" | "ALL" | "SELECTED" | "ARCHIVED" | null;
              })
            | null;
        }>;
      };
    };
  })
    .select(
      "id, partner_id, title, description, category, duration_hours, capacity_min, capacity_max, price_per_person, location_detail, image_url, tags, visibility, is_published"
    )
    .eq("id", sourceProgramId)
    .maybeSingle();

  if (!src) {
    return { ok: false, message: "해당 프로그램을 찾을 수 없습니다" };
  }

  // visibility 우선, 레거시 is_published는 visibility가 null일 때만 참조
  const isPublicToOrg =
    src.visibility === "ALL" ||
    src.visibility === "SELECTED" || // SELECTED면 카탈로그에 이미 필터돼 있으므로 이 지점 도달=허용
    (src.visibility == null && src.is_published === true);

  if (!isPublicToOrg) {
    return { ok: false, message: "공개된 템플릿이 아닙니다" };
  }

  // 2. org_programs에 스냅샷 insert
  const payload = {
    org_id: session.orgId,
    source_program_id: src.id,
    source_partner_id: src.partner_id,
    title: src.title,
    description: src.description,
    category: src.category,
    duration_hours: src.duration_hours,
    capacity_min: src.capacity_min ?? 5,
    capacity_max: src.capacity_max ?? 30,
    price_per_person: src.price_per_person ?? 0,
    location_detail: src.location_detail,
    image_url: src.image_url,
    tags: src.tags,
    custom_theme: {},
    status: "ACTIVATED" as OrgProgramStatus,
    is_published: false,
  };

  const { data: inserted, error } = await (supabase.from("org_programs" as never) as unknown as {
    insert: (p: unknown) => {
      select: (c: string) => {
        single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
      };
    };
  })
    .insert(payload)
    .select("id")
    .single();

  if (error || !inserted) {
    return { ok: false, message: error?.message ?? "활성화에 실패했습니다" };
  }

  revalidatePath(`/org/${session.orgId}/templates`);
  revalidatePath(`/org/${session.orgId}/programs`);
  return {
    ok: true,
    programId: inserted.id,
    editUrl: `/org/${session.orgId}/programs/${inserted.id}/edit`,
  };
}

/**
 * org_program 업데이트 (title/description/price/duration/category/image_url/custom_notes)
 * 소유권 검증 후 status=CUSTOMIZED 로 전환
 */
export async function updateOrgProgramAction(id: string, formData: FormData) {
  const session = await requireOrg();
  const supabase = await createClient();

  // 소유권 검증
  const owner = await getOrgProgramOwner(supabase, id);
  if (!owner) return { ok: false, message: "프로그램을 찾을 수 없습니다" };
  if (owner.org_id !== session.orgId) return { ok: false, message: "권한이 없습니다" };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "").trim();
  const priceRaw = formData.get("price_per_person");
  const durationRaw = formData.get("duration_hours");
  const imageUrl = String(formData.get("image_url") ?? "").trim() || null;
  const customNotes = String(formData.get("custom_notes") ?? "").trim() || null;

  if (!title) return { ok: false, message: "제목을 입력하세요" };
  if (!category) return { ok: false, message: "카테고리를 선택하세요" };

  const price = priceRaw ? Number(priceRaw) : 0;
  const duration = durationRaw ? Number(durationRaw) : null;

  if (Number.isNaN(price) || price < 0) return { ok: false, message: "가격이 올바르지 않습니다" };
  if (duration !== null && (Number.isNaN(duration) || duration < 0)) {
    return { ok: false, message: "진행 시간이 올바르지 않습니다" };
  }

  const { error } = await (supabase.from("org_programs" as never) as unknown as {
    update: (p: unknown) => {
      eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
    };
  })
    .update({
      title,
      description,
      category,
      price_per_person: price,
      duration_hours: duration,
      image_url: imageUrl,
      custom_notes: customNotes,
      status: "CUSTOMIZED" as OrgProgramStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/org/${session.orgId}/programs`);
  revalidatePath(`/org/${session.orgId}/programs/${id}`);
  return { ok: true };
}

/**
 * 공개/비공개 토글
 */
export async function toggleOrgProgramPublishAction(id: string, publish: boolean) {
  const session = await requireOrg();
  const supabase = await createClient();

  const owner = await getOrgProgramOwner(supabase, id);
  if (!owner) return { ok: false, message: "프로그램을 찾을 수 없습니다" };
  if (owner.org_id !== session.orgId) return { ok: false, message: "권한이 없습니다" };

  const { error } = await (supabase.from("org_programs" as never) as unknown as {
    update: (p: unknown) => {
      eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
    };
  })
    .update({
      is_published: publish,
      status: (publish ? "PUBLISHED" : "PAUSED") as OrgProgramStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/org/${session.orgId}/programs`);
  revalidatePath(`/org/${session.orgId}/programs/${id}`);
  return { ok: true, published: publish };
}

/**
 * org_program 삭제 (MVP: hard delete)
 */
export async function deleteOrgProgramAction(id: string) {
  const session = await requireOrg();
  const supabase = await createClient();

  const owner = await getOrgProgramOwner(supabase, id);
  if (!owner) return { ok: false, message: "프로그램을 찾을 수 없습니다" };
  if (owner.org_id !== session.orgId) return { ok: false, message: "권한이 없습니다" };

  const { error } = await (supabase.from("org_programs" as never) as unknown as {
    delete: () => {
      eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
    };
  })
    .delete()
    .eq("id", id);

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/org/${session.orgId}/programs`);
  return { ok: true };
}

// ---------- 내부 헬퍼 ----------

async function getOrgProgramOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<OrgProgramOwnerRow | null> {
  const { data } = await (supabase.from("org_programs" as never) as unknown as {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        maybeSingle: () => Promise<{ data: OrgProgramOwnerRow | null }>;
      };
    };
  })
    .select("id, org_id")
    .eq("id", id)
    .maybeSingle();

  return data;
}
