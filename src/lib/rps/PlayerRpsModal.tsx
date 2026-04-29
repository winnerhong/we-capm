"use client";

// PlayerRpsModal — 토리FM 라디오에 들어와 있는 청취자에게 자동으로 뜨는 RPS 참가 모달.
//
// 동작:
//   - 마운트 시 fmSessionId 로 활성 RPS 방을 직접 select (status != cancelled)
//   - 활성 방 발견 → 자동 모달 등장 + joinRoomAction 즉시 호출
//   - Realtime: rps-room-${roomId} 채널 + tori_fm_sessions 변경 감지
//   - 4-phase 상태머신:
//       idle      : round 없거나 starts_at 미래
//       countdown : starts_at 까지 카운트다운
//       pick      : starts_at <= now < locked_at — 픽 입력
//       resolved  : round.resolved_at != null — outcome 표시
//   - room.status === finished → 우승/탈락 결과 풀스크린 → 3초 후 닫힘
//   - room.status === cancelled → 자동 닫힘

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  joinRoomAction,
  submitPickAction,
} from "@/lib/rps/actions";
import {
  PICK_EMOJIS,
  PICK_LABELS,
  type RpsParticipantRow,
  type RpsPick,
  type RpsPickRow,
  type RpsRoomRow,
  type RpsRoundRow,
} from "@/lib/rps/types";

interface Props {
  fmSessionId: string;
  isLive: boolean;
  /**
   * 현재 로그인한 청취자 user_id (app_users.id) — 본인 픽/참가자 row 매칭용.
   * MiniStage 가 SSR 단계에서 받은 값을 그대로 전달.
   */
  currentUserId: string | null;
}

const PICKS: RpsPick[] = ["rock", "paper", "scissors"];

type SbRespOne<T> = { data: T | null };

