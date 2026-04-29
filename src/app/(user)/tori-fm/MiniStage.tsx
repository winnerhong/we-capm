"use client";

// 참가자 토리FM 페이지의 미니 전광판 — "보고 느끼는 무대".
//
// 역할:
//   - 전광판(/screen/tori-fm/[orgId])과 동일한 라이브 신호를 받아 사용자에게 보여줌
//   - sub-second NOW PLAYING 갱신 (router.refresh 의존 X)
//   - VFX 4종(FloatingHearts · DriftUpChat · TopBanner · EmojiRain)을 카드 내부에
//     가두어 인터랙션 영역(아래 ChatPanel/리액션 등)을 가리지 않음
//   - StorySpotlight 만 풀스크린(풀화면 의도적 takeover)
//   - 청취자 카운트 + 경과 타이머로 "다 같이 듣는다" 분위기
//
// 컨테이너 트릭:
//   stage 카드를 `position: relative overflow-hidden` 으로 잡아두면 ScreenEffectsLayer
//   안의 VFX 4종(absolute inset-0) 이 자동으로 카드 영역에 갇힘. StorySpotlight 는
//   `position: fixed` 라 풀스크린 그대로 발사됨.
//
// 데이터 흐름은 ScreenLive 와 동일 — 두 화면이 같은 채널을 구독하므로 DJ 가 보내는
// 신호 한 번이 전광판·참가자 양쪽에 동시 반영.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { ToriFmSessionRow } from "@/lib/missions/types";
import { ListenerPresence } from "@/components/tori-fm/ListenerPresence";
import { ScreenEffectsLayer } from "@/app/screen/tori-fm/[orgId]/vfx/ScreenEffectsLayer";
import type { FmChatMessageRow } from "@/lib/tori-fm/types";
import { ReactionBar } from "./ReactionBar";
import { LiveChatComposer } from "./LiveChatComposer";
import { LiveChatStream } from "./LiveChatStream";
import { PlayerRpsModal } from "@/lib/rps/PlayerRpsModal";

export interface MiniStageNowPlaying {
  song: string;
  artist: string;
  story: string;
  childName: string;
}

interface QueueItemRow {
  id: string;
  fm_session_id: string | null;
  submission_id: string;
}

interface SubmissionRow {
  id: string;
  payload_json: {
    song_title?: string;
    artist?: string;
    story_text?: string;
    child_name?: string;
  };
}

interface Props {
  orgId: string;
  brandName: string;
  initialSession: ToriFmSessionRow | null;
  initialNowPlaying: MiniStageNowPlaying | null;
  /** 초기 채팅 메시지 — LiveChatStream SSR 에서 사용. */
  initialChatMessages?: FmChatMessageRow[];
  /** 현재 로그인 유저 — 카톡 스타일에서 본인 메시지 우측 배치. */
  currentUserId?: string | null;
}

const POLL_FALLBACK_MS = 5_000;

