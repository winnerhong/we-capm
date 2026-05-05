"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org-auth-guard";
import { hasFeature } from "@/lib/features/guard";
import {
  getTemplateById,
  listTemplateItems,
  listTemplateTimetable,
  listAvailableTemplatesForOrg,
} from "@/lib/event-templates/queries";
import { ITEM_TYPE_META } from "@/lib/event-templates/types";

type ImportResult =
  | {
      ok: true;
      eventId: string;
      copiedPrograms: number;
      copiedSlots: number;
      copiedTrails: number;
      copiedPresets: number;
      copiedFmSessions: number;
      skippedItems: { type: string; name: string; reason: string }[];
    }
  | { ok: false; message: string };

type PartnerProgramRow = {
  id: string;
  partner_id: string;
  title: string;
  description: string | null;
  category: string | null;
  duration_hours: number | null;
  capacity_min: number | null;
  capacity_max: number | null;
  price_per_person: number | null;
  location_detail: string | null;
  image_url: string | null;
  tags: unknown;
  parking_lots: unknown;
  meeting_point: unknown;
};

/**
 * 행사 템플릿을 기관 행사로 가져오기.
 * - org_events 1건 INSERT (name/시작·종료/설명/cover/source_event_template_id)
 * - PROGRAM 항목들 → org_programs 스냅샷 복사 (지사가 해당 feature 보유 시에만)
 * - TRAIL/STAMPBOOK_PRESET/MISSION_PACK/FM_SESSION_PRESET 은 추후 phase. skip 목록 반환.
 */
