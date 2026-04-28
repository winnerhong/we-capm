"use client";

// 전광판의 클라이언트 주도 라이브 드라이버.
//
// 왜 만들었나:
//   기존 page.tsx 는 SSR 로 liveSession + nowPlaying 을 한 번 로드한 뒤
//   LiveFmRefresher 가 router.refresh() 를 트리거하는 방식이었다.
//   이 방식은 Supabase Realtime publication 이 늦거나 누락되면 30초 폴링까지
//   기다려야 했고, DJ 가 "다음 곡" 을 누른 직후 청취자 화면에 즉시 반영되지
//   못하는 체감 문제가 있었다.
//
// 새 구조:
//   1) 초기 SSR 데이터를 props 로 받음 (첫 페인트 빠름)
//   2) tori_fm_sessions / mission_radio_queue / fm_spotlight_events 를
//      클라이언트에서 직접 구독
//   3) 변화 감지 시 supabase 클라이언트로 직접 fetch → 로컬 state 업데이트
//   4) 5 초 폴링 fallback (Realtime 실패 시도)
//   5) ScreenEffectsLayer 도 이 컴포넌트에서 sessionId 바인딩 → 세션 전환 시
//      VFX 채널 자동 재구독
//
// 결과: NOW PLAYING / ON AIR / 청취 인원 / VFX 모두 sub-second 반영.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ToriFmSessionRow } from "@/lib/missions/types";
import { ScreenTimer } from "./ScreenTimer";
import { ListenerPresence } from "@/components/tori-fm/ListenerPresence";
import { ScreenEffectsLayer } from "./vfx/ScreenEffectsLayer";

export interface ScreenNowPlaying {
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
  initialNowPlaying: ScreenNowPlaying | null;
  showDemoControls?: boolean;
}

const POLL_FALLBACK_MS = 5_000;

