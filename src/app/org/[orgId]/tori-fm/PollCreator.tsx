"use client";

// PollCreator — DJ 투표 생성·관리 위젯
//  - activePoll 있으면: 현재 카드 + 득표수 + 남은 시간 + 즉시 종료 버튼
//  - 없으면: 질문 + 옵션(2~5) + 지속시간 폼
//  - Realtime: tori_fm_polls · tori_fm_poll_votes
//  - 서버 액션 결과는 revalidatePath 로 page 가 다시 로드됨 → initialPoll 갱신.
//    Realtime 은 카운트 변화 / 외부 종료 반영용.

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  createPollAction,
  endPollAction,
} from "@/lib/tori-fm/actions";
import type { FmPollRow } from "@/lib/tori-fm/types";

interface Props {
  sessionId: string;
  initialPoll: FmPollRow | null;
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 5;
const MIN_DURATION = 15;
const MAX_DURATION = 600;
const DEFAULT_DURATION = 60;

export function PollCreator({ sessionId, initialPoll }: Props) {
  const [poll, setPoll] = useState<FmPollRow | null>(initialPoll);

  // Realtime: 투표 상태·옵션 캐시 변화
  useEffect(() => {
    if (!sessionId) return;
    const supa = createClient();
    const ch = supa
      .channel(`dj-polls-${sessionId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "tori_fm_polls",
          filter: `session_id=eq.${sessionId}`,
        } as never,
        ((payload: {
          eventType: string;
          new: FmPollRow | null;
          old: FmPollRow | null;
        }) => {
          const row = payload.new ?? payload.old;
          if (!row) return;
          if (payload.eventType === "DELETE") {
            setPoll((cur) => (cur && cur.id === row.id ? null : cur));
            return;
          }
          setPoll((cur) => {
            if (!payload.new) return cur;
            if (payload.new.status !== "ACTIVE") {
              if (cur && cur.id === payload.new.id) return null;
              return cur;
            }
            return payload.new;
          });
        }) as never
      )
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "tori_fm_poll_votes",
        } as never,
        ((payload: { new: { poll_id: string; option_id: string } }) => {
          setPoll((cur) => {
            if (!cur || cur.id !== payload.new.poll_id) return cur;
            const nextOptions = cur.options.map((o) =>
              o.id === payload.new.option_id
                ? { ...o, votes: (o.votes ?? 0) + 1 }
                : o
            );
            return { ...cur, options: nextOptions };
          });
        }) as never
      )
      .subscribe();
    return () => {
      supa.removeChannel(ch);
    };
  }, [sessionId]);

  // Sync initialPoll from server props when server action revalidates
  useEffect(() => {
    setPoll(initialPoll);
  }, [initialPoll]);

  if (poll && poll.status === "ACTIVE") {
    return (
      <ActivePollCard
        poll={poll}
        onEnded={() => setPoll(null)}
      />
    );
  }

  return <PollForm sessionId={sessionId} />;
}

/* -------------------------------------------------------------------------- */
/* Active poll card                                                           */
/* -------------------------------------------------------------------------- */

function ActivePollCard({
  poll,
  onEnded,
}: {
  poll: FmPollRow;
  onEnded: () => void;
}) {
  const [now, setNow] = useState<number>(() => Date.now());
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const endsAt = useMemo(
    () => new Date(poll.ends_at).getTime(),
    [poll.ends_at]
  );
  const remainingSec = Math.max(0, Math.floor((endsAt - now) / 1000));
  const totalVotes = useMemo(
    () => poll.options.reduce((s, o) => s + (o.votes ?? 0), 0),
    [poll.options]
  );
  const winnerVotes = useMemo(
    () =>
      poll.options.reduce(
        (max, o) => Math.max(max, o.votes ?? 0),
        0
      ),
    [poll.options]
  );

  const onEnd = useCallback(() => {
    const ok = window.confirm("투표를 지금 종료할까요?");
    if (!ok) return;
    setErr(null);
    startTransition(async () => {
      try {
        await endPollAction(poll.id);
        onEnded();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "종료에 실패했어요");
      }
    });
  }, [poll.id, onEnded]);

  return (
    <section
      aria-label="진행 중인 투표"
      className="rounded-3xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-white to-[#F5F1E8] p-4 shadow-sm md:p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-white"
            aria-label="진행 중"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            LIVE 투표
          </span>
          <span className="text-[11px] font-semibold text-[#8B7F75]">
            총 {totalVotes}표
          </span>
        </div>
        <span className="font-mono text-sm font-bold tabular-nums text-amber-700">
          ⏳ {remainingSec}s
        </span>
      </header>

      <h3 className="mt-2 text-base font-bold text-[#2D5A3D] md:text-lg">
        {poll.question}
      </h3>

      <ul className="mt-3 space-y-2">
        {poll.options.map((o) => {
          const votes = o.votes ?? 0;
          const ratio =
            totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const isWinner = winnerVotes > 0 && votes === winnerVotes;
          return (
            <li
              key={o.id}
              className={`relative overflow-hidden rounded-xl border bg-white p-2.5 text-sm shadow-sm ${
                isWinner
                  ? "border-amber-400"
                  : "border-[#D4E4BC]"
              }`}
            >
              <div
                className={`absolute inset-y-0 left-0 ${
                  isWinner ? "bg-amber-100" : "bg-[#E8F0E4]"
                }`}
                style={{ width: `${ratio}%` }}
                aria-hidden
              />
              <div className="relative flex items-center justify-between gap-2">
                <span className="truncate font-semibold text-[#2D5A3D]">
                  {isWinner && <span className="mr-1">👑</span>}
                  {o.label}
                </span>
                <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-[#2D5A3D]">
                  {votes}표 · {ratio}%
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-[#8B7F75]">
          📅 시작 {new Date(poll.starts_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
        <button
          type="button"
          onClick={onEnd}
          disabled={pending}
          className="rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
        >
          {pending ? "종료 중…" : "⏹ 즉시 종료"}
        </button>
      </div>
      {err && (
        <p role="alert" className="mt-2 text-[11px] text-rose-600">
          {err}
        </p>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Poll form                                                                  */
/* -------------------------------------------------------------------------- */

function PollForm({ sessionId }: { sessionId: string }) {
  const [question, setQuestion] = useState<string>("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [durationSec, setDurationSec] = useState<number>(DEFAULT_DURATION);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canAdd = options.length < MAX_OPTIONS;
  const canRemove = options.length > MIN_OPTIONS;

  const addOption = () => {
    if (!canAdd) return;
    setOptions((prev) => [...prev, ""]);
  };
  const removeOption = (idx: number) => {
    if (!canRemove) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  };
  const setOption = (idx: number, val: string) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? val : o)));
  };

  const onSubmit = () => {
    setErr(null);
    const q = question.trim();
    if (!q) {
      setErr("투표 질문을 입력해 주세요");
      return;
    }
    if (q.length > 200) {
      setErr("질문은 200자까지만 가능해요");
      return;
    }
    const cleaned = options.map((o) => o.trim()).filter((o) => o.length > 0);
    if (cleaned.length < MIN_OPTIONS) {
      setErr("보기를 2개 이상 입력해 주세요");
      return;
    }

    const fd = new FormData();
    fd.set("question", q);
    fd.set("duration_sec", String(durationSec));
    cleaned.forEach((o) => fd.append("options", o));

    startTransition(async () => {
      try {
        await createPollAction(sessionId, fd);
        setQuestion("");
        setOptions(["", ""]);
        setDurationSec(DEFAULT_DURATION);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "투표 생성에 실패했어요");
      }
    });
  };

  const canSubmit =
    !pending &&
    question.trim().length > 0 &&
    options.filter((o) => o.trim().length > 0).length >= MIN_OPTIONS;

  return (
    <section
      aria-label="투표 만들기"
      className="rounded-3xl border border-[#D4E4BC] bg-white p-4 shadow-sm md:p-5"
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span aria-hidden>📊</span>
          <span>투표 만들기</span>
        </h2>
        <p className="text-[11px] text-[#8B7F75]">
          청취자에게 즉석 투표를 띄워보세요
        </p>
      </header>

      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
            질문
          </span>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={200}
            placeholder="예) 다음 곡은 어떤 분위기가 좋을까요?"
            className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm outline-none placeholder:text-[#8B7F75] focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
          <span className="mt-1 block text-right text-[10px] tabular-nums text-[#8B7F75]">
            {question.length} / 200
          </span>
        </label>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#2D5A3D]">
              보기 ({options.length} / {MAX_OPTIONS})
            </span>
            <button
              type="button"
              onClick={addOption}
              disabled={!canAdd}
              className="rounded-lg border border-[#D4E4BC] bg-[#F9F7F2] px-2 py-1 text-[11px] font-semibold text-[#2D5A3D] transition hover:bg-[#E8F0E4] disabled:opacity-40"
            >
              ➕ 보기 추가
            </button>
          </div>
          <ul className="space-y-2">
            {options.map((o, i) => (
              <li key={i} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E8F0E4] text-xs font-bold text-[#2D5A3D]"
                >
                  {i + 1}
                </span>
                <input
                  type="text"
                  value={o}
                  onChange={(e) => setOption(i, e.target.value)}
                  maxLength={100}
                  placeholder={`보기 ${i + 1}`}
                  aria-label={`보기 ${i + 1}`}
                  className="flex-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm outline-none placeholder:text-[#8B7F75] focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  disabled={!canRemove}
                  aria-label={`보기 ${i + 1} 삭제`}
                  className="rounded-lg p-1.5 text-rose-500 transition hover:bg-rose-50 disabled:opacity-30"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
            지속 시간 ({MIN_DURATION}~{MAX_DURATION}초) · 현재 {durationSec}초
          </span>
          <input
            type="range"
            min={MIN_DURATION}
            max={MAX_DURATION}
            step={5}
            value={durationSec}
            onChange={(e) => setDurationSec(Number(e.target.value))}
            className="w-full accent-[#2D5A3D]"
          />
          <div className="mt-1 flex gap-2">
            {[30, 60, 120, 300].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDurationSec(d)}
                className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                  durationSec === d
                    ? "bg-[#2D5A3D] text-white"
                    : "border border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#F9F7F2]"
                }`}
              >
                {d < 60 ? `${d}초` : `${d / 60}분`}
              </button>
            ))}
          </div>
        </label>

        {err && (
          <p role="alert" className="text-xs text-rose-600">
            {err}
          </p>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="w-full rounded-xl bg-[#2D5A3D] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#234A31] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "시작 중…" : "📊 투표 시작"}
        </button>
      </div>
    </section>
  );
}

