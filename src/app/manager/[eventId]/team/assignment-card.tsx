"use client";

import { useState, useTransition } from "react";
import {
  ASSIGNMENT_ROLE_META,
  type AssignmentRole,
  type EventTeamAssignment,
} from "@/lib/team/event-team-types";
import { ROLE_META } from "@/lib/team/types";

type ActionResult = { ok: boolean; error?: string } | void | undefined;

interface Props {
  assignment: EventTeamAssignment;
  canEdit: boolean;
  hasLeader: boolean;
  /** 팀장으로 지정 (LEADER가 아닐 때만 노출) */
  onSetLeader?: (teamMemberId: string) => Promise<ActionResult>;
  /** 역할 변경 (ASSISTANT ↔ SUPPORT) */
  onChangeRole?: (
    assignmentId: string,
    newRole: AssignmentRole
  ) => Promise<ActionResult>;
  /** 팀에서 제외 */
  onRemove?: (assignmentId: string) => Promise<ActionResult>;
}

function formatPhone(phone: string | null): string {
  if (!phone) return "";
  // 010-XXXX-XXXX 마스킹 (가운데 4자리)
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-****-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-***-${digits.slice(6)}`;
  }
  return phone;
}

function getInitial(name: string): string {
  const t = name.trim();
  return t ? t.charAt(0) : "🌿";
}

function avatarGradient(role: AssignmentRole): string {
  switch (role) {
    case "LEADER":
      return "bg-gradient-to-br from-amber-400 to-orange-500";
    case "ASSISTANT":
      return "bg-gradient-to-br from-sky-400 to-blue-500";
    case "SUPPORT":
    default:
      return "bg-gradient-to-br from-zinc-400 to-zinc-500";
  }
}

function cardContainerClass(role: AssignmentRole): string {
  switch (role) {
    case "LEADER":
      return "border-amber-300 bg-amber-50/40";
    case "ASSISTANT":
      return "border-sky-300 bg-white";
    case "SUPPORT":
    default:
      return "border-zinc-300 bg-white";
  }
}

export default function AssignmentCard({
  assignment,
  canEdit,
  hasLeader,
  onSetLeader,
  onChangeRole,
  onRemove,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const meta = ASSIGNMENT_ROLE_META[assignment.role];
  const memberRoleMeta = ROLE_META[assignment.member_role] ?? null;

  const run = (fn: () => Promise<ActionResult>) => {
    setErr(null);
    startTransition(async () => {
      try {
        const r = await fn();
        if (r && typeof r === "object" && r.ok === false) {
          setErr(r.error ?? "작업에 실패했어요");
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "작업에 실패했어요");
      }
    });
  };

  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md ${cardContainerClass(
        assignment.role
      )}`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            aria-hidden
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm ${avatarGradient(
              assignment.role
            )}`}
          >
            {getInitial(assignment.member_name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="truncate text-sm font-bold text-[#2C2C2C]">
                {assignment.member_name}
              </h3>
              <span
                className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${meta.color}`}
              >
                <span aria-hidden>{meta.icon}</span>
                <span>{meta.label}</span>
              </span>
              {memberRoleMeta && (
                <span
                  className={`hidden md:inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${memberRoleMeta.color}`}
                >
                  {memberRoleMeta.label}
                </span>
              )}
            </div>
            <dl className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[#6B6560]">
              {assignment.member_phone && (
                <div>
                  <dt className="sr-only">휴대폰</dt>
                  <dd>📱 {formatPhone(assignment.member_phone)}</dd>
                </div>
              )}
              {assignment.member_email && (
                <div className="min-w-0">
                  <dt className="sr-only">이메일</dt>
                  <dd className="truncate">✉️ {assignment.member_email}</dd>
                </div>
              )}
            </dl>
            {assignment.memo && (
              <p className="mt-1.5 rounded-lg bg-white/60 px-2 py-1 text-[11px] text-[#6B6560]">
                💬 {assignment.memo}
              </p>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-1.5 md:flex-shrink-0">
            {assignment.role !== "LEADER" && onSetLeader && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => onSetLeader(assignment.team_member_id))
                }
                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                title={
                  hasLeader
                    ? "기존 팀장을 해제하고 이 팀원을 팀장으로 지정합니다"
                    : "팀장 지정"
                }
              >
                👑 팀장
              </button>
            )}

            {onChangeRole && assignment.role !== "LEADER" && (
              <>
                {assignment.role !== "ASSISTANT" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() => onChangeRole(assignment.id, "ASSISTANT"))
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-white px-2 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-50 disabled:opacity-50"
                  >
                    🎯 부팀장
                  </button>
                )}
                {assignment.role !== "SUPPORT" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() => onChangeRole(assignment.id, "SUPPORT"))
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    🛠 지원
                  </button>
                )}
              </>
            )}

            {onChangeRole && assignment.role === "LEADER" && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => onChangeRole(assignment.id, "ASSISTANT"))
                }
                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                title="팀장 역할에서 부팀장으로 전환"
              >
                팀장 해제
              </button>
            )}

            {onRemove && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`${assignment.member_name}님을 팀에서 제외할까요?`))
                    return;
                  run(() => onRemove(assignment.id));
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-white px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                🗑 제외
              </button>
            )}
          </div>
        )}
      </div>

      {err && (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-800"
        >
          ⚠️ {err}
        </p>
      )}
    </article>
  );
}
