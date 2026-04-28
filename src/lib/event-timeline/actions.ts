"use server";

// 행사 타임테이블 슬롯 — 서버 액션 (CRUD).
// 권한: requireOrg() 로 기관 인증 + event 소유 검증.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgEventById } from "@/lib/org-events/queries";
import { loadTimelineSlot } from "./queries";
import type { SlotKind } from "./types";

type Row = Record<string, unknown>;
type SbErr = { message: string; code?: string } | null;

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

function clampString(raw: string | null | undefined, max: number): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function parseSlotKind(raw: unknown): SlotKind {
  const s = String(raw ?? "");
  if ((VALID_KINDS as string[]).includes(s)) return s as SlotKind;
  return "CUSTOM";
}

function parseDatetimeLocal(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  // datetime-local 입력값은 timezone 없는 ISO ("2026-04-23T10:00").
  // KST 로 가정하고 UTC ISO 로 변환. 단순하게 new Date(s) 는 로컬타임으로 파싱하므로
  // 서버 환경 timezone 영향 받음 — KST(+09:00) 명시 추가.
  const withTz = s.includes("T") && !s.endsWith("Z") && !/[+-]\d\d:?\d\d$/.test(s)
    ? `${s}:00+09:00`
    : s;
  const d = new Date(withTz);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

async function assertEventOwnedByOrg(eventId: string, orgId: string) {
  const event = await loadOrgEventById(eventId);
  if (!event) throw new Error("행사를 찾을 수 없어요");
  if (event.org_id !== orgId) throw new Error("권한이 없어요");
}

/**
 * 슬롯 추가.
 */
export async function createTimelineSlotAction(
  eventId: string,
  formData: FormData
): Promise<void> {
  const session = await requireOrg();
  if (!eventId) throw new Error("행사를 찾을 수 없어요");
  await assertEventOwnedByOrg(eventId, session.orgId);

  const title = clampString(String(formData.get("title") ?? ""), 100);
  if (!title) throw new Error("제목을 입력해 주세요");

  const startsAt = parseDatetimeLocal(formData.get("starts_at"));
  if (!startsAt) throw new Error("시작 시각을 입력해 주세요");
  const endsAt = parseDatetimeLocal(formData.get("ends_at"));

  const slotKind = parseSlotKind(formData.get("slot_kind"));
  const description = clampString(String(formData.get("description") ?? ""), 500);
  const location = clampString(String(formData.get("location") ?? ""), 100);
  const iconEmoji = clampString(String(formData.get("icon_emoji") ?? ""), 8);

  const orderRaw = String(formData.get("display_order") ?? "0").trim();
  const displayOrder = (() => {
    const n = parseInt(orderRaw, 10);
    return Number.isFinite(n) ? n : 0;
  })();

  const supabase = await createClient();
  const insertResp = (await (
    supabase.from("org_event_timeline_slots" as never) as unknown as {
      insert: (r: Row) => Promise<{ error: SbErr }>;
    }
  ).insert({
    event_id: eventId,
    starts_at: startsAt,
    ends_at: endsAt,
    title,
    description,
    slot_kind: slotKind,
    icon_emoji: iconEmoji,
    location,
    display_order: displayOrder,
  } satisfies Row)) as { error: SbErr };

  if (insertResp.error) {
    console.error("[timeline/create] error", {
      code: insertResp.error.code,
      message: insertResp.error.message,
    });
    throw new Error(`슬롯 추가 실패: ${insertResp.error.message ?? "unknown"}`);
  }

  revalidatePath(`/org/${session.orgId}/events/${eventId}`);
}

/**
 * 슬롯 수정.
 */
export async function updateTimelineSlotAction(
  slotId: string,
  formData: FormData
): Promise<void> {
  const session = await requireOrg();
  if (!slotId) throw new Error("슬롯을 찾을 수 없어요");

  const slot = await loadTimelineSlot(slotId);
  if (!slot) throw new Error("슬롯을 찾을 수 없어요");
  await assertEventOwnedByOrg(slot.event_id, session.orgId);

  const title = clampString(String(formData.get("title") ?? ""), 100);
  if (!title) throw new Error("제목을 입력해 주세요");

  const startsAt = parseDatetimeLocal(formData.get("starts_at"));
  if (!startsAt) throw new Error("시작 시각을 입력해 주세요");
  const endsAt = parseDatetimeLocal(formData.get("ends_at"));

  const slotKind = parseSlotKind(formData.get("slot_kind"));
  const description = clampString(String(formData.get("description") ?? ""), 500);
  const location = clampString(String(formData.get("location") ?? ""), 100);
  const iconEmoji = clampString(String(formData.get("icon_emoji") ?? ""), 8);

  const orderRaw = String(formData.get("display_order") ?? "0").trim();
  const displayOrder = (() => {
    const n = parseInt(orderRaw, 10);
    return Number.isFinite(n) ? n : 0;
  })();

  const supabase = await createClient();
  const updResp = (await (
    supabase.from("org_event_timeline_slots" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      starts_at: startsAt,
      ends_at: endsAt,
      title,
      description,
      slot_kind: slotKind,
      icon_emoji: iconEmoji,
      location,
      display_order: displayOrder,
    } satisfies Row)
    .eq("id", slotId)) as { error: SbErr };

  if (updResp.error) {
    console.error("[timeline/update] error", { code: updResp.error.code });
    throw new Error("슬롯 수정 실패");
  }

  revalidatePath(`/org/${session.orgId}/events/${slot.event_id}`);
}

/**
 * 슬롯 삭제.
 */
/**
 * 슬롯 레이아웃 일괄 갱신.
 *
 * 새 모델: 폼은 시각을 입력받지 않고 "소요시간(분) + 순서" 만 받는다.
 * 시작/종료 시각은 행사 starts_at + 누적 duration_min 으로 서버가 계산.
 *
 * - id 가 있는 항목 → UPDATE
 * - id 가 없는 항목 → INSERT (event_id 자동 주입)
 * - DB 에 있는데 list 에 없는 슬롯 → DELETE
 *
 * 호출 컨벤션: 클라이언트가 "현재 화면 상태의 전체 슬롯 배열" 을 보내면
 * 서버는 이 배열이 행사의 새 layout 이라고 가정하고 동기화한다.
 */
export async function resyncTimelineSlotsAction(
  eventId: string,
  items: Array<{
    id?: string | null;
    slot_kind: SlotKind;
    title: string;
    description?: string | null;
    location?: string | null;
    icon_emoji?: string | null;
    duration_min: number;
  }>
): Promise<void> {
  const session = await requireOrg();
  if (!eventId) throw new Error("행사를 찾을 수 없어요");

  const event = await loadOrgEventById(eventId);
  if (!event) throw new Error("행사를 찾을 수 없어요");
  if (event.org_id !== session.orgId) throw new Error("권한이 없어요");
  if (!event.starts_at) throw new Error("행사 시작 시각이 비어 있어요");

  const supabase = await createClient();

  // 기존 슬롯 id 목록 — 사라진 건 DELETE
  const existingResp = (await (
    supabase.from("org_event_timeline_slots" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{ data: { id: string }[] | null; error: SbErr }>;
      };
    }
  )
    .select("id")
    .eq("event_id", eventId)) as { data: { id: string }[] | null; error: SbErr };

  if (existingResp.error) {
    throw new Error(`슬롯 조회 실패: ${existingResp.error.message ?? "unknown"}`);
  }

  const existingIds = new Set((existingResp.data ?? []).map((r) => r.id));
  const incomingIds = new Set(
    items
      .map((i) => i.id)
      .filter((v): v is string => typeof v === "string" && v.length > 0)
  );
  const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));

  if (toDelete.length > 0) {
    const delResp = (await (
      supabase.from("org_event_timeline_slots" as never) as unknown as {
        delete: () => {
          in: (k: string, v: string[]) => Promise<{ error: SbErr }>;
        };
      }
    )
      .delete()
      .in("id", toDelete)) as { error: SbErr };
    if (delResp.error) {
      throw new Error(`슬롯 삭제 실패: ${delResp.error.message ?? "unknown"}`);
    }
  }

  // 시작/종료 시각 prefix-sum 계산
  let cursorMs = new Date(event.starts_at).getTime();
  if (!Number.isFinite(cursorMs)) {
    throw new Error("행사 시작 시각이 유효하지 않아요");
  }

  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    const title = clampString(it.title, 100);
    if (!title) throw new Error(`${idx + 1}번 슬롯 제목을 입력해 주세요`);

    const duration = Math.max(5, Math.round(Number(it.duration_min) / 5) * 5);
    const startsAt = new Date(cursorMs).toISOString();
    cursorMs += duration * 60_000;
    const endsAt = new Date(cursorMs).toISOString();

    const payload: Row = {
      starts_at: startsAt,
      ends_at: endsAt,
      title,
      description: clampString(it.description ?? null, 500),
      slot_kind: parseSlotKind(it.slot_kind),
      icon_emoji: clampString(it.icon_emoji ?? null, 8),
      location: clampString(it.location ?? null, 100),
      display_order: idx,
    };

    if (it.id) {
      const updResp = (await (
        supabase.from("org_event_timeline_slots" as never) as unknown as {
          update: (p: Row) => {
            eq: (k: string, v: string) => Promise<{ error: SbErr }>;
          };
        }
      )
        .update(payload)
        .eq("id", it.id)) as { error: SbErr };
      if (updResp.error) {
        throw new Error(`슬롯 수정 실패: ${updResp.error.message ?? "unknown"}`);
      }
    } else {
      const insResp = (await (
        supabase.from("org_event_timeline_slots" as never) as unknown as {
          insert: (r: Row) => Promise<{ error: SbErr }>;
        }
      ).insert({ ...payload, event_id: eventId } satisfies Row)) as {
        error: SbErr;
      };
      if (insResp.error) {
        throw new Error(`슬롯 추가 실패: ${insResp.error.message ?? "unknown"}`);
      }
    }
  }

  revalidatePath(`/org/${session.orgId}/events/${eventId}`);
}

/**
 * 슬롯 삭제 (단일).
 */
export async function deleteTimelineSlotAction(slotId: string): Promise<void> {
  const session = await requireOrg();
  if (!slotId) throw new Error("슬롯을 찾을 수 없어요");

  const slot = await loadTimelineSlot(slotId);
  if (!slot) return;
  await assertEventOwnedByOrg(slot.event_id, session.orgId);

  const supabase = await createClient();
  const delResp = (await (
    supabase.from("org_event_timeline_slots" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .delete()
    .eq("id", slotId)) as { error: SbErr };

  if (delResp.error) {
    console.error("[timeline/delete] error", { code: delResp.error.code });
    throw new Error("슬롯 삭제 실패");
  }

  revalidatePath(`/org/${session.orgId}/events/${slot.event_id}`);
}
