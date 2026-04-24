"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePartnerWithRole } from "@/lib/auth-guard";
import type { AssignmentRole } from "@/lib/team/event-team-types";

type InsertResult = { error: { message: string } | null };
type UpdateResult = { error: { message: string } | null };
type DeleteResult = { error: { message: string } | null };

function revalidateEvent(eventId: string) {
  // Next.js 16 — revalidate the dynamic route, not the literal bracket string
  revalidatePath(`/manager/${eventId}`);
  revalidatePath(`/manager/${eventId}/team`);
}

async function insertAssignment(
  eventId: string,
  teamMemberId: string,
  role: AssignmentRole,
  assignedBy: string | null
): Promise<InsertResult> {
  const supabase = await createClient();
  return await (
    supabase.from("event_team_assignments" as never) as unknown as {
      insert: (p: unknown) => Promise<InsertResult>;
    }
  ).insert({
    event_id: eventId,
    team_member_id: teamMemberId,
    role,
    assigned_by: assignedBy,
  } as never);
}

async function updateAssignmentById(
  assignmentId: string,
  patch: Record<string, unknown>
): Promise<UpdateResult> {
  const supabase = await createClient();
  return await (
    supabase.from("event_team_assignments" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<UpdateResult>;
      };
    }
  )
    .update(patch as never)
    .eq("id", assignmentId);
}

async function demoteCurrentLeaderIfAny(eventId: string): Promise<void> {
  const supabase = await createClient();
  await (
    supabase.from("event_team_assignments" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<UpdateResult>;
        };
      };
    }
  )
    .update({ role: "ASSISTANT" as AssignmentRole } as never)
    .eq("event_id", eventId)
    .eq("role", "LEADER");
}

async function fetchAssignment(
  assignmentId: string
): Promise<{
  id: string;
  event_id: string;
  team_member_id: string;
  role: AssignmentRole;
} | null> {
  const supabase = await createClient();
  const { data } = await (
    supabase.from("event_team_assignments" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: {
              id: string;
              event_id: string;
              team_member_id: string;
              role: AssignmentRole;
            } | null;
          }>;
        };
      };
    }
  )
    .select("id,event_id,team_member_id,role")
    .eq("id", assignmentId)
    .maybeSingle();
  return data;
}

// ============================================================
// 팀원 일괄 배정
// ============================================================
export async function assignTeamMembersAction(
  eventId: string,
  formData: FormData
) {
  const session = await requirePartnerWithRole(["OWNER", "MANAGER"]);

  const ids = formData.getAll("teamMemberIds").map((v) => String(v)).filter(Boolean);
  const roleRaw = String(formData.get("role") ?? "ASSISTANT") as AssignmentRole;
  const role: AssignmentRole =
    roleRaw === "LEADER" || roleRaw === "ASSISTANT" || roleRaw === "SUPPORT"
      ? roleRaw
      : "ASSISTANT";

  if (ids.length === 0) {
    throw new Error("배정할 팀원을 선택해 주세요");
  }

  const assignedBy = session.teamMemberId ?? session.id;

  // LEADER 일괄 배정 금지 (1명만 가능)
  const effectiveRole: AssignmentRole = role === "LEADER" && ids.length > 1 ? "ASSISTANT" : role;

  // LEADER 1명 배정 시 기존 LEADER 강등 선처리
  if (effectiveRole === "LEADER") {
    await demoteCurrentLeaderIfAny(eventId);
  }

  for (const memberId of ids) {
    const { error } = await insertAssignment(eventId, memberId, effectiveRole, assignedBy);
    // ON CONFLICT DO NOTHING — UNIQUE(event_id, team_member_id) 위반 시 무시
    if (error && !/duplicate key|unique/i.test(error.message)) {
      throw new Error(`배정 실패: ${error.message}`);
    }
  }

  revalidateEvent(eventId);
}

// ============================================================
// 팀장 지정
// ============================================================
export async function setEventLeaderAction(
  eventId: string,
  teamMemberId: string
) {
  const session = await requirePartnerWithRole(["OWNER", "MANAGER"]);
  const assignedBy = session.teamMemberId ?? session.id;

  // 1. 기존 LEADER 강등
  await demoteCurrentLeaderIfAny(eventId);

  // 2. 대상 팀원의 기존 assignment 조회
  const supabase = await createClient();
  const { data: existing } = await (
    supabase.from("event_team_assignments" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: { id: string } | null;
            }>;
          };
        };
      };
    }
  )
    .select("id")
    .eq("event_id", eventId)
    .eq("team_member_id", teamMemberId)
    .maybeSingle();

  if (existing) {
    const { error } = await updateAssignmentById(existing.id, {
      role: "LEADER" as AssignmentRole,
    });
    if (error) throw new Error(`팀장 지정 실패: ${error.message}`);
  } else {
    const { error } = await insertAssignment(
      eventId,
      teamMemberId,
      "LEADER",
      assignedBy
    );
    if (error) throw new Error(`팀장 지정 실패: ${error.message}`);
  }

  revalidateEvent(eventId);
}

// ============================================================
// 역할 변경
// ============================================================
export async function updateAssignmentRoleAction(
  assignmentId: string,
  newRole: AssignmentRole
) {
  await requirePartnerWithRole(["OWNER", "MANAGER"]);

  if (newRole !== "LEADER" && newRole !== "ASSISTANT" && newRole !== "SUPPORT") {
    throw new Error("잘못된 역할입니다");
  }

  const current = await fetchAssignment(assignmentId);
  if (!current) throw new Error("배정 정보를 찾을 수 없습니다");

  if (current.role === newRole) {
    return; // 변경 없음
  }

  // LEADER로 승격할 때만 기존 LEADER 강등
  if (newRole === "LEADER") {
    await demoteCurrentLeaderIfAny(current.event_id);
  }

  const { error } = await updateAssignmentById(assignmentId, { role: newRole });
  if (error) throw new Error(`역할 변경 실패: ${error.message}`);

  revalidateEvent(current.event_id);
}

// ============================================================
// 배정 해제
// ============================================================
export async function removeAssignmentAction(assignmentId: string) {
  await requirePartnerWithRole(["OWNER", "MANAGER"]);

  const current = await fetchAssignment(assignmentId);
  if (!current) throw new Error("배정 정보를 찾을 수 없습니다");

  const supabase = await createClient();
  const { error } = await (
    supabase.from("event_team_assignments" as never) as unknown as {
      delete: () => { eq: (k: string, v: string) => Promise<DeleteResult> };
    }
  )
    .delete()
    .eq("id", assignmentId);

  if (error) throw new Error(`배정 해제 실패: ${error.message}`);

  revalidateEvent(current.event_id);
}

// ============================================================
// 메모 업데이트
// ============================================================
export async function updateAssignmentMemoAction(
  assignmentId: string,
  formData: FormData
) {
  await requirePartnerWithRole(["OWNER", "MANAGER"]);

  const memoRaw = String(formData.get("memo") ?? "").trim();
  const memo = memoRaw === "" ? null : memoRaw;

  const current = await fetchAssignment(assignmentId);
  if (!current) throw new Error("배정 정보를 찾을 수 없습니다");

  const { error } = await updateAssignmentById(assignmentId, { memo });
  if (error) throw new Error(`메모 업데이트 실패: ${error.message}`);

  revalidateEvent(current.event_id);
}