function fmtElapsed(startedAt: string | null, nowMs: number): string {
  if (!startedAt) return "";
  const t = new Date(startedAt).getTime();
  if (Number.isNaN(t)) return "";
  const sec = Math.max(0, Math.floor((nowMs - t) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function fmtTimeRange(start: string, end: string): string {
  try {
    const fmt = (iso: string) =>
      new Date(iso).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    return `${fmt(start)} ~ ${fmt(end)}`;
  } catch {
    return "";
  }
}

export function MiniStage({
  orgId,
  brandName,
  initialSession,
  initialNowPlaying,
  initialChatMessages = [],
  currentUserId = null,
}: Props) {
  const [session, setSession] = useState<ToriFmSessionRow | null>(initialSession);
  const [nowPlaying, setNowPlaying] = useState<MiniStageNowPlaying | null>(
    initialNowPlaying
  );
  const [now, setNow] = useState(() => Date.now());
  const lastQueueIdRef = useRef<string | null>(
    initialSession?.current_queue_id ?? null
  );

  // ── 풀스크린 토글 상태 ──────────────────────────────────────────
  const stageRef = useRef<HTMLElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // 브라우저 Fullscreen API 종료 감지 (ESC / 시스템 종료) — CSS 폴백 모드도 같이 동기화
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (fullscreen) {
      // 종료 — Fullscreen API 사용 중이면 exit, 아니면 CSS 폴백 해제
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          /* ignore */
        }
      }
      setFullscreen(false);
      return;
    }
    // 진입 — Fullscreen API 시도, 실패해도 CSS 폴백으로 진입
    const el = stageRef.current;
    if (el && typeof el.requestFullscreen === "function") {
      try {
        await el.requestFullscreen();
        setFullscreen(true);
        // 화면 회전 잠금 해제 — 디바이스 방향에 자연스럽게 따라가도록.
        // 일부 모바일 브라우저는 풀스크린 진입 시 landscape 로 강제하는 잔재 lock 이
        // 남아있을 수 있어 명시적 unlock 호출.
        const so = (
          screen as unknown as {
            orientation?: { unlock?: () => void };
          }
        ).orientation;
        if (so && typeof so.unlock === "function") {
          try {
            so.unlock();
          } catch {
            /* 미지원 브라우저는 무시 */
          }
        }
        return;
      } catch {
        /* iOS Safari 등 미지원 — CSS 폴백 */
      }
    }
    setFullscreen(true);
  }, [fullscreen]);

  /* ------------------------------------------------------------------------ */
  /* Refetch (ScreenLive 동일 패턴)                                            */
  /* ------------------------------------------------------------------------ */

  const refetch = useCallback(async () => {
    const supa = createClient();

    const sessionResp = (await (
      supa.from("tori_fm_sessions" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: boolean) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => {
                limit: (n: number) => {
                  maybeSingle: () => Promise<{
                    data: ToriFmSessionRow | null;
                  }>;
                };
              };
            };
          };
        };
      }
    )
      .select(
        "id, org_id, event_id, name, scheduled_start, scheduled_end, is_live, started_at, ended_at, current_queue_id, notes, created_at"
      )
      .eq("org_id", orgId)
      .eq("is_live", true)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: ToriFmSessionRow | null };

    const newSession = sessionResp.data;
    setSession(newSession);

    const queueId = newSession?.current_queue_id ?? null;

    if (queueId && queueId === lastQueueIdRef.current && nowPlaying) return;

    if (!queueId) {
      lastQueueIdRef.current = null;
      setNowPlaying(null);
      return;
    }

    const queueResp = (await (
      supa.from("mission_radio_queue" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: QueueItemRow | null }>;
          };
        };
      }
    )
      .select("id, fm_session_id, submission_id")
      .eq("id", queueId)
      .maybeSingle()) as { data: QueueItemRow | null };

    const queueRow = queueResp.data;
    if (!queueRow) {
      lastQueueIdRef.current = queueId;
      setNowPlaying(null);
      return;
    }

    const submissionResp = (await (
      supa.from("mission_submissions" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: SubmissionRow | null }>;
          };
        };
      }
    )
      .select("id, payload_json")
      .eq("id", queueRow.submission_id)
      .maybeSingle()) as { data: SubmissionRow | null };

    const submission = submissionResp.data;
    const p = submission?.payload_json ?? {};

    lastQueueIdRef.current = queueId;
    setNowPlaying({
      song: typeof p.song_title === "string" ? p.song_title : "",
      artist: typeof p.artist === "string" ? p.artist : "",
      story: typeof p.story_text === "string" ? p.story_text : "",
      childName: typeof p.child_name === "string" ? p.child_name : "",
    });
  }, [orgId, nowPlaying]);

  /* ------------------------------------------------------------------------ */
  /* Realtime + 폴링 fallback                                                  */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!orgId) return;
    const supa = createClient();
    let cancelled = false;

    const handle = () => {
      if (cancelled) return;
      void refetch();
    };

    const channel = supa
      .channel(`fm-mini-stage-${orgId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "tori_fm_sessions",
          filter: `org_id=eq.${orgId}`,
        } as never,
        handle as never
      )
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "mission_radio_queue",
          filter: `org_id=eq.${orgId}`,
        } as never,
        handle as never
      )
      .subscribe();

    const poll = setInterval(handle, POLL_FALLBACK_MS);

    return () => {
      cancelled = true;
      clearInterval(poll);
      void supa.removeChannel(channel);
    };
  }, [orgId, refetch]);

  /* ------------------------------------------------------------------------ */
  /* 1초 clock — 경과 타이머용                                                 */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!session?.is_live || !session.started_at) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session?.is_live, session?.started_at]);

  /* ------------------------------------------------------------------------ */
  /* 파생                                                                      */
  /* ------------------------------------------------------------------------ */

  const sessionLive = !!session?.is_live;
  const sessionId = session?.id ?? null;
  const elapsed = useMemo(
    () => fmtElapsed(session?.started_at ?? null, now),
    [session?.started_at, now]
  );
  const timeRange = useMemo(
    () =>
      session
        ? fmtTimeRange(session.scheduled_start, session.scheduled_end)
        : "",
    [session]
  );

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------ */

  return (
    <section
      ref={stageRef}
      className={`relative isolate flex flex-col overflow-hidden text-white shadow-xl ${
        fullscreen
          ? "fixed inset-0 z-50 rounded-none"
          : "min-h-[85vh] rounded-3xl"
      }`}
      aria-label="토리FM 보이는 라디오"
    >
      {/* ① 풀블리드 배경 — 깊은 네이비 그라디언트 (기본값). 위는 거의 검정,
          아래로 내려올수록 짙은 파랑으로 부드럽게 변화 — 사연/채팅 가독성 ↑. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-[#070C1F] via-[#0B1538] to-[#0F1F4A]"
      />

      {/* ② VFX 오버레이 — 하트/이모지/스토리.
          DriftUpChat 은 LiveChatStream 인라인 채팅과 중복 노출되므로 OFF. */}
      <ScreenEffectsLayer sessionId={sessionId} disableDriftChat />

      {/* ③ 상단 HUD — 좌(브랜드 + LIVE) / 우(청취자 + 채우기) — 글래스 온 네이비 */}
      <div className="relative z-20 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          {/* 브랜드 알약 */}
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 backdrop-blur-md">
            <span className="text-base" aria-hidden>
              📻
            </span>
            <span className="truncate text-sm font-extrabold tracking-wide text-white">
              {brandName}
            </span>
            {sessionLive ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-md shadow-rose-500/30"
                aria-label="ON AIR"
              >
                <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                LIVE
              </span>
            ) : (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white/70 ring-1 ring-white/15">
                OFF AIR
              </span>
            )}
          </div>
          {/* 시간대 / 경과 */}
          <div className="flex items-center gap-1.5">
            {sessionLive && elapsed && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] tabular-nums text-amber-200 backdrop-blur-md">
                <span aria-hidden>⏱</span>
                {elapsed}
              </span>
            )}
            {timeRange && (
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold text-white/70 backdrop-blur-md">
                {timeRange}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 backdrop-blur-md">
            <ListenerPresence orgId={orgId} variant="light" />
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "원래 크기로" : "화면 채우기"}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-bold text-white backdrop-blur-md transition hover:bg-white/15"
          >
            <span aria-hidden>{fullscreen ? "✕" : "⛶"}</span>
            <span className="hidden whitespace-nowrap sm:inline">
              {fullscreen ? "닫기" : "채우기"}
            </span>
          </button>
        </div>
      </div>

      {/* ④ 본문 — Now Playing 핀 카드 (가운데 비주얼 영역, 글래스 톤) */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-3 py-6 sm:px-6">
        {sessionLive ? (
          nowPlaying ? (
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/40 backdrop-blur-md">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300/90">
                ♪ Now Playing
              </p>
              <h2 className="mt-2 break-words text-2xl font-extrabold tracking-tight text-amber-100 md:text-3xl">
                {nowPlaying.song || "(제목 미입력)"}
              </h2>
              {nowPlaying.artist && (
                <p className="mt-0.5 text-sm font-semibold text-amber-200/80">
                  — {nowPlaying.artist}
                </p>
              )}
              {nowPlaying.story && (
                <blockquote className="mt-3 border-l-2 border-amber-300/50 pl-3 text-[13px] leading-relaxed text-white/95">
                  &ldquo;{nowPlaying.story}&rdquo;
                </blockquote>
              )}
              {nowPlaying.childName && (
                <p className="mt-2 text-right text-[11px] font-semibold text-amber-200/75">
                  — {nowPlaying.childName}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-5 text-center backdrop-blur-md">
              <p className="text-3xl" aria-hidden>
                🌲
              </p>
              <p className="mt-2 text-sm font-semibold text-amber-200">
                다음 사연을 준비하고 있어요
              </p>
              <p className="mt-1 text-[11px] text-white/55">
                잠시만 기다려 주세요
              </p>
            </div>
          )
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-5 text-center backdrop-blur-md">
            <p className="text-3xl" aria-hidden>
              🌲
            </p>
            <p className="mt-2 text-sm font-semibold text-white/85">
              아직 방송 시작 전이에요
            </p>
            <p className="mt-1 text-[11px] text-white/55">
              정규 방송 시간에 다시 찾아와 주세요
            </p>
          </div>
        )}
      </div>

      {/* ⑤ 하단 액션 — 채팅 스트림(머무름) + 리액션 + 입력바 (항상 노출) */}
      <div className="relative z-20 mt-auto flex flex-col gap-2 p-3 sm:p-4">
        {sessionId && (
          <LiveChatStream
            sessionId={sessionId}
            initialMessages={initialChatMessages}
            currentUserId={currentUserId}
          />
        )}
        {sessionId && (
          <ReactionBar
            sessionId={sessionId}
            isLive={sessionLive}
            variant="embedded"
          />
        )}
        {sessionId && (
          <LiveChatComposer sessionId={sessionId} isLive={sessionLive} />
        )}
      </div>

      {/* 단체 가위바위보 서바이벌 — 활성 RPS 방이 있으면 자동 모달로 등장 */}
      {sessionId && (
        <PlayerRpsModal
          fmSessionId={sessionId}
          isLive={sessionLive}
          currentUserId={currentUserId}
        />
      )}
    </section>
  );
}
