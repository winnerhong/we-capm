// partner_timetable_templates row 타입. 클라이언트/서버 양쪽 import 가능.

import type { SlotKind } from "@/lib/event-timeline/types";

export interface PartnerTimetableTemplateSlot {
  id: string;
  template_id: string;
  slot_kind: SlotKind;
  title: string;
  description: string | null;
  location: string | null;
  icon_emoji: string | null;
  /** 슬롯 소요시간(분). org_event_timeline_slots 와 동일 모델. */
  duration_min: number;
  sort_order: number;
}

export interface PartnerTimetableTemplateRow {
  id: string;
  partner_id: string;
  name: string;
  description: string | null;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  /** 항상 sort_order 오름차순으로 정렬된 슬롯 배열. */
  slots: PartnerTimetableTemplateSlot[];
}
