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

import type { ReactNode } from "react";
import { LiveStudioPanel } from "./LiveStudioPanel";
import { DjChatPanel } from "./DjChatPanel";
import { RequestModerationList } from "./RequestModerationList";
import { SpotlightTriggerBar } from "./SpotlightTriggerBar";
import type { FmChatMessageRow, FmRequestRow } from "@/lib/tori-fm/types";

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
}: Props) {
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
    </div>
  );
}
