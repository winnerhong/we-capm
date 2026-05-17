"use client";

// 토리FM 신청곡 boost 모달 — "순위 점프" 결제 모드.
//  - 1/2/3등으로 올리려면 필요한 도토리 자동 계산해서 한 클릭 결제.
//  - 이미 그 등수 이상이면 해당 버튼 비활성.
//  - 직접 입력도 가능 (백업).
//  - 인기 점수 = heart_count + boost_amount (1:1 가중치).

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  boostRequestAction,
  jumpToQueueFirstAction,
} from "@/lib/tori-fm/actions";
import {
  loadIncompleteMissionsForUserAction,
  type IncompleteMissionItem,
} from "@/lib/missions/incomplete-actions";
import { AcornIcon } from "@/components/acorn-icon";

type Props = {
  requestId: string;
  /** 내 신청의 현재 인기 점수 (heart + boost). 부모가 계산해서 전달. */
  myScore: number;
  /** 1/2/3등의 인기 점수 — 부모가 정렬해서 상위 3건의 점수만 전달.
   *  내 신청이 그 자리에 있으면 본인 점수 그대로. */
  topScores: number[];
  /** 방송 큐 #1 의 boost_amount — "1순위 점프" 필요 도토리 계산에 사용.
   *  큐가 비어있으면 0. 본인이 이미 #1 이면 옵션 비활성. */
  queueTopBoost: number;
  /** 본인 신청이 이미 큐 #1 인지 — 자기 자신 점프 방지. */
  isMyselfQueueFirst: boolean;
  /** UI 헤더에 노출할 곡 표시. */
  songLabel: string;
  /** 현재 보유 도토리. 모달 열 때 부모에서 넘김 (SSR fresh). */
  initialBalance: number;
  onClose: () => void;
  /** boost 성공 후 부모에서 잔액/리스트 갱신. */
  onSuccess: (info: { newBalance: number; spent: number }) => void;
};

const RANK_LABELS = [
  { idx: 0, icon: "🥇", label: "1등으로 올리기" },
  { idx: 1, icon: "🥈", label: "2등으로 올리기" },
  { idx: 2, icon: "🥉", label: "3등으로 올리기" },
] as const;

