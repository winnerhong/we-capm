/**
 * 행사 템플릿(패키지) 타입.
 * - DB: partner_event_templates / partner_event_template_items / partner_event_template_assignments
 * - 마이그레이션: supabase/migrations/20260620000000_event_templates.sql
 */

export const TEMPLATE_VISIBILITIES = ["ALL", "SELECTED", "PRIVATE"] as const;
export type TemplateVisibility = (typeof TEMPLATE_VISIBILITIES)[number];

export const TEMPLATE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export const TEMPLATE_ITEM_TYPES = [
  "PROGRAM",
  "TRAIL",
  "STAMPBOOK_PRESET",
  "MISSION_PACK",
  "FM_SESSION_PRESET",
] as const;
export type TemplateItemType = (typeof TEMPLATE_ITEM_TYPES)[number];

export type PartnerEventTemplate = {
  id: string;
  partner_id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  cover_image_url: string | null;
  recommended_duration_hours: number | null;
  recommended_capacity_min: number | null;
  recommended_capacity_max: number | null;
  visibility: TemplateVisibility;
  status: TemplateStatus;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

export type PartnerEventTemplateItem = {
  id: string;
  template_id: string;
  item_type: TemplateItemType;
  item_id: string;
  item_name_snapshot: string | null;
  sort_order: number;
  is_required: boolean;
  required_feature_code: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export const TIMETABLE_SLOT_KINDS = [
  "MISSION",
  "STAMPBOOK",
  "FM_SESSION",
  "BROADCAST",
  "TRAIL",
  "FREE",
  "MEAL",
  "BREAK",
  "CUSTOM",
] as const;
export type TimetableSlotKind = (typeof TIMETABLE_SLOT_KINDS)[number];

export type PartnerEventTemplateTimetableSlot = {
  id: string;
  template_id: string;
  offset_min: number;
  duration_min: number | null;
  title: string;
  description: string | null;
  slot_kind: TimetableSlotKind;
  icon_emoji: string | null;
  location: string | null;
  ref_item_id: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export const SLOT_KIND_META: Record<
  TimetableSlotKind,
  { label: string; emoji: string }
> = {
  MISSION: { label: "미션", emoji: "🎯" },
  STAMPBOOK: { label: "스탬프북", emoji: "📚" },
  FM_SESSION: { label: "토리FM", emoji: "📻" },
  BROADCAST: { label: "돌발 방송", emoji: "📢" },
  TRAIL: { label: "숲길", emoji: "🥾" },
  FREE: { label: "자유", emoji: "🌿" },
  MEAL: { label: "식사", emoji: "🍱" },
  BREAK: { label: "휴식", emoji: "☕" },
  CUSTOM: { label: "기타", emoji: "🔧" },
};

export const VISIBILITY_META: Record<
  TemplateVisibility,
  { label: string; emoji: string; desc: string }
> = {
  ALL: {
    label: "전체 공개",
    emoji: "🌍",
    desc: "모든 기관이 카탈로그에서 볼 수 있어요",
  },
  SELECTED: {
    label: "지정 기관",
    emoji: "🎯",
    desc: "특정 기관에만 노출",
  },
  PRIVATE: {
    label: "비공개",
    emoji: "🔒",
    desc: "지사 내부 작업용 (기관에 보이지 않음)",
  },
};

export const TEMPLATE_STATUS_META: Record<
  TemplateStatus,
  { label: string; bg: string; text: string }
> = {
  DRAFT: { label: "작성중", bg: "bg-slate-100", text: "text-slate-700" },
  PUBLISHED: { label: "공개", bg: "bg-emerald-100", text: "text-emerald-800" },
  ARCHIVED: { label: "보관", bg: "bg-rose-100", text: "text-rose-800" },
};

export const ITEM_TYPE_META: Record<
  TemplateItemType,
  { label: string; emoji: string; required_feature_code: string | null }
> = {
  PROGRAM: {
    label: "프로그램",
    emoji: "🗺️",
    required_feature_code: null, // 기본팩의 EVENT_BASIC 으로 충분
  },
  TRAIL: { label: "숲길", emoji: "🥾", required_feature_code: "TRAIL" },
  STAMPBOOK_PRESET: {
    label: "스탬프북 프리셋",
    emoji: "📚",
    required_feature_code: "STAMPBOOK",
  },
  MISSION_PACK: {
    label: "미션 팩",
    emoji: "🎯",
    required_feature_code: "MISSION_LIB",
  },
  FM_SESSION_PRESET: {
    label: "토리FM 세션 프리셋",
    emoji: "📻",
    required_feature_code: "TORI_FM",
  },
};
