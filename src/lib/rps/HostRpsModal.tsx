"use client";

// HostRpsModal — 토리FM 호스트 콘솔 안에서 띄우는 RPS 운영 모달.
//   - 방이 없으면 "방 만들기" 폼
//   - 방이 있으면 라운드 자동 진행 매니저 + 호스트 픽 + 결과 + 선물 발송
//   - 모달이 닫히는 조건: 게임 진행 중이면 confirm, 그 외엔 즉시 닫기
//
// Realtime: rps-room-${roomId} 채널로 4테이블 변경 구독.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type FormEvent,
} from "react";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import {
  cancelRoomAction,
  createRoomAction,
  forceFinishRoomAction,
  nextRoundAction,
  resolveRoundAction,
  sendGiftsAction,
  submitHostPickAction,
  uploadGiftImageAction,
} from "@/lib/rps/actions";
import type { UserGiftRow } from "@/lib/gifts/types";
import {
  PICK_EMOJIS,
  PICK_LABELS,
  type RpsParticipantRow,
  type RpsPick,
  type RpsPickRow,
  type RpsRoomRow,
  type RpsRoundRecommendation,
  type RpsRoundRow,
} from "@/lib/rps/types";

interface Props {
  open: boolean;
  onClose: () => void;
  orgId: string;
  fmSessionId: string;
  eventId?: string | null;
  initialRoom: RpsRoomRow | null;
}

const PICKS: RpsPick[] = ["rock", "paper", "scissors"];

type SbResp<T> = { data: T[] | null };
type SbRespOne<T> = { data: T | null };

type Phase =
  | "create" // 방이 아직 없음 — 폼
  | "lobby" // 방 생성됨, 라운드 진행 전
  | "running" // 라운드 진행 중
  | "round_result" // 라운드 종료, 다음 결정
  | "finished" // 게임 종료, 선물 발송 단계
  | "gift_sent"; // 선물 발송 완료

