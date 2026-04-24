export type TeamRole = "OWNER" | "MANAGER" | "STAFF" | "FINANCE" | "VIEWER";
export type TeamStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "DELETED";

export const ROLE_META = {
  OWNER: {
    label: "오너",
    icon: "👑",
    color: "bg-violet-50 text-violet-800 border-violet-200",
    desc: "모든 권한 · 팀 관리 포함",
  },
  MANAGER: {
    label: "매니저",
    icon: "🎯",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
    desc: "프로그램·행사·고객 관리",
  },
  STAFF: {
    label: "스태프",
    icon: "🛠",
    color: "bg-sky-50 text-sky-800 border-sky-200",
    desc: "운영·편집 (재무 X)",
  },
  FINANCE: {
    label: "재무",
    icon: "💰",
    color: "bg-amber-50 text-amber-800 border-amber-200",
    desc: "정산·세금계산서 전용",
  },
  VIEWER: {
    label: "뷰어",
    icon: "👀",
    color: "bg-zinc-50 text-zinc-700 border-zinc-200",
    desc: "읽기 전용",
  },
} as const satisfies Record<
  TeamRole,
  { label: string; icon: string; color: string; desc: string }
>;

export const STATUS_META = {
  PENDING: {
    label: "대기",
    icon: "⏳",
    color: "bg-amber-50 text-amber-800 border-amber-200",
  },
  ACTIVE: {
    label: "활성",
    icon: "✅",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  SUSPENDED: {
    label: "정지",
    icon: "🚫",
    color: "bg-zinc-50 text-zinc-700 border-zinc-200",
  },
  DELETED: {
    label: "삭제됨",
    icon: "🗑",
    color: "bg-rose-50 text-rose-700 border-rose-200",
  },
} as const satisfies Record<
  TeamStatus,
  { label: string; icon: string; color: string }
>;

export const ROLE_OPTIONS: TeamRole[] = ["MANAGER", "STAFF", "FINANCE", "VIEWER"]; // OWNER는 초대 불가

export interface TeamMemberRow {
  id: string;
  partner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  username: string;
  role: TeamRole;
  status: TeamStatus;
  invited_by: string | null;
  invited_at: string;
  activated_at: string | null;
  last_login_at: string | null;
  suspended_at: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}
