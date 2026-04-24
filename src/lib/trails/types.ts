export type TrailDifficulty = "EASY" | "MEDIUM" | "HARD";
export type TrailStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type TrailVisibility = "DRAFT" | "ALL" | "SELECTED" | "ARCHIVED";
export type MissionType = "PHOTO" | "QUIZ" | "LOCATION" | "CHECKIN";

export const TRAIL_VISIBILITY_META = {
  DRAFT:    { label: "초안",     icon: "✏️", color: "bg-zinc-50 text-zinc-700 border-zinc-200",
              desc: "작성 중 · 기관 노출 안 됨" },
  ALL:      { label: "전체 공개", icon: "🌍", color: "bg-emerald-50 text-emerald-800 border-emerald-200",
              desc: "모든 기관에게 자동 노출" },
  SELECTED: { label: "선택 공개", icon: "🎯", color: "bg-sky-50 text-sky-800 border-sky-200",
              desc: "지정한 기관에만 노출" },
  ARCHIVED: { label: "보관",     icon: "📦", color: "bg-zinc-100 text-zinc-600 border-zinc-300",
              desc: "목록에서 숨김" },
} as const satisfies Record<TrailVisibility, { label: string; icon: string; color: string; desc: string }>;

export const TRAIL_VISIBILITY_OPTIONS: TrailVisibility[] = [
  "DRAFT",
  "ALL",
  "SELECTED",
  "ARCHIVED",
];

export const DIFFICULTY_META = {
  EASY:   { label: "쉬움",   icon: "🌱", color: "#D4E4BC" },
  MEDIUM: { label: "보통",   icon: "🌿", color: "#A8C686" },
  HARD:   { label: "어려움", icon: "🌲", color: "#4A7C59" },
} as const;

export const MISSION_TYPE_META = {
  PHOTO:    { label: "사진 찍기",    icon: "📷", desc: "지점의 풍경/가족 사진을 남겨요" },
  QUIZ:     { label: "퀴즈",         icon: "❓", desc: "짧은 퀴즈를 풀어요" },
  LOCATION: { label: "위치 인증",    icon: "📍", desc: "GPS로 지점 도착 확인" },
  CHECKIN:  { label: "간단 체크인",  icon: "✅", desc: "버튼만 누르면 완료" },
} as const;

export const STATUS_META = {
  DRAFT:     { label: "초안",   color: "bg-amber-50 text-amber-800 border-amber-200" },
  PUBLISHED: { label: "공개중", color: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  ARCHIVED: { label: "보관됨", color: "bg-zinc-50 text-zinc-700 border-zinc-200" },
} as const;

export interface TrailRow {
  id: string;
  partner_id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  difficulty: TrailDifficulty;
  estimated_minutes: number | null;
  distance_km: number | null;
  total_slots: number;
  theme: Record<string, unknown>;
  is_public: boolean;
  slug: string | null;
  view_count: number;
  completion_count: number;
  status: TrailStatus;
  visibility: TrailVisibility;
  venue_name: string | null;
  venue_address: string | null;
  external_link: string | null;
  notes: string | null;
  images: string[];
  created_at: string;
  updated_at: string;
}

export interface TrailAssignmentRow {
  id: string;
  trail_id: string;
  org_id: string;
  assigned_by: string | null;
  assigned_at: string;
}

export interface TrailStopRow {
  id: string;
  trail_id: string;
  order: number;
  name: string;
  description: string | null;
  location_hint: string | null;
  lat: number | null;
  lng: number | null;
  photo_url: string | null;
  qr_code: string;
  mission_type: MissionType;
  mission_config: Record<string, unknown>;
  reward_points: number;
  is_active: boolean;
  created_at: string;
}

export interface TrailCompletionRow {
  id: string;
  trail_id: string;
  event_id: string | null;
  participant_phone: string | null;
  participant_name: string | null;
  stops_cleared: string[];
  total_score: number;
  started_at: string;
  completed_at: string | null;
  certificate_url: string | null;
}
