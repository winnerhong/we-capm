"use client";

import { useEffect, useState } from "react";

export type PollEvent = {
  id: string;
  question: string;
  options: Array<{ id: string; label: string; votes: number }>;
  durationSec: number;
  startedAt: string;
};

export type PollWinnerEvent = {
  pollId: string;
  winnerLabel: string;
};

interface Props {
  activePoll: PollEvent | null;
  winnerEvent?: PollWinnerEvent | null;
}

type Phase = "big" | "mini" | "done";

/**
 * 투표 팝업.
 *  - 0~0.5s: 중앙 zoom-in (bounce)
 *  - 0.5~3.5s: 중앙 big 표시
 *  - 3.5~4s: 우하단으로 shrink
 *  - 이후: 우하단 미니 위젯 (종료까지)
 *  - winnerEvent 들어오면 중앙 재팝업 (2s)
 */
export function PollPopup({ activePoll, winnerEvent }: Props) {
  const [phase, setPhase] = useState<Phase>("done");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [winnerVisible, setWinnerVisible] = useState(false);
  const [winnerLabel, setWinnerLabel] = useState<string>("");

  // activePoll 변경 시 big → mini 전환
  useEffect(() => {
    if (!activePoll) {
      setPhase("done");
      setCurrentId(null);
      return;
    }
    if (activePoll.id === currentId) return;
    setCurrentId(activePoll.id);
    setPhase("big");
    const toMini = setTimeout(() => setPhase("mini"), 4000);
    return () => clearTimeout(toMini);
  }, [activePoll, currentId]);

  // winnerEvent 2초 노출
  useEffect(() => {
    if (!winnerEvent) return;
    setWinnerLabel(winnerEvent.winnerLabel);
    setWinnerVisible(true);
    const t = setTimeout(() => setWinnerVisible(false), 2000);
    return () => clearTimeout(t);
  }, [winnerEvent]);

  const total =
    activePoll?.options.reduce((sum, o) => sum + o.votes, 0) ?? 0;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
    >
      {activePoll && phase === "big" && (
        <div
          key={`big-${activePoll.id}`}
          className="vfx-poll-big w-[92%] max-w-2xl rounded-3xl border-2 border-[#E5B88A]/70 bg-gradient-to-br from-[#1a120a] via-[#2a1f15] to-[#1a120a] p-6 shadow-[0_0_60px_rgba(229,184,138,0.5)] md:p-10"
        >
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#E5B88A] md:text-sm">
            📊 실시간 투표
          </div>
          <div className="mb-5 text-2xl font-extrabold text-[#F5E4CC] md:text-4xl">
            {activePoll.question}
          </div>
          <div className="space-y-3">
            {activePoll.options.map((opt) => {
              const pct = total > 0 ? (opt.votes / total) * 100 : 0;
              return (
                <div
                  key={opt.id}
                  className="relative overflow-hidden rounded-xl border border-[#C4956A]/40 bg-[#0f0a07]/80 px-4 py-3"
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#C4956A]/60 via-[#E5B88A]/40 to-[#C4956A]/20 transition-[width] duration-500"
                    style={{ width: `${pct}%` }}
                  />
                  <div className="relative flex items-center justify-between">
                    <span className="text-base font-bold text-[#F5E4CC] md:text-xl">
                      {opt.label}
                    </span>
                    <span className="text-sm font-bold text-[#E5B88A] md:text-lg">
                      {opt.votes}표 · {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activePoll && phase === "mini" && (
        <div className="pointer-events-none absolute bottom-6 right-6 w-64 rounded-xl border border-[#C4956A]/60 bg-[#1a120a]/95 p-3 shadow-[0_0_24px_rgba(196,149,106,0.35)] backdrop-blur md:w-80 md:p-4">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#E5B88A] md:text-xs">
            📊 투표 진행 중
          </div>
          <div className="mb-2 line-clamp-1 text-sm font-bold text-[#F5E4CC] md:text-base">
            {activePoll.question}
          </div>
          <div className="space-y-1.5">
            {activePoll.options.map((opt) => {
              const pct = total > 0 ? (opt.votes / total) * 100 : 0;
              return (
                <div key={opt.id} className="relative">
                  <div className="flex items-center justify-between text-[11px] text-[#F5E4CC] md:text-xs">
                    <span className="line-clamp-1 pr-2">{opt.label}</span>
                    <span className="shrink-0 font-bold text-[#E5B88A]">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[#0f0a07]">
                    <div
                      className="h-full bg-gradient-to-r from-[#C4956A] to-[#E5B88A] transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {winnerVisible && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="vfx-poll-big w-[88%] max-w-xl rounded-3xl border-2 border-[#FFD700] bg-gradient-to-br from-[#2a1f15] via-[#3a2f15] to-[#2a1f15] p-6 text-center shadow-[0_0_80px_rgba(255,215,0,0.5)] md:p-10">
            <div className="mb-2 text-sm font-bold uppercase tracking-[0.3em] text-[#FFD700] md:text-base">
              🏆 투표 종료
            </div>
            <div className="text-3xl font-extrabold text-[#F5E4CC] md:text-5xl">
              1위: {winnerLabel}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
