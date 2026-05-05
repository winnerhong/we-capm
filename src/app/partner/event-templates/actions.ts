"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePartnerWithRole } from "@/lib/auth-guard";
import { hasFeature } from "@/lib/features/guard";
import {
  TEMPLATE_VISIBILITIES,
  TEMPLATE_STATUSES,
  type TemplateVisibility,
  type TemplateStatus,
} from "@/lib/event-templates/types";
import { getTemplateById } from "@/lib/event-templates/queries";

type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

const NAME_MAX = 80;
const SUBTITLE_MAX = 200;
const DESC_MAX = 4000;

function clampInt(v: unknown, min: number, max: number): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "string" ? parseInt(v, 10) : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function clampNumeric(v: unknown, min: number, max: number): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

async function ensureTemplateFeature(partnerId: string): Promise<ActionResult> {
  const ok = await hasFeature(partnerId, "EVENT_TEMPLATE");
  if (!ok)
    return {
      ok: false,
      message:
        "행사 템플릿 기능(EVENT_TEMPLATE)이 부여되지 않았습니다. 본사에 문의해주세요.",
    };
  return { ok: true };
}

async function assertOwner(
  partnerId: string,
  templateId: string
): Promise<ActionResult> {
  const t = await getTemplateById(templateId);
  if (!t) return { ok: false, message: "템플릿을 찾을 수 없습니다." };
  if (t.partner_id !== partnerId)
    return { ok: false, message: "권한이 없습니다." };
  if (t.is_deleted) return { ok: false, message: "삭제된 템플릿입니다." };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------
export async function createTemplateAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const partner = await requirePartnerWithRole(["OWNER", "MANAGER"]);
  const gate = await ensureTemplateFeature(partner.id);
  if (!gate.ok) return gate;

  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > NAME_MAX)
    return { ok: false, message: `이름은 1~${NAME_MAX}자` };

  const subtitle = String(formData.get("subtitle") ?? "").trim().slice(0, SUBTITLE_MAX) || null;
  const description = String(formData.get("description") ?? "").trim().slice(0, DESC_MAX) || null;
  const cover_image_url = String(formData.get("cover_image_url") ?? "").trim() || null;
  // 분 단위 입력 → DB 는 시간(hours, numeric) 으로 저장
  const minutesInput = clampNumeric(
    formData.get("recommended_duration_minutes"),
    0,
    6000
  );
  const recommended_duration_hours =
    minutesInput == null ? null : Math.round((minutesInput / 60) * 100) / 100;
  const recommended_capacity_min = clampInt(
    formData.get("recommended_capacity_min"),
    0,
    100000
  );
  const recommended_capacity_max = clampInt(
    formData.get("recommended_capacity_max"),
    0,
    100000
  );

  const supabase = await createClient();
  const { data, error } = await (
    supabase.from("partner_event_templates" as never) as unknown as {
      insert: (row: Record<string, unknown>) => {
        select: (c: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .insert({
      partner_id: partner.id,
      name,
      subtitle,
      description,
      cover_image_url,
      recommended_duration_hours,
      recommended_capacity_min,
      recommended_capacity_max,
      visibility: "PRIVATE",
      status: "DRAFT",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: error?.message ?? "생성 실패" };
  }

  revalidatePath("/partner/event-templates");
  return { ok: true, data: { id: data.id } };
}

// ---------------------------------------------------------------------------
// UPDATE (기본 정보)
// ---------------------------------------------------------------------------
export async function updateTemplateAction(
  templateId: string,
  formData: FormData
): Promise<ActionResult> {
  const partner = await requirePartnerWithRole(["OWNER", "MANAGER"]);
  const gate = await ensureTemplateFeature(partner.id);
  if (!gate.ok) return gate;
  const own = await assertOwner(partner.id, templateId);
  if (!own.ok) return own;

  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > NAME_MAX)
    return { ok: false, message: `이름은 1~${NAME_MAX}자` };

  const subtitle = String(formData.get("subtitle") ?? "").trim().slice(0, SUBTITLE_MAX) || null;
  const description = String(formData.get("description") ?? "").trim().slice(0, DESC_MAX) || null;
  const cover_image_url = String(formData.get("cover_image_url") ?? "").trim() || null;
  // 분 단위 입력 → DB 는 시간(hours, numeric) 으로 저장
  const minutesInput = clampNumeric(
    formData.get("recommended_duration_minutes"),
    0,
    6000
  );
  const recommended_duration_hours =
    minutesInput == null ? null : Math.round((minutesInput / 60) * 100) / 100;
  const recommended_capacity_min = clampInt(
    formData.get("recommended_capacity_min"),
    0,
    100000
  );
  const recommended_capacity_max = clampInt(
    formData.get("recommended_capacity_max"),
    0,
    100000
  );

  const supabase = await createClient();
  const { error } = await (
    supabase.from("partner_event_templates" as never) as unknown as {
      update: (r: Record<string, unknown>) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .update({
      name,
      subtitle,
      description,
      cover_image_url,
      recommended_duration_hours,
      recommended_capacity_min,
      recommended_capacity_max,
    })
    .eq("id", templateId)
    .eq("partner_id", partner.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/partner/event-templates");
  revalidatePath(`/partner/event-templates/${templateId}/edit`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 가시성 / 상태 변경
// ---------------------------------------------------------------------------
export async function setTemplateVisibilityAction(
  templateId: string,
  visibility: string
): Promise<ActionResult> {
  const partner = await requirePartnerWithRole(["OWNER", "MANAGER"]);
  const gate = await ensureTemplateFeature(partner.id);
  if (!gate.ok) return gate;
  const own = await assertOwner(partner.id, templateId);
  if (!own.ok) return own;

  if (!(TEMPLATE_VISIBILITIES as readonly string[]).includes(visibility))
    return { ok: false, message: "공개여부 값이 올바르지 않습니다." };

  const supabase = await createClient();
  const { error } = await (
    supabase.from("partner_event_templates" as never) as unknown as {
      update: (r: Record<string, unknown>) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .update({ visibility: visibility as TemplateVisibility })
    .eq("id", templateId)
    .eq("partner_id", partner.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/partner/event-templates");
  revalidatePath(`/partner/event-templates/${templateId}/edit`);
  return { ok: true };
}

export async function setTemplateStatusAction(
  templateId: string,
  status: string
): Promise<ActionResult> {
  const partner = await requirePartnerWithRole(["OWNER", "MANAGER"]);
  const gate = await ensureTemplateFeature(partner.id);
  if (!gate.ok) return gate;
  const own = await assertOwner(partner.id, templateId);
  if (!own.ok) return own;

  if (!(TEMPLATE_STATUSES as readonly string[]).includes(status))
    return { ok: false, message: "상태 값이 올바르지 않습니다." };

  const supabase = await createClient();
  const { error } = await (
    supabase.from("partner_event_templates" as never) as unknown as {
      update: (r: Record<string, unknown>) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .update({ status: status as TemplateStatus })
    .eq("id", templateId)
    .eq("partner_id", partner.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/partner/event-templates");
  revalidatePath(`/partner/event-templates/${templateId}/edit`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 삭제 (soft)
// ---------------------------------------------------------------------------
export async function softDeleteTemplateAction(
  templateId: string
): Promise<ActionResult> {
  const partner = await requirePartnerWithRole(["OWNER", "MANAGER"]);
  const own = await assertOwner(partner.id, templateId);
  if (!own.ok) return own;

  const supabase = await createClient();
  const { error } = await (
    supabase.from("partner_event_templates" as never) as unknown as {
      update: (r: Record<string, unknown>) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .update({ is_deleted: true, status: "ARCHIVED" })
    .eq("id", templateId)
    .eq("partner_id", partner.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/partner/event-templates");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 지정 기관 (assignments) — visibility=SELECTED 일 때 사용
// ---------------------------------------------------------------------------
export async function setTemplateAssignmentsAction(
  templateId: string,
  orgIdsCsv: string
): Promise<ActionResult> {
  const partner = await requirePartnerWithRole(["OWNER", "MANAGER"]);
  const own = await assertOwner(partner.id, templateId);
  if (!own.ok) return own;

  const orgIds = orgIdsCsv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const supabase = await createClient();

  // 기존 매핑 모두 삭제 후 재생성 (단순)
  const { error: e1 } = await (
    supabase.from("partner_event_template_assignments" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .delete()
    .eq("template_id", templateId);
  if (e1) return { ok: false, message: e1.message };

  if (orgIds.length > 0) {
    const rows = orgIds.map((oid) => ({ template_id: templateId, org_id: oid }));
    const { error: e2 } = await (
      supabase.from("partner_event_template_assignments" as never) as unknown as {
        insert: (rows: Record<string, unknown>[]) => Promise<{
          error: { message: string } | null;
        }>;
      }
    ).insert(rows);
    if (e2) return { ok: false, message: e2.message };
  }

  revalidatePath(`/partner/event-templates/${templateId}/edit`);
  return { ok: true };
}
