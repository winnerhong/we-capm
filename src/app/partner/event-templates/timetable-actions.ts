"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePartnerWithRole } from "@/lib/auth-guard";
import { getTemplateById } from "@/lib/event-templates/queries";
import {
  TIMETABLE_SLOT_KINDS,
  type TimetableSlotKind,
} from "@/lib/event-templates/types";

type ActionResult = { ok: true } | { ok: false; message: string };

const TITLE_MAX = 100;
const DESC_MAX = 1000;
const LOC_MAX = 200;

async function ensureOwner(
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

function clampInt(v: unknown, min: number, max: number): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "string" ? parseInt(v, 10) : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

// ---------------------------------------------------------------------------
// 슬롯 추가
// ---------------------------------------------------------------------------
export async function addTimetableSlotAction(
  templateId: string,
  formData: FormData
): Promise<ActionResult> {
  const partner = await requirePartnerWithRole(["OWNER", "MANAGER"]);
  const own = await ensureOwner(partner.id, templateId);
  if (!own.ok) return own;

  const title = String(formData.get("title") ?? "").trim();
  if (!title || title.length > TITLE_MAX)
    return { ok: false, message: `슬롯 제목은 1~${TITLE_MAX}자` };

  const offsetMin = clampInt(formData.get("offset_min"), 0, 6000);
  if (offsetMin == null)
    return { ok: false, message: "시작 오프셋(분)을 입력해주세요." };

  const durationMin = clampInt(formData.get("duration_min"), 1, 6000);

  const slotKindRaw = String(formData.get("slot_kind") ?? "CUSTOM");
  const slot_kind: TimetableSlotKind = (
    TIMETABLE_SLOT_KINDS as readonly string[]
  ).includes(slotKindRaw)
    ? (slotKindRaw as TimetableSlotKind)
    : "CUSTOM";

  const description =
    String(formData.get("description") ?? "").trim().slice(0, DESC_MAX) || null;
  const icon_emoji =
    String(formData.get("icon_emoji") ?? "").trim().slice(0, 8) || null;
  const location =
    String(formData.get("location") ?? "").trim().slice(0, LOC_MAX) || null;

  const supabase = await createClient();

  // 다음 display_order 계산 (offset_min 동률일 때 안정 정렬용)
  const { data: maxRow } = await (
    supabase.from("partner_event_template_timetable_slots" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => {
            limit: (n: number) => Promise<{
              data: { display_order: number }[] | null;
              error: unknown;
            }>;
          };
        };
      };
    }
  )
    .select("display_order")
    .eq("template_id", templateId)
    .order("display_order", { ascending: false })
    .limit(1);
  const nextOrder =
    maxRow && maxRow.length > 0 ? (maxRow[0].display_order ?? 0) + 10 : 10;

  const { error } = await (
    supabase.from("partner_event_template_timetable_slots" as never) as unknown as {
      insert: (r: Record<string, unknown>) => Promise<{
        error: { message: string } | null;
      }>;
    }
  ).insert({
    template_id: templateId,
    offset_min: offsetMin,
    duration_min: durationMin,
    title,
    description,
    slot_kind,
    icon_emoji,
    location,
    display_order: nextOrder,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/partner/event-templates/${templateId}/edit`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 슬롯 제거
// ---------------------------------------------------------------------------
export async function removeTimetableSlotAction(
  slotId: string
): Promise<ActionResult> {
  const partner = await requirePartnerWithRole(["OWNER", "MANAGER"]);

  const supabase = await createClient();

  // 본인 템플릿인지 확인
  const { data } = await (
    supabase.from("partner_event_template_timetable_slots" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: {
              id: string;
              template_id: string;
              partner_event_templates: { partner_id: string } | null;
            } | null;
            error: unknown;
          }>;
        };
      };
    }
  )
    .select("id,template_id,partner_event_templates(partner_id)")
    .eq("id", slotId)
    .maybeSingle();

  if (!data) return { ok: false, message: "슬롯을 찾을 수 없습니다." };
  if (data.partner_event_templates?.partner_id !== partner.id)
    return { ok: false, message: "권한이 없습니다." };

  const { error } = await (
    supabase.from("partner_event_template_timetable_slots" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .delete()
    .eq("id", slotId);

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/partner/event-templates/${data.template_id}/edit`);
  return { ok: true };
}