export async function importEventTemplateAction(
  templateId: string,
  formData: FormData
): Promise<ImportResult> {
  const session = await requireOrg();
  const supabase = await createClient();

  // 0) 템플릿 + 항목 조회
  const template = await getTemplateById(templateId);
  if (!template) return { ok: false, message: "템플릿을 찾을 수 없습니다." };
  if (template.is_deleted || template.status !== "PUBLISHED")
    return { ok: false, message: "사용할 수 없는 템플릿입니다." };

  // 1) 접근 권한 확인 (visibility ALL 이거나 이 기관에 assigned 인지)
  const accessible = await listAvailableTemplatesForOrg(session.orgId);
  const allowed = accessible.some((t) => t.id === templateId);
  if (!allowed) return { ok: false, message: "이 템플릿에 접근 권한이 없습니다." };

  const items = await listTemplateItems(templateId);
  const slots = await listTemplateTimetable(templateId);

  // 2) 입력값
  const nameOverride = String(formData.get("name") ?? "").trim();
  const name = nameOverride || template.name;
  const startsAtStr = String(formData.get("starts_at") ?? "").trim();
  const endsAtStr = String(formData.get("ends_at") ?? "").trim();
  if (!startsAtStr) return { ok: false, message: "시작 일시를 입력해주세요." };
  if (!endsAtStr) return { ok: false, message: "종료 일시를 입력해주세요." };

  let startsAt: string;
  let endsAt: string;
  try {
    startsAt = new Date(startsAtStr).toISOString();
    endsAt = new Date(endsAtStr).toISOString();
  } catch {
    return { ok: false, message: "일시 형식이 올바르지 않습니다." };
  }
  if (new Date(endsAt).getTime() < new Date(startsAt).getTime())
    return { ok: false, message: "종료 일시는 시작 일시 이후여야 합니다." };

  // 3) 행사 INSERT
  const { data: createdEvent, error: e1 } = await (
    supabase.from("org_events" as never) as unknown as {
      insert: (r: Record<string, unknown>) => {
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
      org_id: session.orgId,
      name,
      description: template.description,
      starts_at: startsAt,
      ends_at: endsAt,
      cover_image_url: template.cover_image_url,
      status: "DRAFT",
      source_event_template_id: template.id,
    })
    .select("id")
    .single();

  if (e1 || !createdEvent)
    return { ok: false, message: e1?.message ?? "행사 생성에 실패했습니다." };

  const eventId = createdEvent.id;
  let copiedPrograms = 0;
  let copiedSlots = 0;
  let copiedTrails = 0;
  let copiedPresets = 0;
  let copiedFmSessions = 0;
  const skipped: { type: string; name: string; reason: string }[] = [];

  // 4-1) 타임테이블 슬롯 — offset_min → 절대시각으로 환산해 INSERT
  if (slots.length > 0) {
    const startMs = new Date(startsAt).getTime();
    const slotRows = slots.map((s) => {
      const slotStart = new Date(startMs + s.offset_min * 60_000).toISOString();
      const slotEnd =
        s.duration_min != null
          ? new Date(
              startMs + (s.offset_min + s.duration_min) * 60_000
            ).toISOString()
          : null;
      return {
        event_id: eventId,
        starts_at: slotStart,
        ends_at: slotEnd,
        title: s.title,
        description: s.description,
        slot_kind: s.slot_kind,
        icon_emoji: s.icon_emoji,
        location: s.location,
        display_order: s.display_order,
      };
    });
    const { error: eSlot } = await (
      supabase.from("org_event_timeline_slots" as never) as unknown as {
        insert: (rows: Record<string, unknown>[]) => Promise<{
          error: { message: string } | null;
        }>;
      }
    ).insert(slotRows);
    if (eSlot) {
      skipped.push({
        type: "TIMETABLE",
        name: `${slots.length}개 슬롯`,
        reason: eSlot.message,
      });
    } else {
      copiedSlots = slots.length;
    }
  }

  // 4) 항목별 처리
  for (const item of items) {
    const meta = ITEM_TYPE_META[item.item_type];
    const itemName = item.item_name_snapshot ?? meta.label;

    // 지사가 해당 feature 보유 중인지 확인
    if (item.required_feature_code) {
      const ok = await hasFeature(template.partner_id, item.required_feature_code);
      if (!ok) {
        skipped.push({
          type: item.item_type,
          name: itemName,
          reason: `지사 ${item.required_feature_code} 미보유`,
        });
        continue;
      }
    }

    if (item.item_type === "PROGRAM") {
      // partner_programs → org_programs 스냅샷 복사 + org_event_programs 행사 연결
      const { data: src } = await (
        supabase.from("partner_programs" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<{
                data: PartnerProgramRow | null;
                error: unknown;
              }>;
            };
          };
        }
      )
        .select(
          "id,partner_id,title,description,category,duration_hours,capacity_min,capacity_max,price_per_person,location_detail,image_url,tags,parking_lots,meeting_point"
        )
        .eq("id", item.item_id)
        .maybeSingle();

      if (!src) {
        skipped.push({
          type: item.item_type,
          name: itemName,
          reason: "원본 프로그램이 삭제됨",
        });
        continue;
      }

      const { data: insertedProgram, error: e2 } = await (
        supabase.from("org_programs" as never) as unknown as {
          insert: (p: Record<string, unknown>) => {
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
          parking_lots: Array.isArray(src.parking_lots) ? src.parking_lots : [],
          meeting_point:
            src.meeting_point && typeof src.meeting_point === "object"
              ? src.meeting_point
              : null,
          custom_theme: {},
          status: "ACTIVATED",
          is_published: false,
        })
        .select("id")
        .single();

      if (e2 || !insertedProgram) {
        skipped.push({
          type: item.item_type,
          name: itemName,
          reason: e2?.message ?? "프로그램 복제 실패",
        });
        continue;
      }

      // 행사 ↔ 프로그램 junction INSERT (실패해도 program 자체는 살아있음)
      await (
        supabase.from("org_event_programs" as never) as unknown as {
          insert: (r: Record<string, unknown>) => Promise<{ error: unknown }>;
        }
      ).insert({ event_id: eventId, org_program_id: insertedProgram.id });

      copiedPrograms += 1;
    } else if (item.item_type === "TRAIL") {
      // partner_trails 의 partner_id 확인 + assignment 부여 + 행사 ↔ 숲길 junction
      const { data: trail } = await (
        supabase.from("partner_trails" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<{
                data: { id: string; partner_id: string } | null;
                error: unknown;
              }>;
            };
          };
        }
      )
        .select("id,partner_id")
        .eq("id", item.item_id)
        .maybeSingle();

      if (!trail) {
        skipped.push({
          type: item.item_type,
          name: itemName,
          reason: "원본 숲길이 삭제됨",
        });
        continue;
      }

      // assignment 부여 (이미 있으면 무시)
      await (
        supabase.from("partner_trail_assignments" as never) as unknown as {
          upsert: (
            r: Record<string, unknown>,
            o: { onConflict: string; ignoreDuplicates: boolean }
          ) => Promise<{ error: unknown }>;
        }
      ).upsert(
        {
          trail_id: trail.id,
          org_id: session.orgId,
        },
        { onConflict: "trail_id,org_id", ignoreDuplicates: true }
      );

      // 행사 ↔ 숲길 junction
      await (
        supabase.from("org_event_trails" as never) as unknown as {
          upsert: (
            r: Record<string, unknown>,
            o: { onConflict: string; ignoreDuplicates: boolean }
          ) => Promise<{ error: unknown }>;
        }
      ).upsert(
        { event_id: eventId, trail_id: trail.id },
        { onConflict: "event_id,trail_id", ignoreDuplicates: true }
      );

      copiedTrails += 1;
    } else if (item.item_type === "STAMPBOOK_PRESET") {
      // partner_stampbook_presets → org_quest_packs 기본 정보 복사 (DRAFT)
      const { data: preset } = await (
        supabase.from("partner_stampbook_presets" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<{
                data: {
                  id: string;
                  name: string;
                  description: string | null;
                  cover_image_url: string | null;
                } | null;
                error: unknown;
              }>;
            };
          };
        }
      )
        .select("id,name,description,cover_image_url")
        .eq("id", item.item_id)
        .maybeSingle();

      if (!preset) {
        skipped.push({
          type: item.item_type,
          name: itemName,
          reason: "원본 프리셋이 삭제됨",
        });
        continue;
      }

      const { error: ePack } = await (
        supabase.from("org_quest_packs" as never) as unknown as {
          insert: (r: Record<string, unknown>) => Promise<{
            error: { message: string } | null;
          }>;
        }
      ).insert({
        org_id: session.orgId,
        name: preset.name,
        description: preset.description,
        cover_image_url: preset.cover_image_url,
        layout_mode: "GRID",
        stamp_icon_set: "FOREST",
        status: "DRAFT",
        starts_at: startsAt,
        ends_at: endsAt,
      });

      if (ePack) {
        skipped.push({
          type: item.item_type,
          name: itemName,
          reason: ePack.message,
        });
        continue;
      }
      copiedPresets += 1;
    } else if (item.item_type === "FM_SESSION_PRESET") {
      // 가벼운 안: 빈 tori_fm_sessions 1개 INSERT (이름·노트 = item 메타)
      const sessionName = item.item_name_snapshot ?? "토리FM 세션";
      const { error: eFm } = await (
        supabase.from("tori_fm_sessions" as never) as unknown as {
          insert: (r: Record<string, unknown>) => Promise<{
            error: { message: string } | null;
          }>;
        }
      ).insert({
        org_id: session.orgId,
        event_id: eventId,
        name: sessionName,
        scheduled_start: startsAt,
        scheduled_end: endsAt,
        notes: item.note ?? null,
      });

      if (eFm) {
        skipped.push({
          type: item.item_type,
          name: itemName,
          reason: eFm.message,
        });
        continue;
      }
      copiedFmSessions += 1;
    } else {
      // MISSION_PACK 등 추후 지원
      skipped.push({
        type: item.item_type,
        name: itemName,
        reason: "추후 지원 예정",
      });
    }
  }

  revalidatePath(`/org/${session.orgId}/events`);
  revalidatePath(`/org/${session.orgId}/event-templates`);

  return {
    ok: true,
    eventId,
    copiedPrograms,
    copiedSlots,
    copiedTrails,
    copiedPresets,
    copiedFmSessions,
    skippedItems: skipped,
  };
}