export function ScreenLive({
  orgId,
  brandName,
  initialSession,
  initialNowPlaying,
  showDemoControls = false,
}: Props) {
  const [session, setSession] = useState<ToriFmSessionRow | null>(initialSession);
  const [nowPlaying, setNowPlaying] = useState<ScreenNowPlaying | null>(
    initialNowPlaying
  );
  const lastQueueIdRef = useRef<string | null>(
    initialSession?.current_queue_id ?? null
  );

  /* ------------------------------------------------------------------------ */
  /* Refetch                                                                   */
  /* ------------------------------------------------------------------------ */

  const refetch = useCallback(async () => {
    const supa = createClient();

    // 1) org 의 LIVE 세션 1건 (없을 수도 있음)
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

    // 2) current_queue_id 가 같으면 사연 fetch skip (불필요한 round-trip 방지)
    if (queueId && queueId === lastQueueIdRef.current && nowPlaying) {
      return;
    }

    if (!queueId) {
      lastQueueIdRef.current = null;
      setNowPlaying(null);
      return;
    }

    // 3) queue item 조회
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

    // 4) submission 조회
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
  /* Realtime 구독 + 폴링 fallback                                            */
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
      .channel(`fm-screen-driver-${orgId}`)
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

    // 5초 폴링 fallback — Realtime 누락 시 즉시감 보강
    const poll = setInterval(handle, POLL_FALLBACK_MS);

    return () => {
      cancelled = true;
      clearInterval(poll);
      void supa.removeChannel(channel);
    };
  }, [orgId, refetch]);

  /* ------------------------------------------------------------------------ */
  /* 파생 상태                                                                 */
  /* ------------------------------------------------------------------------ */

  const sessionLive = !!session?.is_live;
  const isOnAir = sessionLive && !!nowPlaying;
  const sessionId = session?.id ?? null;

  const startedAt = useMemo(
    () => session?.started_at ?? null,
    [session?.started_at]
  );

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------ */

  return (
    <>
      {/* VFX 오버레이 — sessionId 바인딩 */}
      <ScreenEffectsLayer
        sessionId={sessionId}
        showDemoControls={showDemoControls}
      />

      {/* 상단 HUD: 시각 + 청취 인원 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-6 md:p-8">
        <ScreenTimer startedAt={startedAt} />
        <div className="pointer-events-auto">
          <ListenerPresence orgId={orgId} variant="dark" />
        </div>
      </div>

      <main className="relative z-10 mx-auto flex min-h-dvh max-w-7xl flex-col items-center justify-center px-6 py-24 text-center md:py-32">
        {/* 로고 영역 */}
        <div className="mb-10 md:mb-14">
          <p className="text-6xl md:text-7xl" aria-hidden>
            🎙
          </p>
          <h1 className="mt-4 break-keep text-5xl font-extrabold leading-tight tracking-wide text-[#C4956A] md:text-7xl lg:text-8xl">
            {brandName}
          </h1>
          <p className="mt-3 text-base font-semibold text-[#8A8A8A] md:text-xl">
            보이는 라디오
          </p>
        </div>

        {/* ON AIR 메가 배지 */}
        {sessionLive && (
          <div className="mb-8 inline-flex items-center gap-3 rounded-full border-2 border-rose-500 bg-rose-500/10 px-6 py-2.5 backdrop-blur md:px-8 md:py-3">
            <span className="relative inline-flex h-3 w-3 md:h-4 md:w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-full w-full rounded-full bg-rose-500" />
            </span>
            <span className="text-sm font-bold tracking-[0.3em] text-rose-400 md:text-base">
              ON AIR
            </span>
          </div>
        )}

        {/* 방송 본문 */}
        {isOnAir && nowPlaying ? (
          <section className="w-full max-w-4xl rounded-3xl border border-[#3a2f27] bg-[#0f0a07]/85 p-8 shadow-2xl backdrop-blur md:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[#8A8A8A] md:text-sm">
              ♪ Now Playing
            </p>
            <h2 className="mt-4 break-words text-4xl font-extrabold text-[#E5B88A] md:text-6xl lg:text-7xl">
              {nowPlaying.song || "(제목 미입력)"}
            </h2>
            {nowPlaying.artist && (
              <p className="mt-2 text-xl font-semibold text-[#C4956A] md:text-3xl">
                — {nowPlaying.artist}
              </p>
            )}

            {nowPlaying.story && (
              <blockquote className="mt-8 rounded-2xl border border-[#3a2f27] bg-black/50 p-6 text-left md:p-8">
                <p className="whitespace-pre-wrap text-base leading-relaxed text-[#C4956A] md:text-xl lg:text-2xl lg:leading-[1.6]">
                  &ldquo;{nowPlaying.story}&rdquo;
                </p>
              </blockquote>
            )}

            {nowPlaying.childName && (
              <p className="mt-6 text-base font-semibold text-[#8A8A8A] md:text-xl">
                사연을 보내준 친구 — {nowPlaying.childName}
              </p>
            )}
          </section>
        ) : sessionLive ? (
          <section className="w-full max-w-2xl rounded-3xl border border-[#3a2f27] bg-[#0f0a07]/85 p-10 text-[#8A8A8A] shadow-xl backdrop-blur md:p-14">
            <p className="text-6xl md:text-7xl" aria-hidden>
              🌲
            </p>
            <p className="mt-5 text-2xl font-semibold text-[#C4956A] md:text-3xl">
              다음 사연을 준비하고 있어요
            </p>
            <p className="mt-3 text-base md:text-lg">잠시만 기다려 주세요</p>
          </section>
        ) : (
          <section className="w-full max-w-2xl rounded-3xl border border-[#3a2f27] bg-[#0f0a07]/85 p-10 text-[#8A8A8A] shadow-xl backdrop-blur md:p-14">
            <p className="text-6xl md:text-7xl" aria-hidden>
              🌲
            </p>
            <p className="mt-5 text-2xl font-semibold text-[#C4956A] md:text-3xl">
              점심시간을 기다리고 있어요
            </p>
            <p className="mt-3 text-base md:text-lg">
              곧 {brandName}이 방송을 시작해요
            </p>
          </section>
        )}
      </main>
    </>
  );
}
