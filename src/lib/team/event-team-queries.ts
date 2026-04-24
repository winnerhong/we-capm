import { createClient } from "@/lib/supabase/server";
import type {
  AssignmentRole,
  EventTeamAssignment,
  TeamMemberMini,
} from "./event-team-types";
import type { TeamRole, TeamStatus } from "./types";

type AssignmentRow = {
  id: string;
  event_id: string;
  team_member_id: string;
  role: AssignmentRole;
  memo: string | null;
  assigned_by: string | null;
  assigned_at: string;
};

type TeamMemberRow = {
  id: string;
  partner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: TeamRole;
  status: TeamStatus;
};

type EventRow = {
  id: string;
  name: string;
  start_at: string;
  end_at: string;
};

// ============================================================
// 행사에 배정된 팀원 전체 로드 (JOIN with partner_team_members)
// ============================================================
export async function loadEventTeamAssignments(
  eventId: string
): Promise<EventTeamAssignment[]> {
  const supabase = await createClient();

  const { data: assignments } = await (
    supabase.from("event_team_assignments" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            k: string,
            o: { ascending: boolean }
          ) => Promise<{ data: AssignmentRow[] | null }>;
        };
      };
    }
  )
    .select("id,event_id,team_member_id,role,memo,assigned_by,assigned_at")
    .eq("event_id", eventId)
    .order("assigned_at", { ascending: true });

  const rows = assignments ?? [];
  if (rows.length === 0) return [];

  const memberIds = Array.from(new Set(rows.map((r) => r.team_member_id)));

  const { data: members } = await (
    supabase.from("partner_team_members" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => Promise<{ data: TeamMemberRow[] | null }>;
      };
    }
  )
    .select("id,partner_id,name,email,phone,role,status")
    .in("id", memberIds);

  const memberMap = new Map<string, TeamMemberRow>();
  (members ?? []).forEach((m) => memberMap.set(m.id, m));

  // LEADER → ASSISTANT → SUPPORT 순서로 정렬
  const roleOrder: Record<AssignmentRole, number> = {
    LEADER: 0,
    ASSISTANT: 1,
    SUPPORT: 2,
  };

  const merged: EventTeamAssignment[] = rows
    .map((r) => {
      const m = memberMap.get(r.team_member_id);
      return {
        id: r.id,
        event_id: r.event_id,
        team_member_id: r.team_member_id,
        role: r.role,
        memo: r.memo,
        assigned_by: r.assigned_by,
        assigned_at: r.assigned_at,
        member_name: m?.name ?? "(삭제된 팀원)",
        member_email: m?.email ?? null,
        member_phone: m?.phone ?? null,
        member_role: m?.role ?? "VIEWER",
      };
    })
    .sort((a, b) => {
      const d = roleOrder[a.role] - roleOrder[b.role];
      if (d !== 0) return d;
      return a.assigned_at.localeCompare(b.assigned_at);
    });

  return merged;
}

// ============================================================
// 특정 파트너의 미배정 팀원 목록
// (이 행사에 아직 배정 안 된 ACTIVE/PENDING 팀원)
// ============================================================
export async function loadUnassignedTeamMembers(
  partnerId: string,
  eventId: string
): Promise<TeamMemberMini[]> {
  const supabase = await createClient();

  // 1. 파트너의 ACTIVE/PENDING 팀원 전체
  const { data: members } = await (
    supabase.from("partner_team_members" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          in: (
            k: string,
            v: string[]
          ) => {
            order: (
              k: string,
              o: { ascending: boolean }
            ) => Promise<{ data: TeamMemberRow[] | null }>;
          };
        };
      };
    }
  )
    .select("id,partner_id,name,email,phone,role,status")
    .eq("partner_id", partnerId)
    .in("status", ["ACTIVE", "PENDING"])
    .order("created_at", { ascending: true });

  const all = members ?? [];
  if (all.length === 0) return [];

  // 2. 이 행사에 이미 배정된 team_member_id 집합
  const { data: assigned } = await (
    supabase.from("event_team_assignments" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{
          data: Array<{ team_member_id: string }> | null;
        }>;
      };
    }
  )
    .select("team_member_id")
    .eq("event_id", eventId);

  const assignedSet = new Set(
    (assigned ?? []).map((r) => r.team_member_id)
  );

  return all
    .filter((m) => !assignedSet.has(m.id))
    .map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      role: m.role,
    }));
}

// ============================================================
// 특정 팀원의 배정 행사 목록
// ============================================================
export async function loadMemberEventAssignments(
  teamMemberId: string
): Promise<
  Array<{
    event_id: string;
    event_name: string;
    start_at: string;
    end_at: string;
    role: AssignmentRole;
  }>
> {
  const supabase = await createClient();

  const { data: assignments } = await (
    supabase.from("event_team_assignments" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            k: string,
            o: { ascending: boolean }
          ) => Promise<{
            data: Array<{
              event_id: string;
              role: AssignmentRole;
              assigned_at: string;
            }> | null;
          }>;
        };
      };
    }
  )
    .select("event_id,role,assigned_at")
    .eq("team_member_id", teamMemberId)
    .order("assigned_at", { ascending: false });

  const rows = assignments ?? [];
  if (rows.length === 0) return [];

  const eventIds = Array.from(new Set(rows.map((r) => r.event_id)));

  const { data: events } = await (
    supabase.from("events" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => Promise<{ data: EventRow[] | null }>;
      };
    }
  )
    .select("id,name,start_at,end_at")
    .in("id", eventIds);

  const evMap = new Map<string, EventRow>();
  (events ?? []).forEach((e) => evMap.set(e.id, e));

  return rows
    .map((r) => {
      const e = evMap.get(r.event_id);
      if (!e) return null;
      return {
        event_id: r.event_id,
        event_name: e.name,
        start_at: e.start_at,
        end_at: e.end_at,
        role: r.role,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

// ============================================================
// 파트너의 PENDING 팀원 수 (네비 배지용)
// ============================================================
export async function countPendingTeamMembers(
  partnerId: string
): Promise<number> {
  const supabase = await createClient();

  const { count } = await (
    supabase.from("partner_team_members" as never) as unknown as {
      select: (
        c: string,
        opts: { count: "exact"; head: true }
      ) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ count: number | null }>;
        };
      };
    }
  )
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .eq("status", "PENDING");

  return count ?? 0;
}

// ============================================================
// 파트너의 팀원 카운트 (활성/전체 통계)
// ============================================================
export async function loadTeamMemberStats(
  partnerId: string
): Promise<{
  total: number;
  active: number;
  pending: number;
  suspended: number;
}> {
  const supabase = await createClient();

  const { data } = await (
    supabase.from("partner_team_members" as never) as unknown as {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => {
          neq: (
            k: string,
            v: string
          ) => Promise<{ data: Array<{ status: TeamStatus }> | null }>;
        };
      };
    }
  )
    .select("status")
    .eq("partner_id", partnerId)
    .neq("status", "DELETED");

  const rows = data ?? [];
  const stats = {
    total: rows.length,
    active: 0,
    pending: 0,
    suspended: 0,
  };

  for (const r of rows) {
    if (r.status === "ACTIVE") stats.active++;
    else if (r.status === "PENDING") stats.pending++;
    else if (r.status === "SUSPENDED") stats.suspended++;
  }

  return stats;
}
