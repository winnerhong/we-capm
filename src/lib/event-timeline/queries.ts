// 행사 타임테이블 슬롯 — 서버 쿼리.

import { createClient } from "@/lib/supabase/server";
import type { TimelineSlotRow } from "./types";

type SbResp<T> = { data: T[] | null; error: unknown };
type SbRespOne<T> = { data: T | null; error: unknown };

const COLUMNS =
  "id, event_id, starts_at, ends_at, title, description, slot_kind, ref_id, icon_emoji, location, display_order, created_at, updated_at";

/**
 * 한 행사의 모든 타임라인 슬롯 (시작 시각 → display_order 순).
 */
export async function loadTimelineSlots(
  eventId: string
): Promise<TimelineSlotRow[]> {
  if (!eventId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("org_event_timeline_slots" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<SbResp<TimelineSlotRow>>;
          };
        };
      };
    }
  )
    .select(COLUMNS)
    .eq("event_id", eventId)
    .order("starts_at", { ascending: true })
    .order("display_order", { ascending: true })) as SbResp<TimelineSlotRow>;

  return resp.data ?? [];
}

/**
 * 단일 슬롯 조회 (편집 폼).
 */
export async function loadTimelineSlot(
  slotId: string
): Promise<TimelineSlotRow | null> {
  if (!slotId) return null;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("org_event_timeline_slots" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<TimelineSlotRow>>;
        };
      };
    }
  )
    .select(COLUMNS)
    .eq("id", slotId)
    .maybeSingle()) as SbRespOne<TimelineSlotRow>;

  return resp.data;
}
