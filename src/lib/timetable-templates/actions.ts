"use server";

// partner_timetable_templates CRUD — 지사 타임테이블 기본 템플릿.
// requirePartner 로 소유 partner_id 확인 후 작업.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";
import type { SlotKind } from "@/lib/event-timeline/types";

type Row = Record<string, unknown>;
type SbErr = { message: string; code?: string } | null;
type SbRespOne<T> = { data: T | null; error: SbErr };
type SbResp<T> = { data: T[] | null; error: SbErr };

const VALID_KINDS: SlotKind[] = [
  "MISSION",
  "STAMPBOOK",
  "FM_SESSION",
  "BROADCAST",
  "TRAIL",
  "FREE",
  "MEAL",
  "BREAK",
  "CUSTOM",
];

function parseSlotKind(raw: unknown): SlotKind {
  const s = String(raw ?? "");
  return (VALID_KINDS as string[]).includes(s) ? (s as SlotKind) : "CUSTOM";
}

function clamp(raw: string | null | undefined, max: number): string | null {
  if (!raw) return null;
  const t = String(raw).trim();
  return t ? t.slice(0, max) : null;
}

function revalidateAll() {
  revalidatePath("/partner/timetable-templates");
  // org 측 행사 타임테이블 탭에서도 템플릿 셀렉터를 SSR 로드 → layout 단위 무효.
  revalidatePath("/org", "layout");
}

export interface TemplateSlotInput {
  slot_kind: string;
  title: string;
  description?: string | null;
  location?: string | null;
  icon_emoji?: string | null;
  duration_min: number;
}

/**
 * 템플릿 + 슬롯 일괄 저장.
 *  - id 없음 → 새 템플릿 생성
 *  - id 있음 → 소유 검증 후 이름/설명 갱신
 *  - 슬롯은 항상 전체 삭제 후 재삽입 (템플릿 슬롯 id 를 참조하는 곳이 없어 안전).
 */
