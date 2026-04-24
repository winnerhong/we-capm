"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setAttendanceStatusAction,
  type AttendanceStatus,
} from "./actions";

type Props = {
  userId: string;
  /** 오늘 날짜 기준의 출석 상태. null/어제 이전이면 미체크 취급 */
  current: AttendanceStatus | null;
  /** 선택 버튼 크기 — "sm" 테이블용 / "md" 모바일 카드 */
  size?: "sm" | "md";
};

const OPTIONS: Array<{
  value: AttendanceStatus;
  label: string;
  icon: string;
  activeCls: string;
}> = [
  {
    value: "PRESENT",
    label: "참석",
    icon: "✅",
    activeCls: "border-emerald-500 bg-emerald-500 text-white",
  },
  {
    value: "LATE",
    label: "늦음",
    icon: "⏰",
    activeCls: "border-amber-500 bg-amber-500 text-white",
  },
  {
    value: "ABSENT",
    label: "미참석",
    icon: "🔴",
    activeCls: "border-rose-500 bg-rose-500 text-white",
  },
];

/**
 * 3버튼 출석 토글 (참석 · 늦음 · 미참석).
 * 같은 상태 재선택 시 해제(null).
 */
export function AttendanceToggle({ userId, current, size = "sm" }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const onClick = (value: AttendanceStatus) => {
    if (pending) return;
    // 같은 상태 다시 누르면 해제
    const next = current === value ? null : value;
    start(async () => {
      try {
        await setAttendanceStatusAction(userId, next);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "출석 체크 실패");
      }
    });
  };

  const btnBase =
    size === "md"
      ? "inline-flex h-9 min-w-[52px] items-center justify-center gap-0.5 rounded-lg border px-2 text-[11px] font-bold leading-none transition disabled:opacity-50"
      : "inline-flex h-7 min-w-[42px] items-center justify-center gap-0.5 rounded-md border px-1.5 text-[10px] font-bold leading-none transition disabled:opacity-50";

  const inactiveCls =
    "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-[#2D5A3D] hover:text-[#2D5A3D]";

  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label="출석 체크">
      {OPTIONS.map((o) => {
        const isActive = current === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onClick(o.value)}
            disabled={pending}
            aria-pressed={isActive}
            aria-label={o.label}
            title={isActive ? `${o.label} (다시 누르면 해제)` : o.label}
            className={`${btnBase} ${isActive ? o.activeCls : inactiveCls}`}
          >
            <span aria-hidden>{o.icon}</span>
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
