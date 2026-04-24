"use client";

// 토리FM 활성 투표 카드.
//  - Realtime: tori_fm_polls UPDATE (options bump) + tori_fm_poll_votes INSERT (session 내 poll 관련).
//  - 카운트다운: ends_at 기준 setInterval 1s.
//  - 투표 후 disabled + 본인 선택 하이라이트.

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { votePollAction } from "@/lib/tori-fm/actions";
import type { FmPollRow, FmPollOption } from "@/lib/tori-fm/types";

type Props = {
  initialPoll: FmPollRow | null;
  userVote: string | null;
  sessionId: string;
};

function useCountdown(endsAt: string | undefined): number {
  const [remaining, setRemaining] = useState<number>(() => {
    if (!endsAt) return 0;
    return Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!endsAt) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000)
      );
      setRemaining(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return remaining;
}

export function PollCard({ initialPoll, userVote, sessionId }: Props) {
  const [poll, setPoll] = useState<FmPollRow | null>(initialPoll);
  const [myVote, setMyVote] = useState<string | null>(userVote);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const remaining = useCountdown(poll?.ends_at);

  useEffect(() => {
    if (!sessionId) return;
    const supa = createClient();

    type PollPayload = {
      eventType?: "INSERT" | "UPDATE" | "DELETE";
      new?: FmPollRow;
      old?: FmPollRow;
    };

    const handlePoll = (payload: PollPayload) => {
      const row = payload.new;
      if (!row) return;
      // 현재 카드가 해당 poll 이면 갱신
      setPoll((prev) => {
        if (!prev) {
          if (row.status === "ACTIVE") return row;
          return prev;
        }
        if (row.id !== prev.id) return prev;
        return row;
      });
    };

    const channel = supa
      .channel(`tori-fm-poll-${sessionId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "tori_fm_polls",
          filter: `session_id=eq.${sessionId}`,
        } as never,
        handlePoll as never
      )
      .subscribe();

    return () => {
      supa.removeChannel(channel);
    };
  }, [sessionId]);

  const totalVotes = useMemo(() => {
    if (!poll) return 0;
    return poll.options.reduce((sum, o) => sum + (o.votes ?? 0), 0);
  }, [poll]);

  const handleVote = useCallback(
    (optionId: string) => {
      if (!poll) return;
      if (myVote) return;
      if (poll.status !== "ACTIVE") return;
      if (remaining <= 0) return;

      // optimistic
      const prevVote = myVote;
      setMyVote(optionId);
      setPoll((prev) =>
        prev
          ? {
              ...prev,
              options: prev.options.map((o) =>
                o.id === optionId ? { ...o, votes: (o.votes ?? 0) + 1 } : o
              ),
            }
          : prev
      );
      setError(null);

      startTransition(async () => {
        try {
          await votePollAction(poll.id, optionId);
        } catch (e) {
          // rollback
          setMyVote(prevVote);
          setPoll((prev) =>
            prev
              ? {
                  ...prev,
                  options: prev.options.map((o) =>
                    o.id === optionId
                      ? { ...o, votes: Math.max(0, (o.votes ?? 0) - 1) }
                      : o
                  ),
                }
              : prev
          );
          const msg = e instanceof Error ? e.message : "투표에 실패했어요";
          setError(msg);
        }
      });
    },
    [myVote, poll, remaining]
  );

  if (!poll) return null;

  const isEnded =
    poll.status !== "ACTIVE" || remaining <= 0 || !!myVote;

  return (
    <section className="rounded-3xl border border-violet-300 bg-gradient-to-br from-violet-50 to-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-violet-800">🗳 실시간 투표</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            remaining > 0 && poll.status === "ACTIVE"
              ? "bg-violet-600 text-white"
              : "bg-zinc-200 text-zinc-600"
          }`}
        >
          {poll.status === "ACTIVE" && remaining > 0
            ? `${remaining}초 남음`
            : "투표 종료"}
        </span>
      </div>
      <p className="mt-2 text-sm font-bold text-[#2D3A4E]">{poll.question}</p>

      <ul className="mt-3 space-y-2" role="radiogroup" aria-label="투표 선택지">
        {poll.options.map((opt: FmPollOption) => {
          const pct =
            totalVotes > 0
              ? Math.round(((opt.votes ?? 0) / totalVotes) * 100)
              : 0;
          const isMine = myVote === opt.id;
          const isWinner =
            poll.winner_option_id && poll.winner_option_id === opt.id;
          return (
            <li key={opt.id}>
              <button
                type="button"
                onClick={() => handleVote(opt.id)}
                disabled={isEnded || isPending}
                role="radio"
                aria-checked={isMine}
                className={`relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.99] ${
                  isMine
                    ? "border-violet-600 bg-violet-100"
                    : isWinner
                    ? "border-amber-400 bg-amber-50"
                    : "border-[#D4E4BC] bg-white hover:border-violet-400"
                } disabled:cursor-not-allowed`}
              >
                <span
                  className={`absolute inset-y-0 left-0 transition-[width] duration-300 ${
                    isMine ? "bg-violet-200/60" : "bg-violet-100/60"
                  }`}
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
                <div className="relative flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-[#2D3A4E]">
                    {isMine && "✓ "}
                    {opt.label}
                  </span>
                  <span className="flex-none text-xs font-bold text-violet-700">
                    {opt.votes ?? 0}표 · {pct}%
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mt-2 text-xs text-rose-600" role="alert">
          {error}
        </p>
      )}
      {myVote && !error && (
        <p className="mt-2 text-center text-[11px] text-violet-700">
          투표 완료! 결과를 실시간으로 확인하세요
        </p>
      )}
    </section>
  );
}
