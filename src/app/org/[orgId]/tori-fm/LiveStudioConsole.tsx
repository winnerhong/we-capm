"use client";

// 통합 LIVE 스튜디오 콘솔 — DJ 작업대 (리디자인).
// PC 와이드 12 컬럼 그리드 (xl 이상), 9 영역 색상 코드 + Hero 카드 압도감.
//
//   ┌────────────────────────────────────┬──────────────────────┐
//   │ Zone A: 메인 스테이지 (Hero, amber)   │ Zone B: 방송 대기 큐 │
//   │ col-span-9                          │ col-span-3 (teal)    │
//   ├────────────────────────────────────┼──────────────────────┤
//   │ Zone D: 모더레이션 (rose 강조)        │ Zone E: 채팅 (sky)    │
//   │ col-span-5                          │ col-span-7            │
//   ├────────────┬────────────┬───────────┼──────────────────────┤
//   │ Zone B-2   │ Zone B-3   │ Zone B-4  │ Zone Side             │
//   │ 인기사연(rose)│신청곡(amber)│사연(indigo)│ RPS(emerald) 단독     │
//   │ col-3      │ col-3      │ col-3     │ col-3                 │
//   └────────────┴────────────┴───────────┴──────────────────────┘
//
// 전광판 스포트라이트 트리거(Spotlight) 는 Zone E (라이브 채팅) 카드 안으로
// embedded 모드로 통합됨 — 채팅 메시지가 적을 때 여백을 활용.
//
// xl 미만(< 1280px): 모든 zone 이 세로 stack.
// 콘솔 배경은 사연 모드에서 살짝 violet 톤으로 분기.

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LiveStudioPanel, type PlayingItem } from "./LiveStudioPanel";
import { DjChatPanel } from "./DjChatPanel";
import { RequestModerationList } from "./RequestModerationList";
import { BroadcastQueueCard } from "./BroadcastQueueCard";
import { RequestsWithHearts } from "@/app/(user)/tori-fm/RequestsWithHearts";
import type { FmChatMessageRow, FmRequestRow } from "@/lib/tori-fm/types";
import type { RpsRoomRow } from "@/lib/rps/types";
import { HostRpsModal } from "@/lib/rps/HostRpsModal";

interface Props {
  orgId: string;
  sessionId: string;
  // LiveStudioPanel
  sessionName: string;
  scheduledStart: string;
  scheduledEnd: string;
  startedAt: string | null;
  song: string | null;
  artist: string | null;
  story: string | null;
  parentName: string | null;
  /** 현재 재생 중인 NOW PLAYING 의 종류 — story_only 면 사연 리더 모드 카드. */
  nowPlayingKind?: "song_request" | "story_only" | null;
  /** PLAYING request 가 익명으로 작성됐는지. */
  isAnonymous?: boolean;
  /**
   * 같은 곡(song_normalized) 묶음 PLAYING 사연 N건. 비어있거나 1건이면 단일 모드.
   * LiveStudioPanel 의 NOW PLAYING 카드에서 사용.
   */
  playingStoryItems?: PlayingItem[];
  controls: ReactNode;
  // DjChatPanel
  initialChatMessages: FmChatMessageRow[];
  // RequestModerationList
  initialPendingRequests: FmRequestRow[];
  // BroadcastQueueCard
  initialQueuedRequests: FmRequestRow[];
  initialPlayingRequest: FmRequestRow | null;
  /** 묶음 PLAYING 사연들 — BroadcastQueueCard 의 NOW PLAYING 영역에서 사용. */
  initialPlayingGroup?: FmRequestRow[];
  /** RequestsWithHearts (참가자와 동일 통합 리스트) — OPEN 신청곡 + 사연 모두. */
  initialOpenRequests: FmRequestRow[];
  // RPS 통합 (옵셔널)
  eventId?: string | null;
  initialRpsRoom?: RpsRoomRow | null;
  /** 관제실 안에 임베드될 때 — 바깥 rounded·border·bg 그라데이션 제거하여
   *  부모 네이비 배경에 자연스럽게 흐르게. */
  embedded?: boolean;
}