export async function saveTimetableTemplateAction(input: {
  id?: string | null;
  name: string;
  description?: string | null;
  slots: TemplateSlotInput[];
}): Promise<{ id: string }> {
  const partner = await requirePartner();
  const name = (input.name ?? "").trim();
  if (!name) throw new Error("템플릿 이름을 입력해 주세요");
  const description = clamp(input.description ?? null, 500);

  const supabase = await createClient();
  let templateId = (input.id ?? "").trim() || null;

  if (templateId) {
    const ownResp = (await (
      supabase.from("partner_timetable_templates" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<SbRespOne<{ partner_id: string }>>;
          };
        };
      }
    )
      .select("partner_id")
      .eq("id", templateId)
      .maybeSingle()) as SbRespOne<{ partner_id: string }>;
    if (!ownResp.data) throw new Error("템플릿을 찾을 수 없어요");
    if (ownResp.data.partner_id !== partner.id) {
      throw new Error("다른 지사의 템플릿이에요");
    }

    const upd = (await (
      supabase.from("partner_timetable_templates" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      }
    )
      .update({
        name: name.slice(0, 80),
        description,
        updated_at: new Date().toISOString(),
      } satisfies Row)
      .eq("id", templateId)) as { error: SbErr };
    if (upd.error) {
      console.error("[timetable-templates/update] error", upd.error);
      throw new Error("템플릿 저장에 실패했어요");
    }
  } else {
    const maxResp = (await (
      supabase.from("partner_timetable_templates" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => {
              limit: (n: number) => Promise<SbResp<{ sort_order: number }>>;
            };
          };
        };
      }
    )
      .select("sort_order")
      .eq("partner_id", partner.id)
      .order("sort_order", { ascending: false })
      .limit(1)) as SbResp<{ sort_order: number }>;
    const nextOrder = ((maxResp.data ?? [])[0]?.sort_order ?? 0) + 10;

    const insResp = (await (
      supabase.from("partner_timetable_templates" as never) as unknown as {
        insert: (r: Row) => {
          select: (c: string) => {
            maybeSingle: () => Promise<SbRespOne<{ id: string }>>;
          };
        };
      }
    )
      .insert({
        partner_id: partner.id,
        name: name.slice(0, 80),
        description,
        sort_order: nextOrder,
      } satisfies Row)
      .select("id")
      .maybeSingle()) as SbRespOne<{ id: string }>;
    if (!insResp.data?.id) {
      console.error("[timetable-templates/create] failed", insResp.error);
      throw new Error("템플릿 생성에 실패했어요");
    }
    templateId = insResp.data.id;
  }

  // 슬롯 전체 교체 — 기존 삭제 후 재삽입
  const del = (await (
    supabase.from("partner_timetable_template_slots" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .delete()
    .eq("template_id", templateId)) as { error: SbErr };
  if (del.error) {
    console.error("[timetable-templates/slots-delete] error", del.error);
    throw new Error("슬롯 저장에 실패했어요");
  }

  const rows = input.slots
    .map((s, idx): Row | null => {
      const title = clamp(s.title, 100);
      if (!title) return null;
      const duration = Math.max(
        5,
        Math.min(600, Math.round(Number(s.duration_min) / 5) * 5)
      );
      return {
        template_id: templateId,
        slot_kind: parseSlotKind(s.slot_kind),
        title,
        description: clamp(s.description ?? null, 500),
        location: clamp(s.location ?? null, 100),
        icon_emoji: clamp(s.icon_emoji ?? null, 8),
        duration_min: Number.isFinite(duration) ? duration : 15,
        sort_order: idx * 10,
      };
    })
    .filter((r): r is Row => r !== null);

  if (rows.length > 0) {
    const ins = (await (
      supabase.from("partner_timetable_template_slots" as never) as unknown as {
        insert: (r: Row[]) => Promise<{ error: SbErr }>;
      }
    ).insert(rows)) as { error: SbErr };
    if (ins.error) {
      console.error("[timetable-templates/slots-insert] error", ins.error);
      throw new Error("슬롯 저장에 실패했어요");
    }
  }

  revalidateAll();
  return { id: templateId };
}

async function assertOwner(templateId: string, partnerId: string) {
  const supabase = await createClient();
  const resp = (await (
    supabase.from("partner_timetable_templates" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<{ partner_id: string }>>;
        };
      };
    }
  )
    .select("partner_id")
    .eq("id", templateId)
    .maybeSingle()) as SbRespOne<{ partner_id: string }>;
  if (!resp.data) throw new Error("템플릿을 찾을 수 없어요");
  if (resp.data.partner_id !== partnerId) {
    throw new Error("다른 지사의 템플릿이에요");
  }
}

export async function archiveTimetableTemplateAction(
  id: string,
  archive: boolean = true
): Promise<void> {
  const partner = await requirePartner();
  if (!id) throw new Error("템플릿을 찾을 수 없어요");
  await assertOwner(id, partner.id);
  const supabase = await createClient();

  const upd = (await (
    supabase.from("partner_timetable_templates" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      is_archived: archive,
      updated_at: new Date().toISOString(),
    } satisfies Row)
    .eq("id", id)) as { error: SbErr };
  if (upd.error) {
    console.error("[timetable-templates/archive] error", upd.error);
    throw new Error("보관 처리에 실패했어요");
  }
  revalidateAll();
}

export async function deleteTimetableTemplateAction(
  id: string
): Promise<void> {
  const partner = await requirePartner();
  if (!id) throw new Error("템플릿을 찾을 수 없어요");
  await assertOwner(id, partner.id);
  const supabase = await createClient();

  const del = (await (
    supabase.from("partner_timetable_templates" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .delete()
    .eq("id", id)) as { error: SbErr };
  if (del.error) {
    console.error("[timetable-templates/delete] error", del.error);
    throw new Error("템플릿 삭제에 실패했어요");
  }
  revalidateAll();
}
