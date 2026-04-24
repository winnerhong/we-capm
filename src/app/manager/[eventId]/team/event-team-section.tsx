import Link from "next/link";
import {
  ASSIGNMENT_ROLE_META,
  type AssignmentRole,
  type EventTeamAssignment,
  type TeamMemberMini,
} from "@/lib/team/event-team-types";
import {
  loadEventTeamAssignments,
  loadUnassignedTeamMembers,
} from "@/lib/team/event-team-queries";
import {
  assignTeamMembersAction,
  setEventLeaderAction,
  updateAssignmentRoleAction,
  removeAssignmentAction,
} from "./actions";
import AssignmentCard from "./assignment-card";
import AddMemberForm from "./add-member-form";

async function safeLoadAssignments(
  eventId: string
): Promise<EventTeamAssignment[]> {
  try {
    const r = await loadEventTeamAssignments(eventId);
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}

async function safeLoadUnassigned(
  partnerId: string,
  eventId: string
): Promise<TeamMemberMini[]> {
  try {
    const r = await loadUnassignedTeamMembers(partnerId, eventId);
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}

interface Props {
  eventId: string;
  /** 로그인한 파트너의 id (OWNER/MANAGER) — 미배정 조회용. 없으면 추가 폼 비활성화 */
  partnerId: string | null;
  /** 편집 가능 여부 (partner OWNER/MANAGER 세션일 때 true) */
  canEdit: boolean;
}

const ORDER: AssignmentRole[] = ["LEADER", "ASSISTANT", "SUPPORT"];

export default async function EventTeamSection({
  eventId,
  partnerId,
  canEdit,
}: Props) {
  const [assignments, unassigned] = await Promise.all([
    safeLoadAssignments(eventId),
    canEdit && partnerId
      ? safeLoadUnassigned(partnerId, eventId)
      : Promise.resolve([] as TeamMemberMini[]),
  ]);

  const grouped: Record<AssignmentRole, EventTeamAssignment[]> = {
    LEADER: [],
    ASSISTANT: [],
    SUPPORT: [],
  };
  for (const a of assignments) {
    grouped[a.role]?.push(a);
  }
  const hasLeader = grouped.LEADER.length > 0;
  const totalAssigned = assignments.length;

  return (
    <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-[#2D5A3D]">👥 팀 배정</h2>
          <span className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[11px] font-semibold text-[#2D5A3D]">
            {totalAssigned}명
          </span>
          {!hasLeader && totalAssigned === 0 && (
            <span className="rounded-full border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
              미배정
            </span>
          )}
          {!hasLeader && totalAssigned > 0 && (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              팀장 미지정 · 지정해주세요
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/manager/${eventId}/team`}
            className="inline-flex items-center gap-1 rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            상세 관리 →
          </Link>
          {canEdit && (
            <AddMemberForm
              eventId={eventId}
              candidates={unassigned}
              hasLeader={hasLeader}
              onAssign={assignTeamMembersAction}
            />
          )}
        </div>
      </header>

      {!canEdit && (
        <p className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-700">
          👀 읽기 전용 — 팀 배정 편집은 숲지기(OWNER/MANAGER) 로그인에서 가능해요.
        </p>
      )}

      {totalAssigned === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-6 text-center">
          <div className="mb-1 text-3xl" aria-hidden>
            🌱
          </div>
          <p className="text-sm font-semibold text-[#2D5A3D]">
            아직 배정된 팀원이 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            {canEdit
              ? "“팀원 추가”를 눌러 이 행사에 함께할 숲지기 팀원을 배정해보세요."
              : "숲지기(OWNER/MANAGER) 로그인 후 팀원을 배정할 수 있어요."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {ORDER.map((role) => {
            const list = grouped[role];
            if (list.length === 0) return null;
            const meta = ASSIGNMENT_ROLE_META[role];
            return (
              <div key={role}>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-[#6B6560]">
                  <span aria-hidden>{meta.icon}</span>
                  <span>
                    {meta.label} ({list.length})
                  </span>
                </h3>
                <ul className="space-y-2">
                  {list.map((a) => (
                    <li key={a.id}>
                      <AssignmentCard
                        assignment={a}
                        canEdit={canEdit}
                        hasLeader={hasLeader}
                        onSetLeader={
                          canEdit
                            ? setEventLeaderAction.bind(null, eventId)
                            : undefined
                        }
                        onChangeRole={
                          canEdit ? updateAssignmentRoleAction : undefined
                        }
                        onRemove={canEdit ? removeAssignmentAction : undefined}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
