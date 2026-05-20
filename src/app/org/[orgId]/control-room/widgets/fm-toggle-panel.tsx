"use client";

// 토리FM 켜기 / 끄기 / 예약 토글 패널.
//   관제실에서 LIVE 세션이 없을 때 노출 — 방송을 즉시 켜거나, 미래 시각으로
//   예약하거나, 예약된 방송을 시작/취소할 수 있다.
//   끄기는 LIVE 중일 때 스튜디오 콘솔의 FmSessionControls 에서 처리.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createFmSessionAction,
  deleteFmSessionAction,
  quickStartLiveAction,
  startFmBroadcastAction,
} from "@/lib/missions/review-actions";
import type { ToriFmSessionRow } from "@/lib/missions/types";

interface Props {
  orgId: string;
  /** is_live=false 이고 아직 종료되지 않은 예약 세션들 (scheduled_start ASC). */
  scheduledSessions: ToriFmSessionRow[];
}

/** Date → datetime-local 입력값 "YYYY-MM-DDTHH:mm" (브라우저 로컬 = KST 가정). */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

/** ISO → "5월 22일 (금) 오후 12:00" 한국어 라벨, KST 고정. */
function fmtSchedule(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function FmTogglePanel({ orgId, scheduledSessions }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // 예약 폼 기본값 — 다음 정시 ~ +2시간
  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setMinutes(0, 0, 0);
  defaultStart.setHours(defaultStart.getHours() + 1);
  const defaultEnd = new Date(defaultStart.getTime() + 2 * 60 * 60 * 1000);

  const [name, setName] = useState("토리FM 방송");
  const [start, setStart] = useState(toLocalInput(defaultStart));
  const [end, setEnd] = useState(toLocalInput(defaultEnd));

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    setPending(true);
    try {
      await fn();
      setPending(false);
      router.refresh();
    } catch (e) {
      setPending(false);
      setError(e instanceof Error ? e.message : "처리 실패");
    }
  }

  function turnOn() {
    run(() => quickStartLiveAction(orgId, null, "토리FM 라이브"));
  }

  function submitSchedule() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("방송 이름을 입력해 주세요");
      return;
    }
    if (!start || !end) {
      setError("시작·종료 일시를 모두 입력해 주세요");
      return;
    }
    const fd = new FormData();
    fd.set("name", trimmed);
    fd.set("scheduled_start", start);
    fd.set("scheduled_end", end);
    run(async () => {
      await createFmSessionAction(orgId, fd);
      setScheduleOpen(false);
    });
  }

  return (
    <section
      aria-label="토리FM"
      className="space-y-4 rounded-2xl border border-amber-500/15 bg-[rgba(11,21,56,0.5)] p-5 text-amber-50"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-amber-100">
          <span aria-hidden className="text-lg">
            📻
          </span>
          토리FM 스튜디오
        </h3>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold text-amber-50/60 ring-1 ring-white/10">
          <span className="h-2 w-2 rounded-full bg-zinc-500" aria-hidden />
          꺼짐
        </span>
      </div>

      {/* 켜기 토글 */}
      <button
        type="button"
        role="switch"
        aria-checked={false}
        onClick={turnOn}
        disabled={pending}
        className="flex w-full items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-left transition hover:bg-emerald-500/20 disabled:opacity-50"
      >
        <span
          aria-hidden
          className="relative h-7 w-12 shrink-0 rounded-full bg-zinc-600 transition"
        >
          <span className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-emerald-100">
            {pending ? "켜는 중…" : "지금 방송 켜기"}
          </span>
          <span className="block text-[11px] text-amber-50/55">
            바로 라이브 스튜디오가 열려요
          </span>
        </span>
      </button>

      {/* 예약 */}
      <div className="space-y-2 border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={() => {
            setScheduleOpen((v) => !v);
            setError(null);
          }}
          className="flex w-full items-center justify-between gap-2 text-xs font-bold text-amber-100/90"
        >
          <span>⏰ 방송 예약하기</span>
          <span
            className={`text-[10px] transition-transform ${scheduleOpen ? "rotate-180" : ""}`}
          >
            ▼
          </span>
        </button>

        {scheduleOpen && (
          <div className="space-y-2.5 rounded-xl bg-white/[0.04] p-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-amber-50/70">
                방송 이름
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                disabled={pending}
                className="w-full rounded-lg border border-white/15 bg-[#0B1538] px-3 py-2 text-sm text-amber-50 outline-none focus:border-amber-400/60"
              />
            </label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-amber-50/70">
                  시작 일시
                </span>
                <input
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  disabled={pending}
                  className="w-full rounded-lg border border-white/15 bg-[#0B1538] px-3 py-2 text-sm text-amber-50 outline-none focus:border-amber-400/60"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-amber-50/70">
                  종료 일시
                </span>
                <input
                  type="datetime-local"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  disabled={pending}
                  className="w-full rounded-lg border border-white/15 bg-[#0B1538] px-3 py-2 text-sm text-amber-50 outline-none focus:border-amber-400/60"
                />
              </label>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={submitSchedule}
                disabled={pending}
                className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-[#0B1538] shadow-md transition hover:bg-amber-300 disabled:opacity-50"
              >
                {pending ? "처리 중…" : "📅 예약하기"}
              </button>
            </div>
          </div>
        )}

        {/* 예약된 방송 목록 */}
        {scheduledSessions.length > 0 && (
          <ul className="space-y-1.5 pt-1">
            {scheduledSessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold text-amber-50">
                    {s.name}
                  </p>
                  <p className="truncate text-[10px] text-amber-50/55">
                    {fmtSchedule(s.scheduled_start)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => run(() => startFmBroadcastAction(s.id))}
                  disabled={pending}
                  className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-emerald-500 disabled:opacity-40"
                >
                  ▶ 지금 시작
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      !window.confirm(
                        `예약된 방송 "${s.name}" 을(를) 취소할까요?`
                      )
                    ) {
                      return;
                    }
                    run(() => deleteFmSessionAction(s.id));
                  }}
                  disabled={pending}
                  className="shrink-0 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2 py-1.5 text-[11px] font-bold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-40"
                  aria-label="예약 취소"
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-rose-500/15 px-3 py-2 text-[11px] font-semibold text-rose-200"
        >
          ⚠ {error}
        </p>
      )}
    </section>
  );
}