export function LiveStudioConsole({
  orgId,
  sessionId,
  sessionName,
  scheduledStart,
  scheduledEnd,
  startedAt,
  song,
  artist,
  story,
  parentName,
  nowPlayingKind = null,
  isAnonymous = false,
  playingStoryItems = [],
  controls,
  initialChatMessages,
  initialPendingRequests,
  initialQueuedRequests,
  initialPlayingRequest,
  initialPlayingGroup = [],
  initialOpenRequests,
  eventId = null,
  initialRpsRoom = null,
  embedded = false,
}: Props) {
  // Realtime auto-refresh — 호스트 ▶ 다음 곡 시 PLAYING row 변경되면 즉시
  // router.refresh() 호출해서 server props (song/artist/story) 갱신.
  // 이게 없으면 호스트가 router.refresh() 를 백그라운드로만 호출하므로 stale.
  const router = useRouter();
  useEffect(() => {
    if (!sessionId) return;
    const supa = createClient();
    const channel = supa
      .channel(`fm-host-console-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tori_fm_requests",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          router.refresh();
        }
      )
      .subscribe();
    return () => {
      void supa.removeChannel(channel);
    };
  }, [sessionId, router]);

  // 모달 상태 — mode 가 변할 때마다 key 를 증가시켜 HostRpsModal 을 강제 재마운트
  const [rpsState, setRpsState] = useState<{
    open: boolean;
    mode: "continue" | "new";
    key: number;
  }>({ open: false, mode: "continue", key: 0 });

  const rpsStatus = initialRpsRoom?.status ?? null;
  const isRunning = rpsStatus === "running" || rpsStatus === "idle";
  const isFinished = rpsStatus === "finished";

  const mainLabel = isRunning
    ? "✊ 진행 중인 게임 열기"
    : isFinished
    ? "🎮 새 게임 시작"
    : "✊ 가위바위보 시작";
  const mainMode: "continue" | "new" = isRunning ? "continue" : "new";

  const handleOpenMain = () =>
    setRpsState((s) => ({ open: true, mode: mainMode, key: s.key + 1 }));
  const handleOpenContinue = () =>
    setRpsState((s) => ({ open: true, mode: "continue", key: s.key + 1 }));
  const handleClose = () => setRpsState((s) => ({ ...s, open: false }));

  // 사연 모드 판정 — 콘솔 배경 그라데이션 분기에 사용
  const isStoryMode =
    nowPlayingKind === "story_only" || (!song && !!story);
  const consoleBg = isStoryMode
    ? "bg-gradient-to-b from-[#0a0a1f] via-[#1a0b2e] to-[#0F1F4A]"
    : "bg-gradient-to-b from-[#070C1F] via-[#0B1538] to-[#0F1F4A]";

  return (
    // 콘솔 전체를 다크 네이비 wrapper 로 감싸 메인 스테이지 + 보조 카드들이
    // 같은 군청 배경 위에 떠있도록. 사연 모드는 미세하게 violet 으로 변화.
    // embedded=true 면 부모(관제실) 가 이미 같은 네이비 바탕이라 wrapper 제거.
    <section
      className={
        embedded
          ? "transition-colors duration-700"
          : `rounded-3xl border border-white/10 ${consoleBg} p-3 shadow-2xl transition-colors duration-700 md:p-5`
      }
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Zone B: 방송 대기 큐 — 좌측 3/12. (사용자 요청: Hero 와 자리 교체) */}
        <div className="xl:col-span-3 xl:max-h-[44rem]">
          <BroadcastQueueCard
            sessionId={sessionId}
            initialQueued={initialQueuedRequests}
            initialPlaying={initialPlayingRequest}
            initialPlayingGroup={initialPlayingGroup}
            compact
          />
        </div>

        {/* Zone A: 메인 스테이지 Hero — 우측 9/12 */}
        <div className="xl:col-span-9 xl:max-h-[44rem]">
          <LiveStudioPanel
            sessionName={sessionName}
            scheduledStart={scheduledStart}
            scheduledEnd={scheduledEnd}
            startedAt={startedAt}
            song={song}
            artist={artist}
            story={story}
            parentName={parentName}
            nowPlayingKind={nowPlayingKind}
            isAnonymous={isAnonymous}
            storyItems={playingStoryItems}
            orgId={orgId}
            controls={controls}
          />
        </div>

        {/* Zone D: 모더레이션 (rose 강조 — 결정 필요) — 5/12 */}
        <div className="xl:col-span-5">
          <RequestModerationList
            sessionId={sessionId}
            initialPending={initialPendingRequests}
          />
        </div>

        {/* Zone E: 라이브 채팅 (sky 톤) — 7/12 (채팅 가시성 우선) */}
        {/* 전광판 스포트라이트 트리거 통합 — currentStory 전달 (사연 풀스크린에 사용) */}
        <div className="xl:col-span-7">
          <DjChatPanel
            sessionId={sessionId}
            initialMessages={initialChatMessages}
            currentStory={
              song
                ? {
                    songTitle: song,
                    artist,
                    story,
                    childName: null,
                    parentName,
                  }
                : null
            }
          />
        </div>

        {/* Zone B-3: 오늘 들어온 신청곡 (amber 톤) — 사연 카드 제거 후 9/12 확장 */}
        <div className="xl:col-span-9">
          <RequestsWithHearts
            sessionId={sessionId}
            initialRequests={initialOpenRequests}
            heartedIds={[]}
            filterKind="song_request"
            theme="dark"
            title={`🎵 오늘 들어온 신청곡 (${initialOpenRequests.filter((r) => r.kind !== "story_only" && r.status !== "HIDDEN").length})`}
          />
        </div>

        {/* Zone Side (col-3): 사이드 stack — RPS Launcher 단독.
            (Spotlight 트리거는 DjChatPanel 안으로 이동했음 — 채팅 여백 활용) */}
        <div className="flex flex-col gap-4 xl:col-span-3">
          {/* RPS Launcher — emerald 톤, 글로우 그림자 */}
          <section
            aria-label="단체 가위바위보 서바이벌"
            className="relative isolate rounded-2xl border-l-4 border-l-emerald-300/70 border-y border-y-white/10 border-r border-r-white/10 bg-[#101935] p-4 text-white shadow-md shadow-emerald-500/10 md:p-5"
          >
            {/* 외곽 글로우 */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-1 -z-10 rounded-3xl bg-emerald-500/[0.06] blur-2xl"
            />
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-300/20 text-2xl ring-1 ring-emerald-300/30 backdrop-blur"
                aria-hidden
              >
                ✊
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-emerald-100">
                  단체 가위바위보
                </h3>
                <p className="text-[11px] text-emerald-200/70">
                  한 판으로 우승자 뽑기
                </p>
              </div>
              {isRunning && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-md shadow-rose-500/40">
                  <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                  LIVE
                </span>
              )}
              {isFinished && (
                <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-emerald-200/90">
                  지난 게임 종료
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleOpenMain}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-emerald-950 shadow-lg shadow-emerald-400/30 transition hover:bg-emerald-300 active:scale-[0.99]"
            >
              {mainLabel}
            </button>
            {isFinished && (
              <button
                type="button"
                onClick={handleOpenContinue}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-white/85 transition hover:bg-white/[0.08]"
              >
                📜 지난 게임 결과 보기
              </button>
            )}
          </section>
        </div>

      </div>

      {/* RPS 호스트 모달 — mode 변경 시 key 강제 재마운트로 내부 state 리셋 */}
      <HostRpsModal
        key={`rps-${rpsState.mode}-${rpsState.key}`}
        open={rpsState.open}
        onClose={handleClose}
        orgId={orgId}
        fmSessionId={sessionId}
        eventId={eventId}
        initialRoom={rpsState.mode === "new" ? null : initialRpsRoom}
      />
    </section>
  );
}
