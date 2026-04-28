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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ToriFmSessionRow } from "@/lib/missions/types";
import { ListenerPresence } from "@/components/tori-fm/ListenerPresence";
import { ScreenEffectsLayer } from "@/app/screen/tori-fm/[orgId]/vfx/ScreenEffectsLayer";
import { ReactionBar } from "./ReactionBar";

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
}: Props) {
  const [session, setSession] = useState<ToriFmSessionRow | null>(initialSession);
  const [nowPlaying, setNowPlaying] = useState<MiniStageNowPlaying | null>(
    initialNowPlaying
  );
  const [now, setNow] = useState(() => Date.now());
  const lastQueueIdRef = useRef<string | null>(
    initialSession?.current_queue_id ?? null
  );

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
      className="relative isolate overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-[#1B2B3A] via-[#26394C] to-[#1B2B3A] p-6 text-white shadow-xl"
      aria-label="토리FM 무대"
    >
      {/* VFX 오버레이 — 카드 내부에 갇힘 (absolute inset-0).
          단 StorySpotlight 는 fixed 라 풀스크린으로 발사됨. */}
      <ScreenEffectsLayer sessionId={sessionId} />

      {/* 무대 콘텐츠 — VFX 위 z-10 */}
      <div className="relative z-10">
        {/* 상단 HUD — 경과 타이머(좌) · ON AIR / OFF AIR + 시간대 · 청취자(우) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {sessionLive ? (
              <>
                <span className="relative inline-flex h-2.5 w-2.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                </span>
                <p className="text-[11px] font-bold uppercase tracking-widest text-rose-300">
                  ON AIR
                </p>
                {elapsed && (
                  <span
                    className="ml-1 rounded-md bg-black/30 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-amber-200/80"
                    aria-label="방송 경과 시간"
                  >
                    ⏱ {elapsed}
                  </span>
                )}
              </>
            ) : (
              <>
                <span
                  className="inline-flex h-2.5 w-2.5 rounded-full bg-zinc-500"
                  aria-hidden
                />
                <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">
                  OFF AIR
                </p>
              </>
            )}
          </div>
          <ListenerPresence orgId={orgId} variant="light" />
        </div>

        {/* 로고 / 브랜드명 */}
        <div className="mt-5 text-center">
          <p className="text-5xl" aria-hidden>
            📻
          </p>
          <h1 className="mt-2 break-keep text-3xl font-extrabold leading-tight tracking-wide text-white">
            {brandName}
          </h1>
          <p className="mt-1 text-sm text-amber-200/80">보이는 라디오</p>
          {sessionLive && timeRange && (
            <p className="mt-1.5 text-[11px] font-semibold text-amber-200/60">
              {timeRange}
            </p>
          )}
        </div>

        {/* NOW PLAYING / 상태 카드 */}
        {sessionLive ? (
          nowPlaying ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-200/80">
                ♪ Now Playing
              </p>
              <h2 className="mt-1.5 break-words text-2xl font-extrabold tracking-tight text-amber-100 md:text-3xl">
                {nowPlaying.song || "(제목 미입력)"}
              </h2>
              {nowPlaying.artist && (
                <p className="mt-0.5 text-sm font-semibold text-amber-200/80">
                  — {nowPlaying.artist}
                </p>
              )}
              {nowPlaying.story && (
                <blockquote className="mt-3 border-l-2 border-amber-300/60 pl-3 text-[13px] leading-relaxed text-white/90">
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
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-center backdrop-blur-sm">
              <p className="text-3xl" aria-hidden>
                🌲
              </p>
              <p className="mt-2 text-sm font-semibold text-amber-200">
                다음 사연을 준비하고 있어요
              </p>
              <p className="mt-1 text-[11px] text-white/60">잠시만 기다려 주세요</p>
            </div>
          )
        ) : (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-center backdrop-blur-sm">
            <p className="text-3xl" aria-hidden>
              🌲
            </p>
            <p className="mt-2 text-sm font-semibold text-white/85">
              아직 방송 시작 전이에요
            </p>
            <p className="mt-1 text-[11px] text-white/60">
              정규 방송 시간에 다시 찾아와 주세요
            </p>
          </div>
        )}

        {/* 리액션 바 — 임베드 (다크 톤). 세션 ID 가 있어야 보냄. */}
        {sessionId && (
          <div className="mt-5">
            <ReactionBar
              sessionId={sessionId}
              isLive={sessionLive}
              variant="embedded"
            />
          </div>
        )}
      </div>
    </section>
  );
}
