"use client";

// 행사 카드 인라인 상태 토글 — 진행중 / 예정 / 종료 / 보관 4종 segmented control.
// 클릭 즉시 updateOrgEventStatusAction 호출 → optimistic UI + 실패 시 롤백.

import { useState, useTransition } from "react";
import { updateOrgEventStatusAction } from "@/lib/org-events/actions";
import {
  ORG_EVENT_STATUSES,
  ORG_EVENT_STATUS_META,
  type OrgEventStatus,
} from "@/lib/org-events/types";

interface Props {
  eventId: string;
  initialStatus: OrgEventStatus;
}

const TONE: Record<
  OrgEventStatus,
  { active: string; idle: string; label: string; emoji: string }
> = {
  DRAFT: {
    active: "bg-amber-500 text-white shadow-md shadow-amber-300/30",
    idle: "bg-amber-50 text-amber-800 hover:bg-amber-100",
    label: "예정",
    emoji: "📝",
  },
  LIVE: {
    active: "bg-emerald-600 text-white shadow-md shadow-emerald-400/30",
    idle: "bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
    label: "진행중",
    emoji: "🟢",
  },
  ENDED: {
    active: "bg-zinc-600 text-white shadow-md shadow-zinc-400/30",
    idle: "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
    label: "종료",
    emoji: "🏁",
  },
  ARCHIVED: {
    active: "bg-stone-700 text-white shadow-md shadow-stone-400/30",
    idle: "bg-stone-100 text-stone-600 hover:bg-stone-200",
    label: "보관",
    emoji: "📦",
  },
};

export function EventStatusToggle({ eventId, initialStatus }: Props) {
  const [status, setStatus] = useState<OrgEventStatus>(initialStatus);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const onSelect = (next: OrgEventStatus) => {
    if (status === next || pending) return;
    const prev = status;
    setStatus(next); // optimistic
    setErr(null);
    startTransition(async () => {
      try {
        await updateOrgEventStatusAction(eventId, next);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "상태 변경 실패";
        setErr(`⚠ ${msg}`);
        setStatus(prev); // 롤백
        setTimeout(() => setErr(null), 3500);
      }
    });
  };

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold text-[#8B7F75]">상태</p>
      <div
        role="radiogroup"
        aria-label="행사 상태 변경"
        className="flex gap-1"
      >
        {ORG_EVENT_STATUSES.map((s) => {
          const meta = TONE[s];
          const isActive = status === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={pending}
              onClick={() => onSelect(s)}
              title={ORG_EVENT_STATUS_META[s].label}
              className={`flex-1 inline-flex items-center justify-center gap-0.5 rounded-lg px-1.5 py-1 text-[10px] font-bold transition disabled:opacity-50 ${
                isActive ? meta.active : meta.idle
              }`}
            >
              <span aria-hidden>{meta.emoji}</span>
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>
      {err && (
        <p
          role="alert"
          className="text-[10px] font-semibold text-rose-700"
        >
          {err}
        </p>
      )}
    </div>
  );
}
