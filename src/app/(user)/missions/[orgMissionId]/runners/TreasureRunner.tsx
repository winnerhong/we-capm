"use client";

// TREASURE runner — 단계별로 힌트를 풀고 마지막 QR 로 완료 처리.
// 각 단계의 언락은 unlockTreasureStepAction 으로 서버에 기록.
// 모든 단계 언락 후 "최종 관문" QR 을 스캔하면 submitMissionAction 호출.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  MissionTreasureProgressRow,
  OrgMissionRow,
  TreasureMissionConfig,
  TreasureUnlockMethod,
} from "@/lib/missions/types";
import { QrScanner } from "@/components/qr-scanner";
import {
  submitMissionAction,
  unlockTreasureStepAction,
} from "../../actions";

interface Props {
  mission: OrgMissionRow;
  config: TreasureMissionConfig;
  initialProgress: MissionTreasureProgressRow[];
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function TreasureRunner({ mission, config, initialProgress }: Props) {
  const router = useRouter();
  const [progress, setProgress] =
    useState<MissionTreasureProgressRow[]>(initialProgress);
  const [answerInput, setAnswerInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [unlockPending, unlockTransition] = useTransition();
  const [submitPending, submitTransition] = useTransition();

  // 정렬된 steps (order ASC) + 언락 여부 맵
  const sortedSteps = useMemo(
    () => [...(config.steps ?? [])].sort((a, b) => a.order - b.order),
    [config.steps]
  );
  const totalSteps = sortedSteps.length;

  const unlockedOrders = useMemo(() => {
    const set = new Set<number>();
    for (const p of progress) set.add(p.step_order);
    return set;
  }, [progress]);
  const unlockedCount = unlockedOrders.size;

  // 현재 풀어야 할 단계: 가장 낮은 order 중 아직 언락 안 된 것
  const currentStep = useMemo(
    () => sortedSteps.find((s) => !unlockedOrders.has(s.order)) ?? null,
    [sortedSteps, unlockedOrders]
  );
  const allStepsCleared = totalSteps > 0 && unlockedCount >= totalSteps;

  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const attemptUnlock = (
    stepOrder: number,
    method: TreasureUnlockMethod,
    answer?: string
  ) => {
    setErrorMsg(null);
    unlockTransition(async () => {
      try {
        await unlockTreasureStepAction(mission.id, stepOrder, method, answer);
        // 서버에서 insert 되었으니 로컬도 갱신 (낙관적)
        setProgress((prev) => {
          if (prev.some((p) => p.step_order === stepOrder)) return prev;
          return [
            ...prev,
            {
              id: `tmp-${stepOrder}`,
              org_mission_id: mission.id,
              user_id: "",
              step_order: stepOrder,
              unlocked_at: new Date().toISOString(),
              unlock_method: method,
            },
          ];
        });
        setAnswerInput("");
        flashToast(`${stepOrder}단계 해제!`);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setErrorMsg(msg);
      }
    });
  };

  const handleFinalScan = (scanned: string) => {
    setErrorMsg(null);
    const expected = (config.final_qr_token ?? "").trim();
    if (expected && scanned !== expected) {
      setErrorMsg("최종 QR 코드가 일치하지 않아요");
      return;
    }
    submitTransition(async () => {
      try {
        const steps_cleared = [...unlockedOrders]
          .sort((a, b) => a - b)
          .map((step_order) => {
            const found = progress.find((p) => p.step_order === step_order);
            return {
              step_order,
              method: (found?.unlock_method ?? "AUTO") as TreasureUnlockMethod,
              at: found?.unlocked_at ?? new Date().toISOString(),
            };
          });
        const result = await submitMissionAction(mission.id, {
          steps_cleared,
          final_qr_token_scanned: scanned,
        });
        if (result.redirectTo) {
          router.push(result.redirectTo);
          router.refresh();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setErrorMsg(msg);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* 진행 헤더 */}
      <section className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0]/40 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B6560]">
              보물찾기
            </p>
            <h2 className="mt-0.5 flex items-center gap-1.5 text-base font-bold text-[#2D5A3D]">
              <span aria-hidden>🗺</span> 단계별 힌트를 풀어보세요
            </h2>
          </div>
          <div className="rounded-2xl border border-[#D4E4BC] bg-white/90 px-3 py-1.5 text-center">
            <p className="text-sm font-bold tabular-nums text-[#2D5A3D]">
              {unlockedCount} <span className="text-[#8B7F75]">/</span>{" "}
              {totalSteps}
            </p>
            <p className="text-[10px] font-semibold text-[#6B6560]">단계</p>
          </div>
        </div>
        <div
          className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/70"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalSteps}
          aria-valuenow={unlockedCount}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#3A7A52] to-[#4A7C59] transition-all"
            style={{
              width: `${
                totalSteps === 0 ? 0 : (unlockedCount / totalSteps) * 100
              }%`,
            }}
          />
        </div>
      </section>

      {/* 현재 단계 카드 (모든 단계 해제 전까지) */}
      {!allStepsCleared && currentStep && (
        <section className="rounded-3xl border-2 border-[#2D5A3D] bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2D5A3D] text-lg font-bold text-white shadow-sm">
              {currentStep.order}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B6560]">
                {currentStep.order}단계 힌트
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#3D3A36]">
                {currentStep.hint_text}
              </p>
            </div>
          </div>

          {/* 언락 UI */}
          <div className="mt-4 space-y-3 border-t border-[#D4E4BC] pt-4">
            {currentStep.unlock_rule === "AUTO" && (
              <>
                <p className="text-[12px] font-semibold text-[#2D5A3D]">
                  🌿 이전 단계 해제 후 자동으로 열렸어요
                </p>
                <button
                  type="button"
                  onClick={() => attemptUnlock(currentStep.order, "AUTO")}
                  disabled={unlockPending}
                  className="min-h-[48px] w-full rounded-2xl bg-[#2D5A3D] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#3A7A52] active:scale-[0.99] disabled:bg-[#B8C7B0]"
                >
                  {unlockPending ? "처리 중..." : "다음 단계로 ▶"}
                </button>
              </>
            )}

            {currentStep.unlock_rule === "QR" && (
              <>
                <p className="text-[12px] font-semibold text-[#2D5A3D]">
                  🔲 숨겨진 QR 코드를 찾아 스캔하세요
                </p>
                <QrScanner
                  expectPrefix="ts_"
                  buttonLabel="📷 단계 QR 스캔"
                  onScan={(text) => {
                    const expected = (currentStep.answer ?? "").trim();
                    if (expected && text.trim() !== expected) {
                      setErrorMsg("이 단계의 QR 코드가 아니에요");
                      return;
                    }
                    attemptUnlock(currentStep.order, "QR", text.trim());
                  }}
                  onError={(msg) => setErrorMsg(msg)}
                />
              </>
            )}

            {currentStep.unlock_rule === "ANSWER" && (
              <>
                <p className="text-[12px] font-semibold text-[#2D5A3D]">
                  ✏ 힌트의 정답을 입력하세요
                </p>
                <input
                  id="treasure-answer"
                  type="text"
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  placeholder="정답을 입력해 주세요"
                  inputMode="text"
                  autoComplete="off"
                  className="min-h-[48px] w-full rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3 text-sm text-[#3D3A36] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
                />
                <button
                  type="button"
                  onClick={() =>
                    attemptUnlock(
                      currentStep.order,
                      "ANSWER",
                      answerInput.trim()
                    )
                  }
                  disabled={unlockPending || answerInput.trim().length === 0}
                  className="min-h-[48px] w-full rounded-2xl bg-[#2D5A3D] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#3A7A52] active:scale-[0.99] disabled:bg-[#B8C7B0]"
                >
                  {unlockPending ? "확인 중..." : "정답 확인"}
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {/* 최종 관문 (모든 단계 해제 시) */}
      {allStepsCleared && (
        <section className="rounded-3xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 via-white to-amber-100/50 p-5 shadow-sm">
          <p className="text-center text-5xl" aria-hidden>
            🎯
          </p>
          <h3 className="mt-2 text-center text-lg font-bold text-amber-900">
            최종 관문
          </h3>
          <p className="mt-1 text-center text-sm text-amber-800">
            마지막 장소의 QR 코드를 스캔해 완료하세요
          </p>
          <div className="mt-4">
            <QrScanner
              expectPrefix="tr_"
              buttonLabel="🎁 최종 QR 스캔"
              onScan={(text) => handleFinalScan(text.trim())}
              onError={(msg) => setErrorMsg(msg)}
            />
          </div>
          {submitPending && (
            <p className="mt-2 text-center text-[12px] font-semibold text-amber-900">
              제출 중...
            </p>
          )}
        </section>
      )}

      {/* 토스트 */}
      {toast && (
        <p
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-[12px] font-semibold text-emerald-800"
        >
          ✅ {toast}
        </p>
      )}
      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
        >
          ⚠️ {errorMsg}
        </div>
      )}

      {/* 이미 해제한 단계 목록 */}
      {unlockedCount > 0 && (
        <section className="rounded-3xl border border-[#D4E4BC] bg-white/80 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B6560]">
            해제한 단계
          </p>
          <ul className="mt-2 space-y-1.5">
            {sortedSteps
              .filter((s) => unlockedOrders.has(s.order))
              .map((s) => {
                const p = progress.find((r) => r.step_order === s.order);
                return (
                  <li
                    key={s.order}
                    className="flex items-center gap-2 rounded-2xl bg-[#E8F0E4] px-3 py-2"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2D5A3D] text-[11px] font-bold text-white">
                      {s.order}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#2D5A3D]">
                      {s.hint_text}
                    </span>
                    {p?.unlocked_at && (
                      <span className="shrink-0 text-[10px] font-semibold text-[#6B6560]">
                        {formatDateTime(p.unlocked_at)}
                      </span>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      )}
    </div>
  );
}