export function PlayerRpsModal({
  fmSessionId,
  isLive,
  currentUserId,
}: Props) {
  const [room, setRoom] = useState<RpsRoomRow | null>(null);
  const [round, setRound] = useState<RpsRoundRow | null>(null);
  const [myPick, setMyPick] = useState<RpsPick | null>(null);
  const [myPickRow, setMyPickRow] = useState<RpsPickRow | null>(null);
  const [myParticipant, setMyParticipant] = useState<RpsParticipantRow | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoClosed, setAutoClosed] = useState(false);
  const joinedRef = useRef(false);

  /* ------------------------------------------------------------------------ */
  /* 현재 유저 ID 가져오기 — supabase auth 가 아니라 app_users.id 가 필요.      */
  /* 서버 액션 joinRoomAction 이 user.id 를 자동 사용하므로, 클라에서는        */
  /* 본인 픽/참가자를 매칭할 때만 필요. /api 로 노출돼있으면 호출, 아니면      */
  /* 서버 액션 결과로 추론.                                                    */
  /* ------------------------------------------------------------------------ */

  // 본인 user_id 를 알아낼 손쉬운 방법: 픽 제출 후 받은 row 의 user_id, 또는
  // participants 의 본인을 phone 으로 매칭… 여기선 일단 server action 결과로만
  // 추론하지 않고, joined 후 participants 목록에서 가장 최근 joined 본인을 찾기 어려움.
  // 대신 픽 제출 시 즉시 myPick state 로 표시 → 정산 후 outcome 은 picks 에서 user_id
  // 매칭 어려우니 myPickRow 를 우리가 setSubmitting 으로 별도 추적 X.
  // → 간단하게: round.host_pick 와 myPick 으로 클라이언트에서 outcome 계산.

  /* ------------------------------------------------------------------------ */
  /* 활성 방 fetch                                                              */
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
    if (!room) {
      setRound(null);
      setMyPickRow(null);
      return;
    }
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
    const newRound = rr.data;

    // 라운드가 바뀌면 myPick 초기화
    if (newRound?.id !== round?.id) {
      setMyPick(null);
      setMyPickRow(null);
    }
    setRound(newRound);

    // 본인 participant 조회 (phone 등 없이 단순히 본인이 active 인지)
    // app_users.id 가 client 에 노출되지 않으므로, currentUserId 상태로 우회.
    if (currentUserId && newRound) {
      const pickR = (await (
        supa.from("rps_picks" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: string) => {
                maybeSingle: () => Promise<SbRespOne<RpsPickRow>>;
              };
            };
          };
        }
      )
        .select("*")
        .eq("round_id", newRound.id)
        .eq("user_id", currentUserId)
        .maybeSingle()) as SbRespOne<RpsPickRow>;
      setMyPickRow(pickR.data);

      const partR = (await (
        supa.from("rps_participants" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: string) => {
                maybeSingle: () => Promise<SbRespOne<RpsParticipantRow>>;
              };
            };
          };
        }
      )
        .select("*")
        .eq("room_id", room.id)
        .eq("user_id", currentUserId)
        .maybeSingle()) as SbRespOne<RpsParticipantRow>;
      setMyParticipant(partR.data);
    }
  }, [room, round?.id, currentUserId]);

  /* ------------------------------------------------------------------------ */
  /* 마운트 + 활성 방 발견 시 join                                              */
  /* (currentUserId 는 SSR(MiniStage) 에서 prop 으로 전달받음)                  */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!isLive || !fmSessionId) return;
    void refetchRoom();
  }, [isLive, fmSessionId, refetchRoom]);

  // 방 발견 → 자동 join
  useEffect(() => {
    if (!room || joinedRef.current) return;
    if (room.status === "finished" || room.status === "cancelled") return;
    joinedRef.current = true;
    (async () => {
      try {
        await joinRoomAction(room.id);
      } catch (err) {
        console.error("[PlayerRpsModal] join failed", err);
      }
    })();
  }, [room]);

  /* ------------------------------------------------------------------------ */
  /* Realtime 구독                                                              */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!fmSessionId) return;
    const supa = createClient();
    // fm_session_id 별로 rps_rooms INSERT/UPDATE 를 감지 — 새 방 생성 시 즉시 등장.
    const ch = supa
      .channel(`rps-fm-${fmSessionId}`)
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
    const poll = setInterval(() => void refetchRoom(), 4000);
    return () => {
      clearInterval(poll);
      void supa.removeChannel(ch);
    };
  }, [fmSessionId, refetchRoom]);

  useEffect(() => {
    if (!room) return;
    const supa = createClient();
    const ch = supa
      .channel(`rps-room-${room.id}`)
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
        { event: "*", schema: "public", table: "rps_participants", filter: `room_id=eq.${room.id}` } as never,
        (() => void refetchRound()) as never
      )
      .subscribe();
    void refetchRound();
    const poll = setInterval(() => void refetchRound(), 4000);
    return () => {
      clearInterval(poll);
      void supa.removeChannel(ch);
    };
  }, [room, refetchRoom, refetchRound]);

  /* ------------------------------------------------------------------------ */
  /* 1초 시계                                                                   */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!room) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [room]);

  /* ------------------------------------------------------------------------ */
  /* 종료 후 자동 닫기 — localStorage 에 한번 본 방 id 를 기억해 router.refresh  */
  /* / 페이지 새로고침 후에도 같은 finished 방이 다시 뜨지 않게.                  */
  /* ------------------------------------------------------------------------ */

  const dismissRoom = useCallback((roomId: string) => {
    try {
      window.localStorage.setItem(`rps-player-seen:${roomId}`, "1");
    } catch {
      /* localStorage 사용 불가 환경 — silent */
    }
    setAutoClosed(true);
  }, []);

  // 새 방 fetch 시 localStorage 확인 — 이미 본 방이면 즉시 닫힘 처리
  useEffect(() => {
    if (!room) return;
    try {
      if (window.localStorage.getItem(`rps-player-seen:${room.id}`)) {
        setAutoClosed(true);
        return;
      }
    } catch {
      /* silent */
    }
    // 새 방(아직 안 본)이면 닫힘 상태 해제
    setAutoClosed(false);
  }, [room?.id]);

  useEffect(() => {
    if (!room) return;
    if (room.status === "cancelled") {
      dismissRoom(room.id);
      return;
    }
    if (room.status === "finished") {
      const t = setTimeout(() => dismissRoom(room.id), 5000);
      return () => clearTimeout(t);
    }
  }, [room?.status, room?.id, dismissRoom]);

  /* ------------------------------------------------------------------------ */
  /* Phase 도출                                                                  */
  /* ------------------------------------------------------------------------ */

  function handlePick(pick: RpsPick) {
    if (!round) return;
    if (round.resolved_at) return;
    const lockedAt = new Date(round.locked_at).getTime();
    if (Date.now() >= lockedAt) return;
    setMyPick(pick);
    setSubmitting(true);
    setError(null);
    void submitPickAction(round.id, pick)
      .then(() => {
        // OK
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "선택 제출 실패");
        setMyPick(null);
      })
      .finally(() => setSubmitting(false));
  }

  if (!isLive || !room || autoClosed) return null;

  const startsAt = round ? new Date(round.starts_at).getTime() : 0;
  const lockedAt = round ? new Date(round.locked_at).getTime() : 0;
  const finished = room.status === "finished";
  const isWinner = !!myParticipant && myParticipant.finished_rank !== null;
  const eliminated = !!myParticipant && !myParticipant.is_active && !isWinner;

  let phase: "lobby" | "countdown" | "pick" | "resolved" | "ended" = "lobby";
  if (finished) phase = "ended";
  else if (round) {
    if (round.resolved_at) phase = "resolved";
    else if (now < startsAt) phase = "countdown";
    else if (now < lockedAt) phase = "pick";
    else phase = "resolved"; // locked 시간 후 정산 대기
  }

  const cdSec = Math.max(0, Math.ceil((startsAt - now) / 1000));
  const remainSec = Math.max(0, Math.ceil((lockedAt - now) / 1000));

  // 본인 outcome — 내 픽 vs host_pick
  let outcome: "win" | "lose" | "tie" | null = null;
  if (round?.host_pick && (myPick || myPickRow?.pick)) {
    const my = myPick ?? myPickRow?.pick;
    if (my) {
      if (my === round.host_pick) outcome = "tie";
      else if (
        (round.host_pick === "rock" && my === "paper") ||
        (round.host_pick === "paper" && my === "scissors") ||
        (round.host_pick === "scissors" && my === "rock")
      ) {
        outcome = "win";
      } else outcome = "lose";
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rps-player-modal-title"
    >
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-gradient-to-b from-[#0B1538] to-[#070C1F] p-6 text-center shadow-2xl">
        {/* 닫기 버튼 — 종료/취소 후에만 노출 */}
        {(finished || room.status === "cancelled") && (
          <button
            type="button"
            onClick={() => dismissRoom(room.id)}
            aria-label="닫기"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.12]"
          >
            ✕
          </button>
        )}

        <p
          id="rps-player-modal-title"
          className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300/80"
        >
          ✊ 단체 가위바위보
        </p>
        <h2 className="mt-1 text-lg font-extrabold text-amber-100">
          {room.title}
        </h2>

        {/* 라운드 표시 */}
        {round && phase !== "ended" && (
          <p className="mt-1 text-[11px] text-white/60">
            ROUND {round.round_no}
            {round.is_revival && " · 부활전"}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200"
          >
            {error}
          </p>
        )}

        {/* PHASE: LOBBY */}
        {phase === "lobby" && (
          <div className="my-8 space-y-3">
            <p className="text-6xl">⏳</p>
            <p className="text-base font-bold text-amber-100">
              잠시 후 시작해요
            </p>
            <p className="text-[11px] text-white/60">
              방장이 라운드를 시작하면 카운트다운이 시작돼요
            </p>
          </div>
        )}

        {/* PHASE: COUNTDOWN */}
        {phase === "countdown" && (
          <div className="my-6 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
              시작까지
            </p>
            <p
              className="text-9xl font-black text-amber-200 drop-shadow-[0_0_30px_rgba(252,211,77,0.5)]"
              aria-live="polite"
            >
              {cdSec || "GO!"}
            </p>
          </div>
        )}

        {/* PHASE: PICK */}
        {phase === "pick" && round && (
          <div className="my-4 space-y-4">
            <p className="text-4xl font-black text-amber-200">{remainSec}s</p>
            <div className="mx-auto h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-amber-300 transition-all"
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(100, ((lockedAt - now) / Math.max(1, lockedAt - startsAt)) * 100)
                  )}%`,
                }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {PICKS.map((p) => {
                const selected = (myPick ?? myPickRow?.pick) === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePick(p)}
                    disabled={submitting}
                    className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-5 text-5xl transition active:scale-95 ${
                      selected
                        ? "border-amber-300 bg-amber-300 text-[#0B1538] shadow-lg shadow-amber-300/40"
                        : "border-white/10 bg-white/[0.04] text-white/85 hover:bg-white/[0.12]"
                    }`}
                    aria-label={PICK_LABELS[p]}
                  >
                    <span aria-hidden>{PICK_EMOJIS[p]}</span>
                    <span className="text-[11px] font-bold">{PICK_LABELS[p]}</span>
                  </button>
                );
              })}
            </div>
            {myPick && (
              <p className="text-[11px] font-bold text-amber-200">
                ✓ {PICK_LABELS[myPick]} 제출됨 — 시간 안에 변경 가능
              </p>
            )}
          </div>
        )}

        {/* PHASE: RESOLVED */}
        {phase === "resolved" && round && (
          <div className="my-6 space-y-3">
            {round.host_pick ? (
              <>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                  호스트
                </p>
                <p className="text-7xl">{PICK_EMOJIS[round.host_pick]}</p>
                {outcome === "win" && (
                  <>
                    <p className="text-5xl">🎉</p>
                    <p className="text-2xl font-black text-emerald-300">
                      생존!
                    </p>
                  </>
                )}
                {outcome === "lose" && (
                  <>
                    <p className="text-5xl">💀</p>
                    <p className="text-2xl font-black text-rose-300">탈락</p>
                  </>
                )}
                {outcome === "tie" && (
                  <>
                    <p className="text-5xl">⚖️</p>
                    <p className="text-2xl font-black text-orange-300">무승부 — 탈락</p>
                  </>
                )}
                {!outcome && (myPick || myPickRow?.pick) && (
                  <p className="text-xs text-white/60">결과 계산 중…</p>
                )}
                {!myPick && !myPickRow?.pick && (
                  <>
                    <p className="text-5xl">⌛</p>
                    <p className="text-base font-bold text-rose-300">시간 초과 — 탈락</p>
                  </>
                )}
              </>
            ) : (
              <>
                <p className="text-5xl">⏳</p>
                <p className="text-sm font-bold text-amber-200">
                  결과 발표 대기 중…
                </p>
              </>
            )}
          </div>
        )}

        {/* PHASE: ENDED */}
        {phase === "ended" && (
          <div className="my-8 space-y-3">
            {isWinner ? (
              <>
                <p className="text-7xl">🏆</p>
                <p className="text-3xl font-black text-amber-200">우승!</p>
                <p className="text-sm font-semibold text-white/80">
                  🎁 토리룸 선물함에서 확인하세요
                </p>
              </>
            ) : eliminated ? (
              <>
                <p className="text-6xl">👏</p>
                <p className="text-xl font-bold text-amber-100">수고하셨어요</p>
                <p className="text-[11px] text-white/60">다음에 또 만나요!</p>
              </>
            ) : (
              <>
                <p className="text-6xl">🙌</p>
                <p className="text-xl font-bold text-amber-100">게임 종료</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