export function HostRpsModal({
  open,
  onClose,
  orgId,
  fmSessionId,
  eventId,
  initialRoom,
}: Props) {
  const [room, setRoom] = useState<RpsRoomRow | null>(initialRoom);
  const [round, setRound] = useState<RpsRoundRow | null>(null);
  const [picks, setPicks] = useState<RpsPickRow[]>([]);
  const [participants, setParticipants] = useState<RpsParticipantRow[]>([]);
  const [gifts, setGifts] = useState<UserGiftRow[]>([]);

  const [creating, startCreating] = useTransition();
  const [advancing, startAdvancing] = useTransition();
  const [resolving, startResolving] = useTransition();
  const [sendingGift, startSendingGift] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 폼 state
  const [title, setTitle] = useState("단체 가위바위보");
  const [target, setTarget] = useState(1);
  const [pickWindow, setPickWindow] = useState(5000);

  // 선물 state — 게임 시작 전 (CREATE 페이즈) 에 미리 입력. 종료 후엔 그대로 사용.
  const [giftLabel, setGiftLabel] = useState("");
  const [giftImageUrl, setGiftImageUrl] = useState<string | null>(null);
  const [giftMessage, setGiftMessage] = useState("");
  const [giftResult, setGiftResult] = useState<{ sent: number; failed: number } | null>(null);

  // 라운드 진행 매니저 state
  const [countdown, setCountdown] = useState(0); // 시작까지 초
  const [pickRemain, setPickRemain] = useState(0); // 픽 시간 잔여 ms
  const [hostPick, setHostPick] = useState<RpsPick | null>(null);

  const lastResolutionRef = useRef<{ recommendation: RpsRoundRecommendation } | null>(null);
  const [showResolution, setShowResolution] = useState<{
    survivors: number;
    eliminated: number;
    recommendation: RpsRoundRecommendation;
  } | null>(null);

  // QR 데이터 URL
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  /* ------------------------------------------------------------------------ */
  /* 데이터 fetch                                                               */
  /* ------------------------------------------------------------------------ */

  const refetch = useCallback(async () => {
    if (!room) return;
    const supa = createClient();

    const [roomR, partR, giftsR] = await Promise.all([
      (
        supa.from("rps_rooms" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<SbRespOne<RpsRoomRow>>;
            };
          };
        }
      )
        .select("*")
        .eq("id", room.id)
        .maybeSingle(),
      (
        supa.from("rps_participants" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              order: (c: string, o: { ascending: boolean }) => Promise<SbResp<RpsParticipantRow>>;
            };
          };
        }
      )
        .select("*")
        .eq("room_id", room.id)
        .order("joined_at", { ascending: true }),
      // 선물함 발급 이력 — user_gifts (source_type='rps_winner', source_id=room.id) 으로 추적.
      (
        supa.from("user_gifts" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: string) => Promise<SbResp<UserGiftRow>>;
            };
          };
        }
      )
        .select("*")
        .eq("source_type", "rps_winner")
        .eq("source_id", room.id),
    ]);

    if (roomR.data) setRoom(roomR.data);
    setParticipants(partR.data ?? []);
    setGifts(giftsR.data ?? []);

    // 최신 라운드
    const roundR = (await (
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

    setRound(roundR.data);
    if (roundR.data?.host_pick) setHostPick(roundR.data.host_pick);
    else setHostPick(null);

    if (roundR.data) {
      const picksR = (await (
        supa.from("rps_picks" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => Promise<SbResp<RpsPickRow>>;
          };
        }
      )
        .select("*")
        .eq("round_id", roundR.data.id)) as SbResp<RpsPickRow>;
      setPicks(picksR.data ?? []);
    } else {
      setPicks([]);
    }
  }, [room]);

  /* ------------------------------------------------------------------------ */
  /* Realtime 구독                                                              */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!open || !room) return;
    const supa = createClient();
    const ch = supa
      .channel(`rps-room-${room.id}`)
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "rps_rooms", filter: `id=eq.${room.id}` } as never,
        (() => void refetch()) as never
      )
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "rps_rounds", filter: `room_id=eq.${room.id}` } as never,
        (() => void refetch()) as never
      )
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "rps_picks" } as never,
        (() => void refetch()) as never
      )
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "rps_participants", filter: `room_id=eq.${room.id}` } as never,
        (() => void refetch()) as never
      )
      .subscribe();
    void refetch();
    const poll = setInterval(() => void refetch(), 5000);
    return () => {
      clearInterval(poll);
      void supa.removeChannel(ch);
    };
  }, [open, room, refetch]);

  /* ------------------------------------------------------------------------ */
  /* 카운트다운 / 픽창 잔여 / 자동 resolve 매니저                               */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!round || round.resolved_at) {
      setCountdown(0);
      setPickRemain(0);
      return;
    }
    const tick = () => {
      const now = Date.now();
      const startsAt = new Date(round.starts_at).getTime();
      const lockedAt = new Date(round.locked_at).getTime();
      const cd = Math.max(0, Math.ceil((startsAt - now) / 1000));
      const remain = Math.max(0, lockedAt - now);
      setCountdown(cd);
      setPickRemain(remain);

      // pick window 끝 + host_pick 있을 때 자동 resolve
      if (remain === 0 && room && hostPick && !resolving && !round.resolved_at) {
        // 약간 지연 — 마지막 픽 들어올 시간 줌
        // 단 이미 resolving 중이면 skip
      }
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [round, hostPick, resolving, room]);

  /* ------------------------------------------------------------------------ */
  /* QR 생성                                                                    */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!open || !room) return;
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/tori-fm`
        : "/tori-fm";
    QRCode.toDataURL(url, { width: 256, margin: 1, errorCorrectionLevel: "M" })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [open, room]);

  /* ------------------------------------------------------------------------ */
  /* Phase 도출                                                                 */
  /* ------------------------------------------------------------------------ */

  const phase: Phase = useMemo(() => {
    if (!room) return "create";
    if (room.status === "finished") {
      // user_gifts 에 한 명이라도 발급됐으면 등록 완료 단계로 간주.
      // sendGiftsAction 이 모든 우승자에게 한번에 발급하므로 부분 발급은 거의 없음.
      if (gifts.length > 0) return "gift_sent";
      return "finished";
    }
    if (showResolution) return "round_result";
    if (round && !round.resolved_at) return "running";
    if (round && round.resolved_at) return "round_result";
    return "lobby";
  }, [room, gifts, round, showResolution]);

  /* ------------------------------------------------------------------------ */
  /* Actions                                                                    */
  /* ------------------------------------------------------------------------ */

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startCreating(async () => {
      try {
        const { roomId } = await createRoomAction({
          orgId,
          eventId: eventId ?? null,
          fmSessionId,
          title: title.trim() || "단체 가위바위보",
          targetSurvivors: target,
          pickWindowMs: pickWindow,
          giftLabel: giftLabel.trim(),
          giftImageUrl: giftImageUrl,
          giftMessage: giftMessage.trim() || null,
        });
        // refetch room — supabase에서 직접 select
        const supa = createClient();
        const r = (await (
          supa.from("rps_rooms" as never) as unknown as {
            select: (c: string) => {
              eq: (k: string, v: string) => {
                maybeSingle: () => Promise<SbRespOne<RpsRoomRow>>;
              };
            };
          }
        )
          .select("*")
          .eq("id", roomId)
          .maybeSingle()) as SbRespOne<RpsRoomRow>;
        setRoom(r.data ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "방 생성 실패");
      }
    });
  }

  function handleStartRound(mode: "normal" | "revival" | "replay" = "normal") {
    if (!room) return;
    setError(null);
    setShowResolution(null);
    startAdvancing(async () => {
      try {
        await nextRoundAction(room.id, mode);
        await refetch();
      } catch (err) {
        setError(err instanceof Error ? err.message : "라운드 시작 실패");
      }
    });
  }

  function handleHostPick(pick: RpsPick) {
    if (!round) return;
    setHostPick(pick);
    setError(null);
    void submitHostPickAction(round.id, pick).catch((err) => {
      setError(err instanceof Error ? err.message : "호스트 선택 저장 실패");
    });
  }

  function handleResolve() {
    if (!room) return;
    setError(null);
    startResolving(async () => {
      try {
        const res = await resolveRoundAction(room.id);
        setShowResolution(res);
        lastResolutionRef.current = { recommendation: res.recommendation };
        await refetch();
      } catch (err) {
        setError(err instanceof Error ? err.message : "라운드 정산 실패");
      }
    });
  }

  function handleForceFinish() {
    if (!room) return;
    if (!confirm("현재 살아있는 참가자 모두를 우승자로 종료할까요?")) return;
    setError(null);
    startResolving(async () => {
      try {
        await forceFinishRoomAction(room.id);
        await refetch();
      } catch (err) {
        setError(err instanceof Error ? err.message : "강제 종료 실패");
      }
    });
  }

  function handleSendGifts() {
    if (!room) return;
    setError(null);
    setGiftResult(null);
    startSendingGift(async () => {
      try {
        const res = await sendGiftsAction(room.id);
        setGiftResult(res);
        await refetch();
      } catch (err) {
        setError(err instanceof Error ? err.message : "선물 등록 실패");
      }
    });
  }

  function handleClose() {
    if (room && room.status === "running") {
      if (!confirm("게임 진행 중입니다. 종료하시겠어요?")) return;
      // 진행 중이면 cancel
      void cancelRoomAction(room.id).catch(() => {
        /* ignore */
      });
    }
    onClose();
  }

  /* ------------------------------------------------------------------------ */
  /* 파생 데이터                                                                */
  /* ------------------------------------------------------------------------ */

  const activeCount = participants.filter((p) => p.is_active).length;
  const winners = participants.filter((p) => p.finished_rank !== null);

  if (!open) return null;

  /* ------------------------------------------------------------------------ */
  /* Render                                                                     */
  /* ------------------------------------------------------------------------ */

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rps-host-modal-title"
    >
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0B1538]/95 p-5 shadow-2xl backdrop-blur-md md:p-6">
        {/* 헤더 */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300/80">
              ✊ RPS HOST
            </p>
            <h2
              id="rps-host-modal-title"
              className="mt-1 text-xl font-extrabold text-amber-100 md:text-2xl"
            >
              단체 가위바위보 서바이벌
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="닫기"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 transition hover:bg-white/[0.12]"
          >
            ✕
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mb-3 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200"
          >
            {error}
          </p>
        )}

        {/* PHASE: CREATE */}
        {phase === "create" && (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="rps-title" className="mb-1 block text-xs font-bold text-amber-200">
                제목
              </label>
              <input
                id="rps-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="단체 가위바위보"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-white/30 backdrop-blur-md focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300/40"
              />
            </div>

            {/* 선물 정보 (게임 전 미리 정해놓음) */}
            <div className="space-y-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300/80">
                🎁 우승자 선물 (미리 입력)
              </p>
              <div>
                <label
                  htmlFor="rps-gift-label"
                  className="mb-1 block text-xs font-bold text-amber-200"
                >
                  선물 이름 *
                </label>
                <input
                  id="rps-gift-label"
                  type="text"
                  required
                  value={giftLabel}
                  onChange={(e) => setGiftLabel(e.target.value)}
                  placeholder="예) 스타벅스 아메리카노 쿠폰"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300/40"
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-bold text-amber-200">선물 사진 (선택)</p>
                <GiftImagePicker value={giftImageUrl} onChange={setGiftImageUrl} />
              </div>
              <div>
                <label
                  htmlFor="rps-gift-msg"
                  className="mb-1 block text-xs font-bold text-amber-200"
                >
                  메시지 (선택)
                </label>
                <textarea
                  id="rps-gift-msg"
                  rows={2}
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value)}
                  placeholder="우승 축하 메시지 한 마디"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300/40"
                />
              </div>
            </div>

            <div>
              <label htmlFor="rps-target" className="mb-1 block text-xs font-bold text-amber-200">
                목표 우승자 수 (1~20)
              </label>
              <input
                id="rps-target"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                value={target}
                onChange={(e) => setTarget(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white backdrop-blur-md focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300/40"
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-bold text-amber-200">픽 시간</p>
              <div className="grid grid-cols-3 gap-2">
                {[3000, 5000, 10000].map((ms) => (
                  <button
                    key={ms}
                    type="button"
                    onClick={() => setPickWindow(ms)}
                    className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                      pickWindow === ms
                        ? "border-amber-300 bg-amber-300 text-[#0B1538]"
                        : "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.12]"
                    }`}
                  >
                    {ms / 1000}초
                  </button>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={creating || !giftLabel.trim()}
              className="flex w-full items-center justify-center rounded-2xl bg-amber-400 px-4 py-3 text-base font-bold text-[#0B1538] shadow-lg shadow-amber-400/30 transition hover:bg-amber-300 disabled:opacity-60"
            >
              {creating ? "만드는 중…" : "✊ 가위바위보 방 만들기"}
            </button>
          </form>
        )}

        {/* PHASE: LOBBY / RUNNING / ROUND_RESULT */}
        {(phase === "lobby" || phase === "running" || phase === "round_result") && room && (
          <div className="space-y-4">
            {/* 상태 표시 */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="라운드" value={room.current_round_no || 0} />
              <Stat label="목표" value={room.target_survivors} accent="amber" />
              <Stat label="생존" value={activeCount || participants.length} accent="emerald" />
            </div>

            {/* QR + 참가자 카운트 (lobby/running 양쪽 노출) */}
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md md:flex-row">
              <div className="flex flex-col items-center gap-1">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt="QR"
                    width={120}
                    height={120}
                    className="rounded-xl bg-white p-1"
                  />
                ) : (
                  <div className="h-[120px] w-[120px] animate-pulse rounded-xl bg-white/10" />
                )}
                <p className="text-[10px] font-semibold text-white/60">QR 스캔</p>
              </div>
              <div className="flex-1 text-center md:text-left">
                <p className="text-[11px] font-bold uppercase tracking-widest text-amber-300/80">
                  참가자 모집 중
                </p>
                <p className="mt-1 text-3xl font-extrabold text-amber-100">
                  {participants.length}명
                </p>
                <p className="mt-1 text-[11px] text-white/60">
                  토리FM 라디오 청취자에게 자동 모달이 떠요
                </p>
              </div>
            </div>

            {/* 진행 상태 별 UI */}
            {phase === "lobby" && (
              <button
                type="button"
                onClick={() => handleStartRound("normal")}
                disabled={advancing || participants.length === 0}
                className="flex w-full items-center justify-center rounded-2xl bg-amber-400 px-4 py-4 text-base font-bold text-[#0B1538] shadow-lg shadow-amber-400/30 transition hover:bg-amber-300 disabled:opacity-50"
              >
                {advancing ? "라운드 준비 중…" : `▶ 1라운드 시작 (${participants.length}명)`}
              </button>
            )}

            {phase === "running" && round && (
              <RoundRunningPanel
                round={round}
                countdown={countdown}
                pickRemain={pickRemain}
                hostPick={hostPick}
                onHostPick={handleHostPick}
                picks={picks}
                onResolve={handleResolve}
                resolving={resolving}
              />
            )}

            {phase === "round_result" && showResolution && (
              <RoundResultPanel
                resolution={showResolution}
                onNext={() => handleStartRound("normal")}
                onRevival={() => handleStartRound("revival")}
                onReplay={() => handleStartRound("replay")}
                onForceFinish={handleForceFinish}
                advancing={advancing}
              />
            )}

            {/* 강제 종료 버튼 */}
            {(phase === "lobby" || phase === "running" || phase === "round_result") &&
              room.status !== "finished" && (
                <button
                  type="button"
                  onClick={handleForceFinish}
                  className="w-full rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200 transition hover:bg-rose-500/20"
                >
                  ⏹ 지금 종료하고 현 생존자 모두 우승 처리
                </button>
              )}
          </div>
        )}

        {/* PHASE: FINISHED — 선물함 등록 (입력 폼 없음, 미리 입력해둔 정보로 발송) */}
        {phase === "finished" && room && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-center">
              <p className="text-3xl">🎉</p>
              <p className="mt-2 text-base font-bold text-emerald-200">
                게임 종료 — 우승자 {winners.length}명
              </p>
              <p className="mt-1 text-[11px] text-white/70">
                우승자 앱의 선물함으로 자동 등록돼요
              </p>
            </div>

            {/* 우승자 명단 — 선물 이름 인라인 표시 */}
            {winners.length > 0 && (
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.04] p-2 text-xs">
                {winners.map((w) => (
                  <li
                    key={w.user_id}
                    className="flex flex-wrap items-center gap-2 px-1 py-1 text-white/85"
                  >
                    <span className="font-semibold">🏆 {w.display_name}</span>
                    {room.gift_label && (
                      <span className="text-amber-200/90">🎁 {room.gift_label}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* 선물 사진 미리보기 */}
            {room.gift_image_url && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={room.gift_image_url}
                  alt="선물 사진"
                  className="max-h-32 rounded-xl border border-white/10 object-contain"
                />
              </div>
            )}

            {/* 메시지 인용 */}
            {room.gift_message && (
              <blockquote className="rounded-xl border-l-4 border-amber-300/60 bg-white/[0.04] px-3 py-2 text-xs italic text-white/80">
                {room.gift_message}
              </blockquote>
            )}

            {/* 레거시 방 — gift_label 미설정. 새 게임에서만 등록 가능. */}
            {!room.gift_label && (
              <p className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-[11px] text-amber-200">
                ⚠ 이 방은 선물 정보가 등록돼 있지 않아요. 새 게임을 시작해 선물 정보를 미리 입력해 주세요.
              </p>
            )}

            <button
              type="button"
              onClick={handleSendGifts}
              disabled={sendingGift || winners.length === 0 || !room.gift_label}
              className="flex w-full items-center justify-center rounded-2xl bg-amber-400 px-4 py-3 text-base font-bold text-[#0B1538] shadow-lg shadow-amber-400/30 transition hover:bg-amber-300 disabled:opacity-50"
            >
              {sendingGift
                ? "등록 중…"
                : `🎁 ${winners.length}명 선물함에 등록`}
            </button>

            {giftResult && (
              <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-200">
                ✓ 등록 성공 {giftResult.sent}명 · 실패 {giftResult.failed}명
              </p>
            )}
          </div>
        )}

        {/* PHASE: GIFT_SENT */}
        {phase === "gift_sent" && (
          <div className="space-y-4 text-center">
            <p className="text-5xl">🎁</p>
            <p className="text-base font-bold text-amber-100">선물함에 등록됐어요!</p>
            <p className="text-xs text-white/60">
              우승자가 앱 선물함에서 QR로 받아갈 수 있어요
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-amber-400 px-6 py-3 text-sm font-bold text-[#0B1538] shadow-md hover:bg-amber-300"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Sub-components                                                              */
/* ========================================================================== */

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "amber" | "emerald";
}) {
  const cls =
    accent === "amber"
      ? "text-amber-200"
      : accent === "emerald"
        ? "text-emerald-300"
        : "text-white/90";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2 backdrop-blur-md">
      <p className="text-[9px] font-bold uppercase tracking-widest text-white/50">{label}</p>
      <p className={`mt-0.5 text-xl font-extrabold ${cls}`}>{value}</p>
    </div>
  );
}

function RoundRunningPanel({
  round,
  countdown,
  pickRemain,
  hostPick,
  onHostPick,
  picks,
  onResolve,
  resolving,
}: {
  round: RpsRoundRow;
  countdown: number;
  pickRemain: number;
  hostPick: RpsPick | null;
  onHostPick: (p: RpsPick) => void;
  picks: RpsPickRow[];
  onResolve: () => void;
  resolving: boolean;
}) {
  const lockedReached = pickRemain === 0;
  return (
    <div className="space-y-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 backdrop-blur-md">
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-200">
          ROUND {round.round_no}
          {round.is_revival && " (부활전)"}
        </p>
        {countdown > 0 ? (
          <p className="mt-2 text-6xl font-black text-amber-200">{countdown}</p>
        ) : !lockedReached ? (
          <>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-white/60">
              남은 시간
            </p>
            <p className="text-5xl font-black text-amber-200">
              {Math.ceil(pickRemain / 1000)}s
            </p>
            <div className="mx-auto mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-amber-300 transition-all"
                style={{
                  width: `${Math.max(0, Math.min(100, (pickRemain / Math.max(1, new Date(round.locked_at).getTime() - new Date(round.starts_at).getTime())) * 100))}%`,
                }}
              />
            </div>
          </>
        ) : (
          <p className="mt-2 text-2xl font-bold text-amber-200">⏰ 시간 종료</p>
        )}
        <p className="mt-1 text-[11px] text-white/70">
          픽 도착: {picks.length}명
        </p>
      </div>

      {/* 호스트 픽 패드 */}
      <div>
        <p className="mb-1 text-center text-[11px] font-bold text-amber-200">
          호스트 손
        </p>
        <div className="grid grid-cols-3 gap-2">
          {PICKS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onHostPick(p)}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-2xl transition ${
                hostPick === p
                  ? "border-amber-300 bg-amber-300 text-[#0B1538] shadow-lg shadow-amber-300/30"
                  : "border-white/10 bg-white/[0.04] text-white/85 hover:bg-white/[0.12]"
              }`}
            >
              <span>{PICK_EMOJIS[p]}</span>
              <span className="text-[10px] font-bold">{PICK_LABELS[p]}</span>
            </button>
          ))}
        </div>
      </div>

      {lockedReached && (
        <button
          type="button"
          onClick={onResolve}
          disabled={resolving}
          className="flex w-full items-center justify-center rounded-2xl bg-amber-400 px-4 py-3 text-sm font-bold text-[#0B1538] shadow-lg hover:bg-amber-300 disabled:opacity-50"
        >
          {resolving ? "정산 중…" : "🏁 결과 공개"}
        </button>
      )}
    </div>
  );
}

function RoundResultPanel({
  resolution,
  onNext,
  onRevival,
  onReplay,
  onForceFinish,
  advancing,
}: {
  resolution: { survivors: number; eliminated: number; recommendation: RpsRoundRecommendation };
  onNext: () => void;
  onRevival: () => void;
  onReplay: () => void;
  onForceFinish: () => void;
  advancing: boolean;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-center backdrop-blur-md">
      <p className="text-3xl">🏁</p>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="생존" value={resolution.survivors} accent="emerald" />
        <Stat label="탈락" value={resolution.eliminated} />
      </div>
      <p className="text-[11px] text-white/70">
        추천:{" "}
        <span className="font-bold text-amber-200">
          {resolution.recommendation === "next_round" && "다음 라운드"}
          {resolution.recommendation === "revival" && "부활전"}
          {resolution.recommendation === "replay" && "재시도"}
          {resolution.recommendation === "finished" && "게임 종료"}
        </span>
      </p>
      <div className="flex flex-col gap-2">
        {resolution.recommendation === "next_round" && (
          <button
            type="button"
            onClick={onNext}
            disabled={advancing}
            className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-[#0B1538] hover:bg-amber-300 disabled:opacity-50"
          >
            ▶ 다음 라운드
          </button>
        )}
        {resolution.recommendation === "revival" && (
          <button
            type="button"
            onClick={onRevival}
            disabled={advancing}
            className="rounded-xl bg-orange-400 px-4 py-2.5 text-sm font-bold text-[#0B1538] hover:bg-orange-300 disabled:opacity-50"
          >
            ↻ 부활전 시작
          </button>
        )}
        {resolution.recommendation === "replay" && (
          <button
            type="button"
            onClick={onReplay}
            disabled={advancing}
            className="rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-bold text-[#0B1538] hover:bg-sky-300 disabled:opacity-50"
          >
            ⟳ 같은 풀로 재시도
          </button>
        )}
        {resolution.recommendation !== "finished" && (
          <button
            type="button"
            onClick={onForceFinish}
            className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/20"
          >
            ⏹ 지금 끝내기
          </button>
        )}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* GiftImagePicker — 파일 선택 + Ctrl+V 붙여넣기 + 드래그앤드롭                 */
/* ========================================================================== */

interface GiftImagePickerProps {
  value: string | null;
  onChange: (url: string | null) => void;
}

function GiftImagePicker({ value, onChange }: GiftImagePickerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setPickerError("이미지 파일만 업로드할 수 있어요");
        return;
      }
      setPickerError(null);
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await uploadGiftImageAction(fd);
        onChange(res.url);
      } catch (err) {
        setPickerError(err instanceof Error ? err.message : "업로드에 실패했어요");
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void upload(f);
    // 같은 파일 재선택 가능하도록 reset
    e.target.value = "";
  };

  const onPaste = (e: ReactClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const item = items.find((it) => it.type.startsWith("image/"));
    if (!item) return;
    const f = item.getAsFile();
    if (f) {
      e.preventDefault();
      void upload(f);
    }
  };

  const onDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = Array.from(e.dataTransfer?.files ?? []).find((file) =>
      file.type.startsWith("image/")
    );
    if (f) void upload(f);
  };

  const onDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
        aria-label="선물 사진 파일 선택"
      />

      {value ? (
        <div className="space-y-2">
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="선물 사진"
              className="max-h-40 rounded-xl border border-white/15 object-contain"
            />
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label="사진 제거"
              className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-[#0B1538] text-xs font-bold text-white/90 shadow hover:bg-rose-500/80"
            >
              ×
            </button>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/75 hover:bg-white/[0.08] disabled:opacity-50"
          >
            {uploading ? "업로드 중…" : "다시 선택"}
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label="사진 업로드 영역. 클릭하거나 Ctrl+V로 붙여넣거나 드래그앤드롭하세요"
          onClick={() => !uploading && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !uploading) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onPaste={onPaste}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`flex min-h-[88px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-3 py-4 text-center text-xs transition focus:outline-none focus:ring-2 focus:ring-amber-300/50 ${
            dragging
              ? "border-amber-300 bg-amber-300/10 text-amber-100"
              : "border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
          } ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          {uploading ? (
            <>
              <span className="mb-1 inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
              <span className="font-semibold text-amber-200">업로드 중…</span>
            </>
          ) : (
            <>
              <span className="text-base">📎</span>
              <span className="mt-1 font-semibold text-white/85">
                클릭해서 사진 선택
              </span>
              <span className="mt-0.5 text-[10px] text-white/55">
                또는 Ctrl+V 붙여넣기 / 드래그앤드롭
              </span>
            </>
          )}
        </div>
      )}

      {pickerError && (
        <p
          role="alert"
          className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-200"
        >
          {pickerError}
        </p>
      )}
    </div>
  );
}
