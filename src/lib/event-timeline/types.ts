// 행사 타임테이블 슬롯 — 공용 타입.
// DB migration: 20260606000000_event_timeline_slots.sql 와 1:1 대응.

export type SlotKind =
  | "MISSION"
  | "STAMPBOOK"
  | "FM_SESSION"
  | "BROADCAST"
  | "TRAIL"
  | "FREE"
  | "MEAL"
  | "BREAK"
  | "CUSTOM";

export interface TimelineSlotRow {
  id: string;
  event_id: string;
  starts_at: string;
  ends_at: string | null;
  title: string;
  description: string | null;
  slot_kind: SlotKind;
  ref_id: string | null;
  icon_emoji: string | null;
  location: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * slot_kind 별 메타 — 라벨, 기본 아이콘, 색조.
 * UI 에서 카드 톤·아이콘 결정 시 사용.
 */
export const SLOT_KIND_META: Record<
  SlotKind,
  { label: string; defaultEmoji: string; tone: string }
> = {
  MISSION: {
    label: "미션",
    defaultEmoji: "🎯",
    tone: "amber",
  },
  STAMPBOOK: {
    label: "스탬프북",
    defaultEmoji: "📚",
    tone: "emerald",
  },
  FM_SESSION: {
    label: "토리FM",
    defaultEmoji: "📻",
    tone: "rose",
  },
  BROADCAST: {
    label: "돌발 미션",
    defaultEmoji: "📡",
    tone: "fuchsia",
  },
  TRAIL: {
    label: "숲길",
    defaultEmoji: "🪜",
    tone: "emerald",
  },
  FREE: {
    label: "자유시간",
    defaultEmoji: "🌳",
    tone: "sky",
  },
  MEAL: {
    label: "식사",
    defaultEmoji: "🍽",
    tone: "amber",
  },
  BREAK: {
    label: "휴식",
    defaultEmoji: "☕",
    tone: "zinc",
  },
  CUSTOM: {
    label: "기타",
    defaultEmoji: "📌",
    tone: "zinc",
  },
};

export const SLOT_KIND_OPTIONS: { value: SlotKind; label: string; emoji: string }[] =
  (Object.keys(SLOT_KIND_META) as SlotKind[]).map((k) => ({
    value: k,
    label: SLOT_KIND_META[k].label,
    emoji: SLOT_KIND_META[k].defaultEmoji,
  }));
