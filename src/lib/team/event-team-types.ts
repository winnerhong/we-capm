import type { TeamRole } from "./types";

export type AssignmentRole = "LEADER" | "ASSISTANT" | "SUPPORT";

export const ASSIGNMENT_ROLE_META = {
  LEADER:    { label: "팀장",    icon: "👑", color: "bg-amber-100 text-amber-900 border-amber-300" },
  ASSISTANT: { label: "부팀장",  icon: "🎯", color: "bg-sky-100 text-sky-900 border-sky-300" },
  SUPPORT:   { label: "지원",    icon: "🛠", color: "bg-zinc-100 text-zinc-700 border-zinc-300" },
} as const satisfies Record<AssignmentRole, { label: string; icon: string; color: string }>;

export interface EventTeamAssignment {
  id: string;
  event_id: string;
  team_member_id: string;
  role: AssignmentRole;
  memo: string | null;
  assigned_by: string | null;
  assigned_at: string;
  // JOIN 필드 (쿼리 helper가 채움)
  member_name: string;
  member_email: string | null;
  member_phone: string | null;
  member_role: TeamRole;
}

export interface TeamMemberMini {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: TeamRole;
}
