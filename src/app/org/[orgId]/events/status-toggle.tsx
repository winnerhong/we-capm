"use client";

// 행사 카드 인라인 상태 토글 — 예정 / 진행중 / 종료 / 보관 4종 segmented control.
// 클릭 즉시 updateOrgEventStatusAction 호출 → optimistic UI + 실패 시 롤백.
//
// 고른 칸에만 날짜가 붙는다("9/12(토) 예정"). 네 칸 모두에 날짜를 넣으면 360px
// 폰에서 글자가 눌리고, 애초에 안 고른 칸의 날짜는 아무 뜻도 없다 —
// "종료를 누르면 5/16 이 된다" 가 아니니까.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrgEventStatusAction } from "@/lib/org-events/actions";
import {
  ORG_EVENT_STATUSES,
  ORG_EVENT_STATUS_META,
  type OrgEventStatus,
} from "@/lib/org-events/types";
import { describeEventStatus } from "@/lib/org-events/event-status-label";

interface Props {
  eventId: string;
  initialStatus: OrgEventStatus;
  /** 고른 칸에 적을 날짜의 근거. */
  startsAt?: string | null;
  endsAt?: string | null;
  /**
   * "stacked" — 라벨을 위에 두고 칩이 가로를 꽉 채운다 (행사 목록 카드).
   * "inline"  — 라벨과 칩이 한 줄. 옆의 액션 버튼들과 높이가 맞는다
   *             (행사 상세 헤더). 기본은 stacked.
   */
  variant?: "stacked" | "inline";
}

/**
 * 이 상태를 고르면 **참가자 화면이 어떻게 되는지** 한 줄.
 *
 * 예전에는 아무 안내 없이 눌렸다. "종료" 가 목록에서 숨기기만 하는 건지
 * 문을 잠그는 건지 눌러보기 전에는 알 수 없었다. 되돌릴 수 있는 조작이라
 * 확인창까지 띄우지는 않되, 무슨 일이 일어나는지는 미리 말한다.
 */
const EFFECT: Record<OrgEventStatus, string> = {
  DRAFT: "참가자에겐 초대장·일정만 보여요",
  LIVE: "참가자가 스탬프·미션을 할 수 있어요",
  ENDED: "참가가 닫혀요. 사진·설문은 계속 볼 수 있어요",
  ARCHIVED: "참가자 목록에서 사라지고 입장도 막혀요",
};

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
  startsAt = null,
  endsAt = null,
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
    ? "inline-flex shrink-0 items-center justify-center gap-0.5 rounded-xl px-2.5 py-2 text-[11px] leading-4 font-bold transition disabled:opacity-50"
    : "inline-flex min-w-0 items-center justify-center gap-0.5 rounded-lg px-1.5 py-1 text-[10px] font-bold transition disabled:opacity-50";

  // 고른 칸은 날짜까지 안아야 하므로 두 몫을 준다. 안 고른 칸은 한 몫.
  const flexCls = (on: boolean) => (inline ? "" : on ? "flex-[2]" : "flex-1");

  const chips = (
    <div
      role="radiogroup"
      aria-label="행사 상태 변경"
      className="flex gap-1"
    >
      {ORG_EVENT_STATUSES.map((s) => {
        const meta = TONE[s];
        const isActive = status === s;
        const desc = describeEventStatus({ status: s, startsAt, endsAt });
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={pending}
            onClick={() => onSelect(s)}
            title={ORG_EVENT_STATUS_META[s].label}
            className={`${chipCls} ${flexCls(isActive)} ${
              isActive ? meta.active : meta.idle
            }`}
          >
            <span aria-hidden>{meta.emoji}</span>
            <span className="truncate">
              {isActive ? desc.label : desc.short}
            </span>
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

  const effect = (align: string) => (
    <p className={`text-[10px] leading-relaxed text-[#6B6560] ${align}`}>
      {EFFECT[status]}
    </p>
  );

  if (inline) {
    /* 세로 정렬은 items-start 다 — 칩의 **윗변**이 옆 액션 버튼과 맞아야 한 줄로
       읽힌다. items-end 로 두면 아래 한 줄짜리 안내문에 버튼이 끌려 내려가
       칩보다 낮게 앉는다.
       가로는 sm 이상에서 오른쪽 정렬 — 이 블록이 카드 오른쪽 끝에 놓이므로
       글자도 같은 변에 붙어야 가장자리가 들쭉날쭉하지 않다. 모바일에서는
       줄이 바뀌어 왼쪽에 서므로 그대로 왼쪽 정렬. */
    return (
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-[11px] font-semibold text-[#8B7F75]">
            상태
          </span>
          {chips}
        </div>
        {effect("sm:text-right")}
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold text-[#6B6560]">상태</p>
      {chips}
      {effect("")}
      {error}
    </div>
  );
}
