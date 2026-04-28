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
import { ReactionBar } from "./ReactionBar";
import { LiveChatComposer } from "./LiveChatComposer";

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
  /** 행사 커버 이미지 URL — 라이브커머스 스타일 풀블리드 배경. */
  coverImageUrl?: string | null;
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
  coverImageUrl,
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
      {/* ① 풀블리드 배경 — 행사 커버 또는 그라디언트 */}
      {coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverImageUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-[#1B2B3A] via-[#26394C] to-[#1B2B3A]"
        />
      )}
      {/* 가독성을 위한 다크 그라디언트 마스크 — 위·아래 어둡게 */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/85"
      />

      {/* ② VFX 오버레이 — 하트/이모지/드리프트 채팅/스토리 */}
      <ScreenEffectsLayer sessionId={sessionId} />

      {/* ③ 상단 HUD — 좌(브랜드 + LIVE) / 우(청취자 + 채우기) */}
      <div className="relative z-20 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="flex min-w-0 flex-col gap-1">
          {/* 브랜드 알약 */}
          <div className="inline-flex items-center gap-2 self-start rounded-full bg-black/45 px-3 py-1.5 backdrop-blur-md">
            <span className="text-base" aria-hidden>
              📻
            </span>
            <span className="truncate text-sm font-extrabold tracking-wide text-white">
              {brandName}
            </span>
            {sessionLive ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white"
                aria-label="ON AIR"
              >
                <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                LIVE
              </span>
            ) : (
              <span className="rounded-full bg-zinc-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white/85">
                OFF AIR
              </span>
            )}
          </div>
          {/* 시간대 / 경과 */}
          <div className="flex items-center gap-1.5">
            {sessionLive && elapsed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 font-mono text-[10px] tabular-nums text-amber-200 backdrop-blur-md">
                <span aria-hidden>⏱</span>
                {elapsed}
              </span>
            )}
            {timeRange && (
              <span className="inline-flex items-center rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white/80 backdrop-blur-md">
                {timeRange}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="rounded-full bg-black/45 px-2 py-1 backdrop-blur-md">
            <ListenerPresence orgId={orgId} variant="light" />
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "원래 크기로" : "화면 채우기"}
            className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1.5 text-[11px] font-bold text-white backdrop-blur-md transition hover:bg-black/65"
          >
            <span aria-hidden>{fullscreen ? "✕" : "⛶"}</span>
            <span className="hidden sm:inline">
              {fullscreen ? "닫기" : "채우기"}
            </span>
          </button>
        </div>
      </div>

      {/* ④ 본문 — Now Playing 핀 카드 (가운데 비주얼 영역) */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-3 py-6 sm:px-6">
        {sessionLive ? (
          nowPlaying ? (
            <div className="w-full max-w-md rounded-2xl border border-white/15 bg-black/55 p-5 shadow-2xl backdrop-blur-md">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300/90">
                ♪ Now Playing
              </p>
              <h2 className="mt-2 break-words text-2xl font-extrabold tracking-tight text-amber-100 md:text-3xl">
                {nowPlaying.song || "(제목 미입력)"}
              </h2>
              {nowPlaying.artist && (
                <p className="mt-0.5 text-sm font-semibold text-amber-200/85">
                  — {nowPlaying.artist}
                </p>
              )}
              {nowPlaying.story && (
                <blockquote className="mt-3 border-l-2 border-amber-300/60 pl-3 text-[13px] leading-relaxed text-white/95">
                  &ldquo;{nowPlaying.story}&rdquo;
                </blockquote>
              )}
              {nowPlaying.childName && (
                <p className="mt-2 text-right text-[11px] font-semibold text-amber-200/80">
                  — {nowPlaying.childName}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/15 bg-black/45 px-5 py-4 text-center backdrop-blur-md">
              <p className="text-3xl" aria-hidden>
                🌲
              </p>
              <p className="mt-2 text-sm font-semibold text-amber-200">
                다음 사연을 준비하고 있어요
              </p>
              <p className="mt-1 text-[11px] text-white/65">
                잠시만 기다려 주세요
              </p>
            </div>
          )
        ) : (
          <div className="rounded-2xl border border-white/15 bg-black/45 px-5 py-4 text-center backdrop-blur-md">
            <p className="text-3xl" aria-hidden>
              🌲
            </p>
            <p className="mt-2 text-sm font-semibold text-white/90">
              아직 방송 시작 전이에요
            </p>
            <p className="mt-1 text-[11px] text-white/65">
              정규 방송 시간에 다시 찾아와 주세요
            </p>
          </div>
        )}
      </div>

      {/* ⑤ 하단 액션 — 리액션 + 채팅 입력 (항상 노출) */}
      <div className="relative z-20 mt-auto flex flex-col gap-2 p-3 sm:p-4">
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
    </section>
  );
}
