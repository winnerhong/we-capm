"use client";

// 토리FM 신청곡 boost 모달
//  - 4개 프리셋 (10/50/100/500) + 직접 입력
//  - 보유 도토리 표시, 잔액 부족이면 확인 비활성
//  - boostRequestAction 호출 → 결과로 newBalance 받아서 부모에 전달

import { useCallback, useEffect, useState, useTransition } from "react";
import { boostRequestAction } from "@/lib/tori-fm/actions";

type Props = {
  requestId: string;
  /** UI 헤더에 노출할 곡 표시. */
  songLabel: string;
  /** 현재 보유 도토리. 모달 열 때 부모에서 넘김 (SSR fresh). */
  initialBalance: number;
  onClose: () => void;
  /** boost 성공 후 부모에서 잔액/리스트 갱신. */
  onSuccess: (info: { newBalance: number; spent: number }) => void;
};

const PRESETS = [10, 50, 100, 500] as const;

export function BoostModal({
  requestId,
  songLabel,
  initialBalance,
  onClose,
  onSuccess,
}: Props) {
  const [amount, setAmount] = useState<number>(PRESETS[0]);
  const [customInput, setCustomInput] = useState<string>("");
  const [usingCustom, setUsingCustom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 모달 열렸을 때 ESC 로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  const effectiveAmount = usingCustom
    ? Math.max(0, Math.floor(Number(customInput) || 0))
    : amount;

  const insufficient = effectiveAmount > initialBalance;
  const invalid = effectiveAmount < 1;

  const handleConfirm = useCallback(() => {
    if (invalid || insufficient || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await boostRequestAction(requestId, effectiveAmount);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess({
        newBalance: result.newBalance,
        spent: effectiveAmount,
      });
    });
  }, [requestId, effectiveAmount, invalid, insufficient, pending, onSuccess]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="신청곡 끌어올리기"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        <header className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-1.5 text-base font-bold text-fuchsia-700">
              <span aria-hidden>💎</span> 끌어올리기
            </h2>
            <p className="mt-0.5 line-clamp-1 text-[12px] text-[#6B6560]">
              {songLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="닫기"
            className="rounded-full p-1 text-[#6B6560] transition hover:bg-[#F5F1E8] disabled:opacity-40"
          >
            ✕
          </button>
        </header>

        <div className="mb-3 rounded-xl bg-gradient-to-r from-fuchsia-50 to-violet-50 px-3 py-2 text-[12px] text-[#3D3A36]">
          <span aria-hidden>🌰 </span>
          보유 도토리:{" "}
          <span className="font-bold tabular-nums text-fuchsia-700">
            {initialBalance.toLocaleString("ko-KR")}
          </span>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-bold text-[#2D5A3D]">금액 선택</p>
          <div className="grid grid-cols-4 gap-1.5">
            {PRESETS.map((v) => {
              const active = !usingCustom && amount === v;
              const cannotAfford = v > initialBalance;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setUsingCustom(false);
                    setAmount(v);
                    setError(null);
                  }}
                  disabled={cannotAfford && !active}
                  className={`rounded-xl px-2 py-2 text-xs font-bold transition ${
                    active
                      ? "bg-fuchsia-500 text-white shadow-md shadow-fuchsia-500/40"
                      : cannotAfford
                        ? "bg-[#F5F1E8]/60 text-[#B8AFA5] line-through"
                        : "bg-[#F5F1E8] text-[#3D3A36] hover:bg-fuchsia-100"
                  }`}
                >
                  {v.toLocaleString("ko-KR")}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setUsingCustom(true);
              setError(null);
            }}
            className={`w-full rounded-xl border-2 px-3 py-2 text-left text-xs font-bold transition ${
              usingCustom
                ? "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700"
                : "border-dashed border-[#D4E4BC] text-[#3D3A36] hover:bg-[#F5F1E8]"
            }`}
          >
            ✏ 직접 입력
          </button>

          {usingCustom && (
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={initialBalance}
              step={1}
              autoFocus
              value={customInput}
              onChange={(e) => {
                setError(null);
                // 숫자만 + max 도토리 제한
                const v = e.target.value.replace(/[^\d]/g, "");
                setCustomInput(v);
              }}
              placeholder={`최대 ${initialBalance.toLocaleString("ko-KR")}`}
              className="w-full rounded-xl border border-fuchsia-200 bg-white px-3 py-3 text-right font-mono text-base font-bold text-fuchsia-700 outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-200"
            />
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700"
          >
            ⚠ {error}
          </p>
        )}

        <p className="mt-3 text-[10px] leading-relaxed text-[#8B7F75]">
          💡 끌어올리면 정렬에서 위로 올라가요. 신청이 거절되면 자동
          환불됩니다.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="flex-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-3 text-sm font-bold text-[#3D3A36] transition hover:bg-[#F5F1E8] disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending || invalid || insufficient}
            className="flex-[2] rounded-xl bg-fuchsia-500 px-3 py-3 text-sm font-bold text-white shadow-md shadow-fuchsia-500/40 transition hover:bg-fuchsia-600 disabled:cursor-not-allowed disabled:bg-[#B8AFA5] disabled:shadow-none"
          >
            {pending
              ? "처리 중..."
              : insufficient
                ? "도토리 부족"
                : invalid
                  ? "금액 입력"
                  : `💎 ${effectiveAmount.toLocaleString("ko-KR")} 도토리로 끌어올리기`}
          </button>
        </div>
      </div>
    </div>
  );
}
