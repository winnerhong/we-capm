"use client";

// 행사 카드 인라인 상태 토글 — 진행중 / 예정 / 종료 / 보관 4종 segmented control.
// 클릭 즉시 updateOrgEventStatusAction 호출 → optimistic UI + 실패 시 롤백.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrgEventStatusAction } from "@/lib/org-events/actions";
import {
  ORG_EVENT_STATUSES,
  ORG_EVENT_STATUS_META,
  type OrgEventStatus,
} from "@/lib/org-events/types";

interface Props {
  eventId: string;
  initialStatus: OrgEventStatus;
  /**
   * "stacked" — 라벨을 위에 두고 칩이 가로를 꽉 채운다 (행사 목록 카드).
   * "inline"  — 라벨과 칩이 한 줄. 옆의 액션 버튼들과 높이가 맞는다
   *             (행사 상세 헤더). 기본은 stacked.
   */
  variant?: "stacked" | "inline";
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

export function EventStatusToggle({
  eventId,
  initialStatus,
  variant = "stacked",
}: Props) {
  const router = useRouter();
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
        // 행사 상세 헤더의 상태 배지·셀프등록 안내처럼 서버가 그린 부분이
        // 같이 갱신되도록. (목록에서는 무해하다)
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "상태 변경 실패";
        setErr(`⚠ ${msg}`);
        setStatus(prev); // 롤백
        setTimeout(() => setErr(null), 3500);
      }
    });
  };

  const inline = variant === "inline";

  // inline 은 옆 액션 버튼(px-3.5 py-2 text-xs rounded-xl)과 높이를 맞춘다.
  const chipCls = inline
    ? "inline-flex shrink-0 items-center justify-center gap-0.5 rounded-xl px-2.5 py-2 text-[11px] font-bold transition disabled:opacity-50"
    : "flex-1 inline-flex items-center justify-center gap-0.5 rounded-lg px-1.5 py-1 text-[10px] font-bold transition disabled:opacity-50";

  const chips = (
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
            className={`${chipCls} ${isActive ? meta.active : meta.idle}`}
          >
            <span aria-hidden>{meta.emoji}</span>
            <span>{meta.label}</span>
          </button>
        );
      })}
    </div>
  );

  const error = err && (
    <p role="alert" className="text-[10px] font-semibold text-rose-700">
      {err}
    </p>
  );

  if (inline) {
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-[11px] font-semibold text-[#8B7F75]">
            상태
          </span>
          {chips}
        </div>
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold text-[#8B7F75]">상태</p>
      {chips}
      {error}
    </div>
  );
}
