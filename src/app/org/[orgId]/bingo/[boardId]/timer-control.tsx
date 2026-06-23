"use client";

// 배열 타이머 컨트롤 — 기관 운영자가 빙고판 배열 시간을 정해 시작/취소/즉시 잠금.
//
// 상태:
//   1) arrange_ends_at = null → 미세팅 (시작 버튼 + 분 입력)
//   2) > now() → 진행중 (남은시간 카운트다운 + 취소/즉시잠금)
//   3) <= now() → 종료됨 (재시작 버튼)

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelBingoTimerAction,
  lockBingoArrangementAction,
  startBingoTimerAction,
} from "@/lib/bingo/actions";

interface Props {
  boardId: string;
  arrangeEndsAt: string | null;
  /** 관제실(다크 배경)에 임베드할 때 true. */
  dark?: boolean;
}

const DURATIONS = [3, 5, 10, 15, 30];

function formatMmSs(ms: number): string {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function BingoTimerControl({ boardId, arrangeEndsAt, dark = false }: Props) {
  const router = useRouter();
  const [pickedMinutes, setPickedMinutes] = useState(5);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // 1초 tick — 카운트다운 표시용.
  useEffect(() => {
    if (!arrangeEndsAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [arrangeEndsAt]);

  // 타이머 끝나는 순간 자동 새로고침 (잠금 상태 반영).
  useEffect(() => {
    if (!arrangeEndsAt) return;
    const ends = new Date(arrangeEndsAt).getTime();
    const remaining = ends - Date.now();
    if (remaining <= 0) return;
    const id = setTimeout(() => router.refresh(), remaining + 300);
    return () => clearTimeout(id);
  }, [arrangeEndsAt, router]);

  const endsMs = arrangeEndsAt ? new Date(arrangeEndsAt).getTime() : null;
  const isRunning = endsMs != null && endsMs > now;
  const isExpired = endsMs != null && endsMs <= now;
  const remaining = isRunning && endsMs ? endsMs - now : 0;

  function handleStart() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        await startBingoTimerAction(boardId, pickedMinutes);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "시작 실패");
      }
    });
  }

  function handleCancel() {
    if (pending) return;
    if (!confirm("타이머를 취소할까요? 참가자들이 다시 자유 배열할 수 있어요.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await cancelBingoTimerAction(boardId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "취소 실패");
      }
    });
  }

  function handleLockNow() {
    if (pending) return;
    if (!confirm("지금 바로 잠글까요? 참가자는 더 이상 빙고판을 바꿀 수 없어요.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await lockBingoArrangementAction(boardId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "잠금 실패");
      }
    });
  }

  return (
    <section
      className={`rounded-2xl border-2 p-4 shadow-sm transition ${
        dark
          ? isRunning
            ? "border-amber-400/40 bg-amber-500/10"
            : isExpired
              ? "border-rose-400/40 bg-rose-500/10"
              : "border-white/10 bg-white/5"
          : isRunning
            ? "border-amber-300 bg-gradient-to-br from-amber-50 via-white to-amber-50"
            : isExpired
              ? "border-rose-300 bg-gradient-to-br from-rose-50 via-white to-rose-50"
              : "border-[#D4E4BC] bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2
            className={`flex items-center gap-2 text-sm font-bold ${
              dark ? "text-amber-100" : "text-[#2D5A3D]"
            }`}
          >
            <span aria-hidden>⏱</span>
            <span>배열 타이머</span>
            {isRunning && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                진행중
              </span>
            )}
            {isExpired && (
              <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                🔒 잠금
              </span>
            )}
          </h2>
          <p
            className={`mt-1 text-[11px] ${
              dark ? "text-white/60" : "text-[#6B6560]"
            }`}
          >
            {isRunning
              ? "시간이 끝나면 참가자가 빙고판을 더 바꿀 수 없어요."
              : isExpired
                ? "참가자의 빙고판이 잠겨있어요. 재시작하면 다시 배열 가능."
                : "분을 정하고 [시작]을 누르면 참가자가 그 시간 동안 빙고판을 배열할 수 있어요."}
          </p>
        </div>

        {isRunning && (
          <div className="shrink-0 text-right">
            <p
              className={`text-[10px] font-bold uppercase tracking-wide ${
                dark ? "text-amber-300" : "text-amber-700"
              }`}
            >
              남은 시간
            </p>
            <p
              className={`font-mono text-3xl font-extrabold tabular-nums ${
                dark ? "text-amber-300" : "text-amber-700"
              }`}
            >
              {formatMmSs(remaining)}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
          ⚠ {error}
        </div>
      )}

      {/* 미세팅 or 종료됨 → 분 선택 + 시작 */}
      {!isRunning && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-5 gap-1.5">
            {DURATIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPickedMinutes(m)}
                disabled={pending}
                className={`rounded-lg border-2 py-2 text-xs font-bold transition ${
                  pickedMinutes === m
                    ? dark
                      ? "border-amber-400 bg-amber-500/20 text-amber-100"
                      : "border-amber-500 bg-amber-50 text-amber-800"
                    : dark
                      ? "border-white/15 bg-white/5 text-white/70 hover:border-amber-300/50"
                      : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-amber-300"
                }`}
              >
                {m}분
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleStart}
            disabled={pending}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
          >
            {pending
              ? "처리 중…"
              : isExpired
                ? `↻ ${pickedMinutes}분 재시작`
                : `⏱ ${pickedMinutes}분 시작`}
          </button>
        </div>
      )}

      {/* 진행중 → 취소 / 즉시 잠금 */}
      {isRunning && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-60 ${
              dark
                ? "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                : "border-[#D4E4BC] bg-white text-[#6B4423] hover:bg-[#FFF8F0]"
            }`}
          >
            🛑 취소 (자유 배열로)
          </button>
          <button
            type="button"
            onClick={handleLockNow}
            disabled={pending}
            className="flex-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            🔒 지금 잠금
          </button>
        </div>
      )}
    </section>
  );
}
