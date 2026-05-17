"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustAcornBalanceAction } from "./actions";

type Props = {
  userId: string;
  balance: number;
  /** "row" = 테이블용 컴팩트, "card" = 모바일 카드용 조금 크게 */
  size?: "row" | "card";
};

/**
 * 참가자 도토리 잔액 조정 위젯.
 *  - +/- 버튼: ±1
 *  - 가운데 input: 키보드로 직접 입력. blur 또는 Enter 시 delta 계산 후 server action 호출.
 */
export function AcornAdjuster({ userId, balance, size = "row" }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState(String(balance));

  // 외부에서 balance 변경되면 (router.refresh 후) input 도 동기화.
  useEffect(() => {
    setDraft(String(balance));
  }, [balance]);

  const applyDelta = (delta: number) => {
    if (pending || delta === 0) return;
    if (delta < 0 && balance + delta < 0) return;
    start(async () => {
      try {
        await adjustAcornBalanceAction(userId, delta);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "도토리 조정 실패");
      }
    });
  };

  const commitDraft = () => {
    if (pending) return;
    const next = Math.max(0, Math.floor(Number(draft) || 0));
    const delta = next - balance;
    if (delta === 0) return;
    applyDelta(delta);
  };

  const btnCls =
    size === "card"
      ? "inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold leading-none disabled:opacity-40 transition"
      : "inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold leading-none disabled:opacity-40 transition";

  const inputCls =
    size === "card"
      ? "no-spinner w-14 rounded-md border border-transparent bg-transparent px-1 py-0 text-center font-bold text-[#6B4423] outline-none focus:border-[#D4B896] focus:bg-white"
      : "no-spinner w-10 rounded-md border border-transparent bg-transparent px-0.5 py-0 text-center text-xs font-bold text-[#6B4423] outline-none focus:border-[#D4B896] focus:bg-white";

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => applyDelta(-1)}
        disabled={pending || balance === 0}
        aria-label="도토리 1개 차감"
        className={`${btnCls} border-rose-200 bg-white text-rose-700 hover:bg-rose-50`}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={draft}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d]/g, "");
          setDraft(v);
        }}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setDraft(String(balance));
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label="도토리 잔액 (직접 입력)"
        className={inputCls}
      />
      <button
        type="button"
        onClick={() => applyDelta(1)}
        disabled={pending}
        aria-label="도토리 1개 추가"
        className={`${btnCls} border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50`}
      >
        +
      </button>
    </div>
  );
}
