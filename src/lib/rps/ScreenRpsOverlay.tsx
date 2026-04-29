"use client";

// ScreenRpsOverlay — 빅스크린(전광판)에 풀스크린 z-[60] 으로 띄우는 RPS 진행/결과 표시.
//   - 토리FM 세션과 연결된 활성 RPS 방을 감지 → 풀스크린 오버레이
//   - 거대 카운트다운 / 라운드 정보 / 호스트 픽 공개 + 픽 통계 막대그래프
//   - 게임 종료 시 우승자 명단 슬로우 등장
//   - 종료 또는 취소 5초 후 사라짐

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  PICK_EMOJIS,
  PICK_LABELS,
  type RpsParticipantRow,
  type RpsPickRow,
  type RpsRoomRow,
  type RpsRoundRow,
} from "@/lib/rps/types";

interface Props {
  fmSessionId: string | null;
}

type SbResp<T> = { data: T[] | null };
type SbRespOne<T> = { data: T | null };

export function ScreenRpsOverlay({ fmSessionId }: Props) {
  const [room, setRoom] = useState<RpsRoomRow | null>(null);
  const [round, setRound] = useState<RpsRoundRow | null>(null);
  const [picks, setPicks] = useState<RpsPickRow[]>([]);
  const [winners, setWinners] = useState<RpsParticipantRow[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [hidden, setHidden] = useState(false);

  /* ------------------------------------------------------------------------ */
  /* Refetch                                                                    */
  /* ------------------------------------------------------------------------ */

  const refetchRoom = useCallback(async () => {
    if (!fmSessionId) return;
    const supa = createClient();
    const r = (await (
      supa.from("rps_rooms" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            neq: (k: string, v: string) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => {
                limit: (n: number) => {
                  maybeSingle: () => Promise<SbRespOne<RpsRoomRow>>;
                };
              };
            };
          };
        };
      }
    )
      .select("*")
      .eq("fm_session_id", fmSessionId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()) as SbRespOne<RpsRoomRow>;
    setRoom(r.data);
  }, [fmSessionId]);

  const refetchRound = useCallback(async () => {
    if (!room) return;
    const supa = createClient();
    const rr = (await (
      supa.from("rps_rounds" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => {
              limit: (n: number) => {
                maybeSingle: () => Promise<SbRespOne<RpsRoundRow>>;
              };
            };
          };
        };
      }
    )
      .select("*")
      .eq("room_id", room.id)
      .order("round_no", { ascending: false })
      .limit(1)
      .maybeSingle()) as SbRespOne<RpsRoundRow>;
    setRound(rr.data);
    if (rr.data) {
      const pr = (await (
        supa.from("rps_picks" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => Promise<SbResp<RpsPickRow>>;
          };
        }
      )
        .select("*")
        .eq("round_id", rr.data.id)) as SbResp<RpsPickRow>;
      setPicks(pr.data ?? []);
    }
    if (room.status === "finished") {
      const wr = (await (
        supa.from("rps_participants" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              not: (
                k: string,
                op: string,
                v: null
              ) => {
                order: (
                  c: string,
                  o: { ascending: boolean }
                ) => Promise<SbResp<RpsParticipantRow>>;
              };
            };
          };
        }
      )
        .select("*")
        .eq("room_id", room.id)
        .not("finished_rank", "is", null)
        .order("finished_rank", { ascending: true })) as SbResp<RpsParticipantRow>;
      setWinners(wr.data ?? []);
    }
  }, [room]);

  /* ------------------------------------------------------------------------ */
  /* 구독                                                                        */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!fmSessionId) return;
    setHidden(false);
    void refetchRoom();
    const supa = createClient();
    const ch = supa
      .channel(`rps-screen-${fmSessionId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "rps_rooms",
          filter: `fm_session_id=eq.${fmSessionId}`,
        } as never,
        (() => void refetchRoom()) as never
      )
      .subscribe();
    const poll = setInterval(() => void refetchRoom(), 3000);
    return () => {
      clearInterval(poll);
      void supa.removeChannel(ch);
    };
  }, [fmSessionId, refetchRoom]);

  useEffect(() => {
    if (!room) return;
    void refetchRound();
    const supa = createClient();
    const ch = supa
      .channel(`rps-screen-room-${room.id}`)
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "rps_rooms", filter: `id=eq.${room.id}` } as never,
        (() => void refetchRoom()) as never
      )
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "rps_rounds", filter: `room_id=eq.${room.id}` } as never,
        (() => void refetchRound()) as never
      )
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "rps_picks" } as never,
        (() => void refetchRound()) as never
      )
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "rps_participants",
          filter: `room_id=eq.${room.id}`,
        } as never,
        (() => void refetchRound()) as never
      )
      .subscribe();
    const poll = setInterval(() => void refetchRound(), 3000);
    return () => {
      clearInterval(poll);
      void supa.removeChannel(ch);
    };
  }, [room, refetchRoom, refetchRound]);

  useEffect(() => {
    if (!room) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [room]);

  // 종료/취소 5초 후 자동 숨김
  useEffect(() => {
    if (!room) return;
    if (room.status === "cancelled") {
      setHidden(true);
      return;
    }
    if (room.status === "finished") {
      const t = setTimeout(() => setHidden(true), 8000);
      return () => clearTimeout(t);
    }
  }, [room?.status, room]);

  /* ------------------------------------------------------------------------ */
  /* 파생                                                                        */
  /* ------------------------------------------------------------------------ */

  const pickCounts = useMemo(() => {
    const counts = { rock: 0, paper: 0, scissors: 0 };
    for (const p of picks) counts[p.pick] += 1;
    return counts;
  }, [picks]);
  const totalPicks = picks.length || 1;

  if (!fmSessionId || !room || hidden) return null;

  const startsAt = round ? new Date(round.starts_at).getTime() : 0;
  const lockedAt = round ? new Date(round.locked_at).getTime() : 0;

  let phase: "lobby" | "countdown" | "pick" | "resolved" | "ended" = "lobby";
  if (room.status === "finished") phase = "ended";
  else if (round) {
    if (round.resolved_at) phase = "resolved";
    else if (now < startsAt) phase = "countdown";
    else if (now < lockedAt) phase = "pick";
    else phase = "resolved";
  }

  const cdSec = Math.max(0, Math.ceil((startsAt - now) / 1000));
  const remainSec = Math.max(0, Math.ceil((lockedAt - now) / 1000));

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/85 p-8 text-center backdrop-blur-md">
      <div className="pointer-events-auto w-full max-w-6xl space-y-8">
        {/* 헤더 */}
        <div>
          <p className="text-2xl font-bold uppercase tracking-[0.5em] text-amber-300/80 md:text-3xl">
            ✊ 가위바위보 서바이벌
          </p>
          <h1 className="mt-2 text-5xl font-black text-amber-100 md:text-7xl">
            {room.title}
          </h1>
          {round && phase !== "ended" && (
            <div className="mt-4 flex items-center justify-center gap-6 text-lg font-bold text-white/80 md:text-2xl">
              <span>ROUND {round.round_no}</span>
              <span className="text-white/40">·</span>
              <span>목표 {room.target_survivors}명</span>
              <span className="text-white/40">·</span>
              <span className="text-emerald-300">생존 {round.participants_count}</span>
            </div>
          )}
        </div>

        {/* PHASE: COUNTDOWN */}
        {phase === "countdown" && (
          <div className="space-y-4">
            <p className="text-3xl font-bold uppercase tracking-widest text-white/60 md:text-4xl">
              시작까지
            </p>
            <p
              className="text-[16rem] font-black leading-none text-amber-200 drop-shadow-[0_0_60px_rgba(252,211,77,0.6)] md:text-[20rem]"
              aria-live="polite"
            >
              {cdSec || "GO!"}
            </p>
          </div>
        )}

        {/* PHASE: PICK */}
        {phase === "pick" && round && (
          <div className="space-y-6">
            <p
              className="text-9xl font-black text-amber-200 md:text-[14rem]"
              aria-live="polite"
            >
              {remainSec}
            </p>
            <p className="text-2xl font-bold text-white/70 md:text-3xl">
              지금 손을 내세요!
            </p>
            <div className="mx-auto flex justify-center gap-12 text-9xl md:text-[12rem]">
              <span aria-hidden>✊</span>
              <span aria-hidden>✋</span>
              <span aria-hidden>✌️</span>
            </div>
            <p className="text-xl font-bold text-amber-200 md:text-2xl">
              {picks.length}명 제출
            </p>
          </div>
        )}

        {/* PHASE: RESOLVED — 호스트 픽 공개 + 통계 */}
        {phase === "resolved" && round?.host_pick && (
          <div className="space-y-6">
            <p className="text-3xl font-bold uppercase tracking-widest text-white/60 md:text-4xl">
              호스트의 손
            </p>
            <p
              className="text-[18rem] leading-none drop-shadow-[0_0_60px_rgba(252,211,77,0.6)] md:text-[24rem]"
              aria-live="polite"
            >
              {PICK_EMOJIS[round.host_pick]}
            </p>
            <p className="text-3xl font-black text-amber-200 md:text-5xl">
              {PICK_LABELS[round.host_pick]}
            </p>
            {/* 통계 막대그래프 */}
            <div className="mx-auto max-w-3xl space-y-3 pt-6">
              {(["rock", "paper", "scissors"] as const).map((p) => {
                const count = pickCounts[p];
                const pct = (count / totalPicks) * 100;
                return (
                  <div key={p} className="flex items-center gap-4">
                    <span className="w-20 text-5xl">{PICK_EMOJIS[p]}</span>
                    <div className="relative h-10 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-amber-300 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-20 text-right text-2xl font-black text-amber-200">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PHASE: ENDED */}
        {phase === "ended" && (
          <div className="space-y-6">
            <p className="text-9xl">🏆</p>
            <p className="text-5xl font-black text-amber-200 md:text-7xl">
              우승자 발표
            </p>
            <ul className="mx-auto max-w-2xl space-y-3 text-left">
              {winners.map((w, idx) => (
                <li
                  key={w.user_id}
                  className="flex items-center gap-4 rounded-2xl border border-amber-300/40 bg-amber-400/10 p-4 text-2xl font-bold text-amber-100 backdrop-blur md:text-3xl"
                  style={{
                    animation: `rps-winner-in 0.6s ease-out ${idx * 0.4}s backwards`,
                  }}
                >
                  <span className="text-3xl">
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🏆"}
                  </span>
                  <span className="flex-1 truncate">{w.display_name}</span>
                </li>
              ))}
            </ul>
            {winners.length === 0 && (
              <p className="text-xl text-white/60">우승자 없음</p>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes rps-winner-in {
          0% {
            opacity: 0;
            transform: translateY(40px) scale(0.9);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
