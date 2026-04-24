"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ASSIGNMENT_ROLE_META,
  type AssignmentRole,
  type TeamMemberMini,
} from "@/lib/team/event-team-types";

type ActionResult = { ok: boolean; error?: string } | void | undefined;

interface Props {
  eventId: string;
  candidates: TeamMemberMini[];
  hasLeader: boolean;
  onAssign: (eventId: string, formData: FormData) => Promise<ActionResult>;
}

export default function AddMemberForm({
  eventId,
  candidates,
  hasLeader,
  onAssign,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [role, setRole] = useState<AssignmentRole>(
    hasLeader ? "ASSISTANT" : "LEADER"
  );
  const [query, setQuery] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (!query.trim()) return candidates;
    const q = query.trim().toLowerCase();
    return candidates.filter((m) =>
      `${m.name} ${m.email ?? ""} ${m.phone ?? ""}`.toLowerCase().includes(q)
    );
  }, [candidates, query]);

  const allFilteredIds = filtered.map((m) => m.id);
  const allSelectedInFilter =
    allFilteredIds.length > 0 &&
    allFilteredIds.every((id) => selected.has(id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        // LEADER는 1명만 배정 가능
        if (role === "LEADER") {
          next.clear();
        }
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelectedInFilter) {
        for (const id of allFilteredIds) next.delete(id);
      } else {
        if (role === "LEADER") {
          // 팀장은 다중 불가 → 첫 1명만
          next.clear();
          if (allFilteredIds[0]) next.add(allFilteredIds[0]);
        } else {
          for (const id of allFilteredIds) next.add(id);
        }
      }
      return next;
    });
  };

  const submit = () => {
    if (selected.size === 0) {
      setErr("최소 1명을 선택해주세요");
      return;
    }
    if (role === "LEADER" && selected.size > 1) {
      setErr("팀장은 1명만 지정할 수 있어요");
      return;
    }
    setErr(null);
    const fd = new FormData();
    for (const id of selected) fd.append("teamMemberIds", id);
    fd.append("role", role);
    startTransition(async () => {
      try {
        const r = await onAssign(eventId, fd);
        if (r && typeof r === "object" && r.ok === false) {
          setErr(r.error ?? "배정에 실패했어요");
          return;
        }
        setSelected(new Set());
        setOpen(false);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "배정에 실패했어요");
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setRole(hasLeader ? "ASSISTANT" : "LEADER");
        }}
        className="inline-flex items-center gap-1 rounded-xl bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#234a30] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3A7A52]/50"
      >
        <span aria-hidden>➕</span>
        <span>팀원 추가</span>
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-2xl border-2 border-[#D4E4BC] bg-[#FFF8F0] p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-[#2D5A3D]">
          ➕ 팀원 추가
          {selected.size > 0 && (
            <span className="ml-2 rounded-full bg-[#2D5A3D] px-2 py-0.5 text-[11px] font-semibold text-white">
              {selected.size}명 선택
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setSelected(new Set());
            setErr(null);
          }}
          className="rounded-lg px-2 py-1 text-xs text-[#6B6560] hover:bg-white"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>

      {candidates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D4E4BC] bg-white p-6 text-center">
          <div className="mb-1 text-2xl" aria-hidden>
            🌱
          </div>
          <p className="text-sm font-semibold text-[#2D5A3D]">
            배정 가능한 팀원이 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            설정 → 팀 관리에서 팀원을 먼저 초대해주세요.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto]">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름·이메일·전화번호로 검색"
              className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              aria-label="팀원 검색"
            />
            <div className="flex items-center gap-1">
              <label
                htmlFor="assign-role"
                className="text-[11px] font-semibold text-[#6B6560]"
              >
                역할
              </label>
              <select
                id="assign-role"
                value={role}
                onChange={(e) => {
                  const next = e.target.value as AssignmentRole;
                  setRole(next);
                  if (next === "LEADER" && selected.size > 1) {
                    // 팀장으로 바꾸면 첫 1명만 유지
                    const first = Array.from(selected)[0];
                    setSelected(new Set(first ? [first] : []));
                  }
                }}
                className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              >
                {(Object.keys(ASSIGNMENT_ROLE_META) as AssignmentRole[]).map(
                  (r) => {
                    const disabled = r === "LEADER" && hasLeader;
                    const m = ASSIGNMENT_ROLE_META[r];
                    return (
                      <option key={r} value={r} disabled={disabled}>
                        {m.icon} {m.label}
                        {disabled ? " (지정됨)" : ""}
                      </option>
                    );
                  }
                )}
              </select>
            </div>
          </div>

          {role === "LEADER" && hasLeader && (
            <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
              ⚠️ 이미 팀장이 있어요. 기존 팀장을 해제하거나 다른 역할을 선택해주세요.
            </p>
          )}

          <div className="max-h-[280px] overflow-y-auto rounded-xl border border-[#D4E4BC] bg-white">
            {filtered.length > 0 && role !== "LEADER" && (
              <div className="sticky top-0 border-b border-[#D4E4BC] bg-[#F5F1E8] px-3 py-1.5">
                <label className="flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-[#2D5A3D]">
                  <input
                    type="checkbox"
                    checked={allSelectedInFilter}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-[#D4E4BC] accent-[#2D5A3D]"
                  />
                  <span>
                    전체 선택 ({filtered.length}명)
                  </span>
                </label>
              </div>
            )}
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-[#8B7F75]">
                검색 결과가 없어요
              </p>
            ) : (
              <ul className="divide-y divide-[#E8F0E4]">
                {filtered.map((m) => {
                  const checked = selected.has(m.id);
                  return (
                    <li key={m.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-[#FFF8F0]">
                        <input
                          type={role === "LEADER" ? "radio" : "checkbox"}
                          name={role === "LEADER" ? "leader-pick" : undefined}
                          checked={checked}
                          onChange={() => toggle(m.id)}
                          className="h-4 w-4 accent-[#2D5A3D]"
                        />
                        <div
                          aria-hidden
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3A7A52] to-[#4A7C59] text-xs font-bold text-white"
                        >
                          {m.name.trim().charAt(0) || "🌿"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-[#2C2C2C]">
                            {m.name}
                          </div>
                          <div className="truncate text-[11px] text-[#6B6560]">
                            {m.phone ?? ""}
                            {m.phone && m.email ? " · " : ""}
                            {m.email ?? ""}
                          </div>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
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

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSelected(new Set());
                setErr(null);
              }}
              className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
            >
              취소
            </button>
            <button
              type="button"
              disabled={
                pending ||
                selected.size === 0 ||
                (role === "LEADER" && hasLeader)
              }
              onClick={submit}
              className="inline-flex items-center gap-1 rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-bold text-white hover:bg-[#234a30] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "배정 중…" : `✅ ${selected.size}명 배정`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
