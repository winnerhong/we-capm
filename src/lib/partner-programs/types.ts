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

/** 주차장 정보. parent program 의 parking_lots(JSONB 배열) 한 항목. */
export interface ParkingLot {
  name: string; // 1~50자 (예: "정문 주차장")
  address: string; // 1~200자 (도로명 주소)
  capacity?: number; // 정수 0~9999 (수용 대수)
  fee?: string; // 1~50자 (예: "무료" / "1시간 무료" / "1,000원/시간")
  note?: string; // 1~200자 (진입 안내, 주의사항)
  image_url?: string; // 주차장 사진 (Supabase Storage public URL). 1~500자
}

/** 집결장소 단일. parent program 의 meeting_point(JSONB) 객체. */
export interface MeetingPoint {
  name: string; // 1~80자 (예: "센터 정문 광장")
  address: string; // 1~200자
  time?: string; // 1~50자 (예: "10:00 (시작 10분 전)")
  note?: string; // 1~200자 (깃발 안내 등)
  image_url?: string; // 집결장소 사진 (Supabase Storage public URL). 1~500자
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
  /** 주차장 배열. 비어있으면 [] (NULL 아님). 최대 10개 검증은 앱 레이어. */
  parking_lots: ParkingLot[];
  /** 집결장소 단일. 미설정이면 null. */
  meeting_point: MeetingPoint | null;
  created_at: string;
}

export interface ProgramAssignmentRow {
  id: string;
  program_id: string;
  org_id: string;
  assigned_by: string | null;
  assigned_at: string;
}