export function BoostModal({
  requestId,
  myScore,
  topScores,
  queueTopBoost,
  isMyselfQueueFirst,
  songLabel,
  initialBalance,
  onClose,
  onSuccess,
}: Props) {
  const router = useRouter();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customInput, setCustomInput] = useState<string>("");
  const [usingCustom, setUsingCustom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // "도토리 더 받기" 펼침 + 미완료 미션 lazy fetch
  const [moreOpen, setMoreOpen] = useState(false);
  const [incompleteMissions, setIncompleteMissions] = useState<
    IncompleteMissionItem[] | null
  >(null);
  const [moreLoading, setMoreLoading] = useState(false);
  useEffect(() => {
    if (!moreOpen || incompleteMissions !== null) return;
    let cancelled = false;
    setMoreLoading(true);
    loadIncompleteMissionsForUserAction(10)
      .then((items) => {
        if (!cancelled) setIncompleteMissions(items);
      })
      .catch(() => {
        if (!cancelled) setIncompleteMissions([]);
      })
      .finally(() => {
        if (!cancelled) setMoreLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [moreOpen, incompleteMissions]);

  const potentialAcorns = useMemo(
    () =>
      (incompleteMissions ?? []).reduce((sum, m) => sum + (m.acorns ?? 0), 0),
    [incompleteMissions]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  // 각 rank 자리에 가려면 필요한 도토리 — target_score - my_score + 1.
  // 이미 그 등수보다 점수가 같거나 높으면 0 (비활성).
  const rankOptions = useMemo(() => {
    return RANK_LABELS.map((r) => {
      const target = topScores[r.idx];
      if (target === undefined) return { ...r, needed: 0, disabled: true };
      const needed = target - myScore + 1;
      return {
        ...r,
        needed: Math.max(0, needed),
        disabled: needed <= 0,
      };
    });
  }, [myScore, topScores]);

  const effectiveAmount = usingCustom
    ? Math.max(0, Math.floor(Number(customInput) || 0))
    : selectedAmount ?? 0;

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

  // 1순위 점프 — 큐 1번의 boost + 1 도토리 결제. 본인이 이미 #1 이면 비활성.
  const jumpNeeded = Math.max(1, queueTopBoost + 1);
  const jumpDisabled =
    isMyselfQueueFirst || jumpNeeded > initialBalance || pending;
  const handleJumpFirst = useCallback(() => {
    if (jumpDisabled) return;
    setError(null);
    startTransition(async () => {
      const result = await jumpToQueueFirstAction(requestId, jumpNeeded);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess({
        newBalance: result.newBalance,
        spent: jumpNeeded,
      });
    });
  }, [jumpDisabled, jumpNeeded, requestId, onSuccess]);

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

        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-gradient-to-r from-fuchsia-50 to-violet-50 px-3 py-2 text-[12px] text-[#3D3A36]">
          <span className="inline-flex items-center gap-1.5">
            <AcornIcon size={12} className="text-fuchsia-700" />
            보유:{" "}
            <span className="font-bold tabular-nums text-fuchsia-700">
              {initialBalance.toLocaleString("ko-KR")}
            </span>
          </span>
          <span className="text-[#6B6560]">·</span>
          <span className="inline-flex items-center gap-1.5">
            내 점수:{" "}
            <span className="font-bold tabular-nums text-[#2D5A3D]">
              {myScore.toLocaleString("ko-KR")}
            </span>
          </span>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-bold text-[#2D5A3D]">
            순위로 올리기 (필요 도토리 자동 계산)
          </p>
          <div className="space-y-1.5">
            {rankOptions.map((opt) => {
              const cannotAfford = !opt.disabled && opt.needed > initialBalance;
              const active =
                !usingCustom && selectedAmount === opt.needed && !opt.disabled;
              return (
                <button
                  key={opt.idx}
                  type="button"
                  disabled={opt.disabled || cannotAfford}
                  onClick={() => {
                    setUsingCustom(false);
                    setSelectedAmount(opt.needed);
                    setError(null);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                    active
                      ? "border-fuchsia-500 bg-fuchsia-500 text-white shadow-md shadow-fuchsia-500/30"
                      : opt.disabled
                        ? "border-[#D4E4BC] bg-[#F5F1E8]/40 text-[#B8AFA5]"
                        : cannotAfford
                          ? "border-[#D4E4BC] bg-[#F5F1E8]/60 text-[#B8AFA5]"
                          : "border-[#D4E4BC] bg-white text-[#3D3A36] hover:border-fuchsia-300 hover:bg-fuchsia-50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden>{opt.icon}</span>
                    {opt.label}
                  </span>
                  {opt.disabled ? (
                    <span className="text-[11px] font-normal opacity-70">
                      이미 그 위
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[12px] font-mono">
                      <AcornIcon
                        size={11}
                        className={active ? "text-white" : "text-fuchsia-700"}
                      />
                      {opt.needed.toLocaleString("ko-KR")}
                      {cannotAfford && (
                        <span className="ml-1 text-[10px] font-normal text-rose-500">
                          (부족)
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 🚀 1순위 점프 — 방송 큐 #1 자리 즉시 진입 (별도 액션) */}
          <button
            type="button"
            onClick={handleJumpFirst}
            disabled={jumpDisabled}
            className={`flex w-full items-center justify-between rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition ${
              isMyselfQueueFirst
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : jumpNeeded > initialBalance
                  ? "border-[#D4E4BC] bg-[#F5F1E8]/60 text-[#B8AFA5]"
                  : "border-rose-500 bg-gradient-to-r from-rose-50 to-orange-50 text-rose-700 hover:from-rose-100 hover:to-orange-100"
            }`}
          >
            <span className="flex items-center gap-2">
              <span aria-hidden>🚀</span>
              방송 큐 #1 점프!
            </span>
            {isMyselfQueueFirst ? (
              <span className="text-[11px] font-normal">이미 #1 이에요</span>
            ) : (
              <span className="inline-flex items-center gap-1 font-mono text-[12px]">
                <AcornIcon
                  size={11}
                  className={
                    jumpNeeded > initialBalance
                      ? "text-[#B8AFA5]"
                      : "text-rose-600"
                  }
                />
                {jumpNeeded}
                {jumpNeeded > initialBalance && (
                  <span className="ml-1 text-[10px] font-normal text-rose-500">
                    (부족)
                  </span>
                )}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setUsingCustom(true);
              setSelectedAmount(null);
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
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                aria-label="1 감소"
                onClick={() => {
                  setError(null);
                  const cur = Math.max(0, Math.floor(Number(customInput) || 0));
                  const next = Math.max(0, cur - 1);
                  setCustomInput(String(next));
                }}
                disabled={Number(customInput || 0) <= 0}
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-rose-300 bg-rose-50 text-lg font-bold text-rose-600 transition hover:bg-rose-100 active:scale-95 disabled:opacity-40"
              >
                −
              </button>
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
                  const v = e.target.value.replace(/[^\d]/g, "");
                  setCustomInput(v);
                }}
                placeholder="0"
                className="min-w-0 flex-1 rounded-xl border-2 border-fuchsia-200 bg-white px-3 py-3 text-center font-mono text-2xl font-bold text-fuchsia-700 outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-200"
              />
              <button
                type="button"
                aria-label="1 증가"
                onClick={() => {
                  setError(null);
                  const cur = Math.max(0, Math.floor(Number(customInput) || 0));
                  const next = Math.min(initialBalance, cur + 1);
                  setCustomInput(String(next));
                }}
                disabled={Number(customInput || 0) >= initialBalance}
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-50 text-lg font-bold text-emerald-600 transition hover:bg-emerald-100 active:scale-95 disabled:opacity-40"
              >
                +
              </button>
            </div>
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

        {/* 도토리 더 받기 — 미완료 미션 안내 */}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800 transition hover:bg-emerald-100"
          >
            <span className="inline-flex items-center gap-1.5">
              <AcornIcon size={12} className="text-emerald-700" />
              도토리 더 받기
              {incompleteMissions && incompleteMissions.length > 0 && (
                <span className="rounded-full bg-emerald-200 px-1.5 py-0.5 text-[10px] text-emerald-800">
                  +{potentialAcorns} 가능
                </span>
              )}
            </span>
            <span aria-hidden className="text-[10px]">
              {moreOpen ? "▲" : "▼"}
            </span>
          </button>
          {moreOpen && (
            <div className="mt-2 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-2">
              {moreLoading ? (
                <p className="text-center text-[11px] text-[#8B7F75]">
                  불러오는 중...
                </p>
              ) : !incompleteMissions || incompleteMissions.length === 0 ? (
                <p className="text-center text-[11px] text-[#8B7F75]">
                  더 받을 수 있는 미션이 없어요 🎉
                </p>
              ) : (
                <ul className="space-y-1">
                  {incompleteMissions.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          router.push(`/missions/${m.id}`);
                        }}
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-transparent bg-white px-2.5 py-1.5 text-[12px] text-[#3D3A36] transition hover:border-emerald-300 hover:bg-emerald-50"
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span aria-hidden>{m.icon ?? "🎯"}</span>
                          <span className="truncate font-semibold">
                            {m.title}
                          </span>
                        </span>
                        <span className="inline-flex flex-shrink-0 items-center gap-1 font-mono text-[11px] font-bold text-emerald-700">
                          <AcornIcon size={10} /> +{m.acorns}{" "}
                          <span className="text-[10px] opacity-60">→</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <p className="mt-3 text-[10px] leading-relaxed text-[#8B7F75]">
          💡 점수 = 하트 + 끌어올리기 누적. 신청이 거절되면 자동 환불됩니다.
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
            className="flex-[2] inline-flex items-center justify-center gap-1 rounded-xl bg-fuchsia-500 px-3 py-3 text-sm font-bold text-white shadow-md shadow-fuchsia-500/40 transition hover:bg-fuchsia-600 disabled:cursor-not-allowed disabled:bg-[#B8AFA5] disabled:shadow-none"
          >
            {pending ? (
              "처리 중..."
            ) : insufficient ? (
              "도토리 부족"
            ) : invalid ? (
              "옵션 선택"
            ) : (
              <>
                💎 <AcornIcon size={12} />{" "}
                {effectiveAmount.toLocaleString("ko-KR")} 결제
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
