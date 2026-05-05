"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePartnerWithRole } from "@/lib/auth-guard";
import { hasFeature } from "@/lib/features/guard";
import { getTemplateById } from "@/lib/event-templates/queries";
import {
  ITEM_TYPE_META,
  TEMPLATE_ITEM_TYPES,
  type TemplateItemType,
} from "@/lib/event-templates/types";

type ActionResult = { ok: true } | { ok: false; message: string };

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

/**
 * 항목 추가.
 * - item_id 가 본인 partner-side 리소스인지 확인 (PROGRAM=partner_programs, TRAIL=partner_trails)
 * - required_feature_code 자동 계산 후 저장
 * - 해당 feature 미보유 시 거절
 */
export async function addTemplateItemAction(
  templateId: string,
  itemType: string,
  itemId: string,
  note?: string
): Promise<ActionResult> {
  const partner = await requirePartnerWithRole(["OWNER", "MANAGER"]);
  const own = await ensureOwner(partner.id, templateId);
  if (!own.ok) return own;

  if (!(TEMPLATE_ITEM_TYPES as readonly string[]).includes(itemType))
    return { ok: false, message: "지원하지 않는 항목 유형입니다." };
  const type = itemType as TemplateItemType;
  if (!itemId) return { ok: false, message: "항목 ID 가 필요합니다." };

  const meta = ITEM_TYPE_META[type];

  // 1) feature gating — 항목이 요구하는 feature 보유 확인
  if (meta.required_feature_code) {
    const ok = await hasFeature(partner.id, meta.required_feature_code);
    if (!ok)
      return {
        ok: false,
        message: `이 항목 유형(${meta.label})은 ${meta.required_feature_code} 기능 보유가 필요합니다.`,
      };
  }

  // 2) 본인 partner-side 리소스인지 검증 (PROGRAM / TRAIL 만 MVP)
  let nameSnapshot: string | null = null;

  const supabase = await createClient();
  if (type === "PROGRAM") {
    const { data } = await (
      supabase.from("partner_programs" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<{
                data: { id: string; title: string } | null;
                error: unknown;
              }>;
            };
          };
        };
      }
    )
      .select("id,title")
      .eq("id", itemId)
      .eq("partner_id", partner.id)
      .maybeSingle();
    if (!data)
      return { ok: false, message: "본인 프로그램이 아니거나 찾을 수 없습니다." };
    nameSnapshot = data.title;
  } else if (type === "TRAIL") {
    const { data } = await (
      supabase.from("partner_trails" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<{
                data: { id: string; name: string } | null;
                error: unknown;
              }>;
            };
          };
        };
      }
    )
      .select("id,name")
      .eq("id", itemId)
      .eq("partner_id", partner.id)
      .maybeSingle();
    if (!data)
      return { ok: false, message: "본인 숲길이 아니거나 찾을 수 없습니다." };
    nameSnapshot = data.name;
  } else if (type === "STAMPBOOK_PRESET") {
    const { data } = await (
      supabase.from("partner_stampbook_presets" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: boolean) => {
                maybeSingle: () => Promise<{
                  data: { id: string; name: string } | null;
                  error: unknown;
                }>;
              };
            };
          };
        };
      }
    )
      .select("id,name")
      .eq("id", itemId)
      .eq("partner_id", partner.id)
      .eq("is_published", true)
      .maybeSingle();
    if (!data)
      return {
        ok: false,
        message: "본인 발행 스탬프북 프리셋이 아니거나 찾을 수 없습니다.",
      };
    nameSnapshot = data.name;
  } else if (type === "FM_SESSION_PRESET") {
    // 가벼운 안: 마스터 테이블 없이 메타만 사용
    // item_id 는 더미 uuid (랜덤), 실제 검증 없음. nameSnapshot 은 사용자 입력 note 활용 권장.
    nameSnapshot = "토리FM 세션";
  } else {
    return {
      ok: false,
      message: `${meta.label} 은 추후 지원 예정입니다.`,
    };
  }

  // 3) 중복 검사 (같은 template + type + id 는 1개만)
  const { data: dup } = await (
    supabase.from("partner_event_template_items" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<{
                data: { id: string } | null;
                error: unknown;
              }>;
            };
          };
        };
      };
    }
  )
    .select("id")
    .eq("template_id", templateId)
    .eq("item_type", type)
    .eq("item_id", itemId)
    .maybeSingle();

  if (dup) return { ok: false, message: "이미 추가된 항목입니다." };

  // 4) 다음 sort_order 계산
  const { data: maxRow } = await (
    supabase.from("partner_event_template_items" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => {
            limit: (n: number) => Promise<{
              data: { sort_order: number }[] | null;
              error: unknown;
            }>;
          };
        };
      };
    }
  )
    .select("sort_order")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder =
    maxRow && maxRow.length > 0 ? (maxRow[0].sort_order ?? 100) + 10 : 100;

  // 5) INSERT
  const { error } = await (
    supabase.from("partner_event_template_items" as never) as unknown as {
      insert: (r: Record<string, unknown>) => Promise<{
        error: { message: string } | null;
      }>;
    }
  ).insert({
    template_id: templateId,
    item_type: type,
    item_id: itemId,
    item_name_snapshot: nameSnapshot,
    sort_order: nextOrder,
    is_required: true,
    required_feature_code: meta.required_feature_code,
    note: note ?? null,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/partner/event-templates/${templateId}/edit`);
  return { ok: true };
}

/**
 * FM_SESSION_PRESET 추가 — 가벼운 안: 마스터 테이블 없이 name·note 만 받음.
 * - item_id 는 새 uuid 생성 (DB NOT NULL 제약 충족용 placeholder)
 * - item_name_snapshot = name
 * - note = 진행 노트
 */
export async function addFmSessionPresetItemAction(
  templateId: string,
  name: string,
  note?: string
): Promise<ActionResult> {
  const partner = await requirePartnerWithRole(["OWNER", "MANAGER"]);
  const own = await ensureOwner(partner.id, templateId);
  if (!own.ok) return own;

  // TORI_FM feature 보유 확인
  const ok = await hasFeature(partner.id, "TORI_FM");
  if (!ok)
    return {
      ok: false,
      message: "토리FM 기능(TORI_FM) 미보유 — 본사에 문의해주세요.",
    };

  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100)
    return { ok: false, message: "세션 이름은 1~100자" };

  const supabase = await createClient();

  // 다음 sort_order
  const { data: maxRow } = await (
    supabase.from("partner_event_template_items" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => {
            limit: (n: number) => Promise<{
              data: { sort_order: number }[] | null;
              error: unknown;
            }>;
          };
        };
      };
    }
  )
    .select("sort_order")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder =
    maxRow && maxRow.length > 0 ? (maxRow[0].sort_order ?? 100) + 10 : 100;

  const placeholderId = crypto.randomUUID();

  const { error } = await (
    supabase.from("partner_event_template_items" as never) as unknown as {
      insert: (r: Record<string, unknown>) => Promise<{
        error: { message: string } | null;
      }>;
    }
  ).insert({
    template_id: templateId,
    item_type: "FM_SESSION_PRESET",
    item_id: placeholderId,
    item_name_snapshot: trimmed,
    sort_order: nextOrder,
    is_required: true,
    required_feature_code: "TORI_FM",
    note: note?.trim() || null,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/partner/event-templates/${templateId}/edit`);
  return { ok: true };
}

export async function removeTemplateItemAction(
  itemId: string
): Promise<ActionResult> {
  const partner = await requirePartnerWithRole(["OWNER", "MANAGER"]);

  const supabase = await createClient();

  // 본인 템플릿인지 확인
  const { data: item } = await (
    supabase.from("partner_event_template_items" as never) as unknown as {
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
    .eq("id", itemId)
    .maybeSingle();

  if (!item) return { ok: false, message: "항목을 찾을 수 없습니다." };
  if (item.partner_event_templates?.partner_id !== partner.id)
    return { ok: false, message: "권한이 없습니다." };

  const { error } = await (
    supabase.from("partner_event_template_items" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .delete()
    .eq("id", itemId);

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/partner/event-templates/${item.template_id}/edit`);
  return { ok: true };
}
