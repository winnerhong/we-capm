export type OrgProgramStatus = "ACTIVATED" | "CUSTOMIZED" | "PUBLISHED" | "PAUSED" | "ARCHIVED";

export const ORG_PROGRAM_STATUS_META = {
  ACTIVATED: { label: "활성화", color: "bg-sky-50 text-sky-800 border-sky-200", icon: "✨" },
  CUSTOMIZED: { label: "수정중", color: "bg-amber-50 text-amber-800 border-amber-200", icon: "✏️" },
  PUBLISHED: { label: "공개중", color: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: "📢" },
  PAUSED: { label: "일시정지", color: "bg-zinc-50 text-zinc-700 border-zinc-200", icon: "⏸️" },
  ARCHIVED: { label: "보관", color: "bg-zinc-100 text-zinc-600 border-zinc-300", icon: "📦" },
} as const;

export const CATEGORY_META = {
  FOREST: { label: "숲체험", icon: "🌲" },
  CAMPING: { label: "캠핑", icon: "⛺" },
  KIDS: { label: "어린이", icon: "🧸" },
  FAMILY: { label: "가족", icon: "👨‍👩‍👧" },
  TEAM: { label: "팀빌딩", icon: "🤝" },
  ART: { label: "예술", icon: "🎨" },
} as const;

export interface OrgProgramRow {
  id: string;
  org_id: string;
  source_program_id: string | null;
  source_partner_id: string | null;
  title: string;
  description: string | null;
  category: string;
  duration_hours: number | null;
  capacity_min: number;
  capacity_max: number;
  price_per_person: number;
  location_detail: string | null;
  image_url: string | null;
  tags: string[] | null;
  custom_theme: Record<string, unknown>;
  custom_notes: string | null;
  status: OrgProgramStatus;
  is_published: boolean;
  booking_count: number;
  view_count: number;
  activated_at: string;
  updated_at: string;
}
