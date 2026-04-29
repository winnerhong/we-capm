"use client";

// 통합 LIVE 스튜디오 콘솔 — DJ 작업대.
//   기존 4 카드(LiveStudioPanel · DjChatPanel · RequestModerationList · PollCreator)를
//   하나의 bento 그리드 안에 묶어 한 화면에서 방송 운영을 가능케 한다.
//
// 레이아웃 (xl 이상)
//   ┌──────────────────────────────────────────────┐
//   │  Zone A: LiveStudioPanel (NOW PLAYING/타이머) │  full width
//   ├──────────────────────────┬───────────────────┤
//   │  Zone C: 신청곡 모더레이션 │ Zone B: DJ 채팅    │
//   ├──────────────────────────┴───────────────────┤
//   │  Zone D: 투표 (PollCreator)                   │  full width
//   └──────────────────────────────────────────────┘
//
// xl 미만: 모든 zone 이 세로 stack. 각 zone 은 자체 카드 chrome 유지.
// 추후 Phase 4 의 SpotlightTriggerBar 가 Zone D 옆에 추가될 예정.

import { useState, type ReactNode } from "react";
import { LiveStudioPanel } from "./LiveStudioPanel";
import { DjChatPanel } from "./DjChatPanel";
import { RequestModerationList } from "./RequestModerationList";
import { SpotlightTriggerBar } from "./SpotlightTriggerBar";
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
  controls: ReactNode;
  // DjChatPanel
  initialChatMessages: FmChatMessageRow[];
  // RequestModerationList
  initialPendingRequests: FmRequestRow[];
  // RPS 통합 (옵셔널)
  eventId?: string | null;
  initialRpsRoom?: RpsRoomRow | null;
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
  controls,
  initialChatMessages,
  initialPendingRequests,
  eventId = null,
  initialRpsRoom = null,
}: Props) {
  // 모달 상태 — mode 가 변할 때마다 key 를 증가시켜 HostRpsModal 을 강제 재마운트
  // (initialRoom prop 만 바꿔도 내부 useState 초기값은 첫 렌더 때만 적용되므로).
  const [rpsState, setRpsState] = useState<{
    open: boolean;
    mode: "continue" | "new";
    key: number;
  }>({ open: false, mode: "continue", key: 0 });

  const rpsStatus = initialRpsRoom?.status ?? null;
  const isRunning = rpsStatus === "running" || rpsStatus === "idle";
  const isFinished = rpsStatus === "finished";

  // 카드 메인 버튼 — 상태별 분기
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
  return (
    <div className="space-y-4 xl:grid xl:grid-cols-2 xl:gap-4 xl:space-y-0">
      {/* Zone A: NOW PLAYING / 타이머 / 컨트롤 — full width */}
      <div className="xl:col-span-2">
        <LiveStudioPanel
          sessionName={sessionName}
          scheduledStart={scheduledStart}
          scheduledEnd={scheduledEnd}
          startedAt={startedAt}
          song={song}
          artist={artist}
          story={story}
          parentName={parentName}
          orgId={orgId}
          controls={controls}
        />
      </div>

      {/* Zone C: 신청곡 모더레이션 — 좌하 */}
      <RequestModerationList
        sessionId={sessionId}
        initialPending={initialPendingRequests}
      />

      {/* Zone B: DJ 채팅 — 우하 */}
      <DjChatPanel
        sessionId={sessionId}
        initialMessages={initialChatMessages}
      />

      {/* Zone D: 전광판 스포트라이트 트리거 — full width */}
      <div className="xl:col-span-2">
        <SpotlightTriggerBar
          sessionId={sessionId}
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

      {/* Zone E: RPS Launcher — full width */}
      <div className="xl:col-span-2">
        <section
          aria-label="단체 가위바위보 서바이벌"
          className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1B2B3A] via-[#26394C] to-[#1B2B3A] p-5 text-white shadow-xl backdrop-blur-md md:p-6"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-300/20 text-3xl backdrop-blur"
              aria-hidden
            >
              ✊
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-amber-100 md:text-lg">
                단체 가위바위보 서바이벌
              </h3>
              <p className="text-[11px] text-amber-200/70 md:text-xs">
                방송 중에 가위바위보 한 판으로 우승자를 뽑아 선물을 보내요
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
              <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-amber-200/90">
                지난 게임 종료
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleOpenMain}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 py-3 text-base font-bold text-[#0B1538] shadow-lg shadow-amber-400/30 transition hover:bg-amber-300 active:scale-[0.99]"
          >
            {mainLabel}
          </button>
          {isFinished && (
            <button
              type="button"
              onClick={handleOpenContinue}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-white/85 transition hover:bg-white/[0.08]"
            >
              📜 지난 게임 결과 보기
            </button>
          )}
        </section>
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
    </div>
  );
}
