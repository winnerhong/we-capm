"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustAcornBalanceAction } from "./actions";

type Props = {
  userId: string;
  balance: number;
  /** "row" = 테이블용 컴팩트, "card" = 모바일 카드용 조금 크게 */
  size?: "row" | "card";
};

/**
 * 참가자 도토리 잔액을 +1 / -1 조정하는 컴팩트 위젯.
 * 서버액션 호출 → router.refresh() 로 반영.
 */
export function AcornAdjuster({ userId, balance, size = "row" }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const bump = (delta: number) => {
    if (pending) return;
    if (delta < 0 && balance === 0) return;
    start(async () => {
      try {
        await adjustAcornBalanceAction(userId, delta);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "도토리 조정 실패");
      }
    });
  };

  const btnCls =
    size === "card"
      ? "inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold leading-none disabled:opacity-40 transition"
      : "inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold leading-none disabled:opacity-40 transition";

  const numCls =
    size === "card"
      ? "min-w-[2.5rem] text-center font-bold text-[#6B4423]"
      : "min-w-[2rem] text-center text-xs font-bold text-[#6B4423]";

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => bump(-1)}
        disabled={pending || balance === 0}
        aria-label="도토리 1개 차감"
        className={`${btnCls} border-rose-200 bg-white text-rose-700 hover:bg-rose-50`}
      >
        −
      </button>
      <span className={numCls}>{balance.toLocaleString("ko-KR")}</span>
      <button
        type="button"
        onClick={() => bump(1)}
        disabled={pending}
        aria-label="도토리 1개 추가"
        className={`${btnCls} border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50`}
      >
        +
      </button>
    </div>
  );
}
