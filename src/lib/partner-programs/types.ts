export type ProgramVisibility = "DRAFT" | "ALL" | "SELECTED" | "ARCHIVED";

export const VISIBILITY_META = {
  DRAFT: {
    label: "초안",
    icon: "✏️",
    color: "bg-zinc-50 text-zinc-700 border-zinc-200",
    desc: "작성 중 · 기관 노출 안 됨",
  },
  ALL: {
    label: "전체 공개",
    icon: "🌍",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
    desc: "모든 기관에게 자동 노출",
  },
  SELECTED: {
    label: "선택 공개",
    icon: "🎯",
    color: "bg-sky-50 text-sky-800 border-sky-200",
    desc: "지정한 기관에만 노출",
  },
  ARCHIVED: {
    label: "보관",
    icon: "📦",
    color: "bg-zinc-100 text-zinc-600 border-zinc-300",
    desc: "목록에서 숨김",
  },
} as const satisfies Record<
  ProgramVisibility,
  { label: string; icon: string; color: string; desc: string }
>;

export const VISIBILITY_OPTIONS: ProgramVisibility[] = [
  "DRAFT",
  "ALL",
  "SELECTED",
  "ARCHIVED",
];

export interface ScheduleItem {
  time: string; // "10:00" or "10:00-11:00"
  title: string;
  desc?: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface PartnerProgramRow {
  id: string;
  partner_id: string;
  title: string;
  description: string | null;
  long_description: string | null;
  category: string;
  duration_hours: number | null;
  capacity_min: number;
  capacity_max: number;
  price_per_person: number;
  b2b_price_per_person: number | null;
  location_region: string | null;
  location_detail: string | null;
  image_url: string | null;
  images: string[];
  tags: string[] | null;
  schedule_items: ScheduleItem[];
  required_items: string[];
  safety_notes: string | null;
  target_audience: string | null;
  faq: FaqItem[];
  linked_trail_id: string | null;
  visibility: ProgramVisibility;
  is_published: boolean; // deprecated, visibility로 대체 (지금은 유지)
  rating_avg: number | null;
  rating_count: number;
  booking_count: number;
  created_at: string;
}

export interface ProgramAssignmentRow {
  id: string;
  program_id: string;
  org_id: string;
  assigned_by: string | null;
  assigned_at: string;
}
