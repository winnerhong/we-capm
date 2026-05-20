// 관제실 하단에 토리FM 라이브 스튜디오를 그대로 임베드.
// /org/[orgId]/tori-fm 페이지의 LiveStudioConsole 데이터 흐름을 동일하게 재현.
//
// LIVE 세션이 없으면 안내 카드만 노출.

import {
  loadFmSessionsByOrg,
  loadLiveFmSessionForOrg,
  loadRadioQueueItemWithSubmission,
} from "@/lib/missions/queries";
import {
  loadChatMessages,
  loadOpenSessionRequests,
  loadPendingRequests,
  loadPlayingGroup,
  loadQueuedRequests,
} from "@/lib/tori-fm/queries";
import { anonLabelFromUserId } from "@/lib/tori-fm/types";
import { loadActiveRpsRoomForFmSession } from "@/lib/rps/queries";
import { FmSessionControls } from "../../tori-fm/FmSessionControls";
import { LiveStudioConsole } from "../../tori-fm/LiveStudioConsole";
import { FmTogglePanel } from "./fm-toggle-panel";

export async function FmStudioEmbed({ orgId }: { orgId: string }) {
  const liveSession = await loadLiveFmSessionForOrg(orgId);

  if (!liveSession) {
    // LIVE 없음 → 켜기/예약 토글 패널. 예약(비-LIVE, 미종료) 세션을 시작 시각 순으로.
    const allSessions = await loadFmSessionsByOrg(orgId);
    const scheduledSessions = allSessions
      .filter((s) => !s.is_live && !s.ended_at)
      .sort(
        (a, b) =>
          new Date(a.scheduled_start).getTime() -
          new Date(b.scheduled_start).getTime()
      );
    return (
      <FmTogglePanel orgId={orgId} scheduledSessions={scheduledSessions} />
    );
  }

  // LIVE 세션 데이터 로드 — tori-fm/page.tsx 와 동일
  const [
    nowPlaying,
    chatMessages,
    pendingRequests,
    queuedRequests,
    playingGroup,
    initialRpsRoom,
    liveAllRequests,
  ] = await Promise.all([
    liveSession.current_queue_id
      ? loadRadioQueueItemWithSubmission(liveSession.current_queue_id)
      : Promise.resolve(null),
    loadChatMessages(liveSession.id, 200),
    loadPendingRequests(liveSession.id),
    loadQueuedRequests(liveSession.id),
    loadPlayingGroup(liveSession.id),
    loadActiveRpsRoomForFmSession(liveSession.id),
    loadOpenSessionRequests(liveSession.id),
  ]);

  const playingRequest = playingGroup[0] ?? null;

  const nowSong = playingRequest?.song_title
    ? playingRequest.song_title
    : typeof nowPlaying?.submission.payload_json.song_title === "string"
      ? (nowPlaying.submission.payload_json.song_title as string)
      : "";
  const nowArtist = playingRequest
    ? (playingRequest.artist ?? "")
    : typeof nowPlaying?.submission.payload_json.artist === "string"
      ? (nowPlaying.submission.payload_json.artist as string)
      : "";
  const nowStory = playingRequest
    ? (playingRequest.story ?? "")
    : typeof nowPlaying?.submission.payload_json.story_text === "string"
      ? (nowPlaying.submission.payload_json.story_text as string)
      : "";
  const nowParentName = playingRequest
    ? playingRequest.is_anonymous
      ? anonLabelFromUserId(playingRequest.user_id)
      : (playingRequest.child_name ?? null)
    : (nowPlaying?.user?.parent_name ?? null);

  const playingStoryItems = playingGroup.map((r) => ({
    id: r.id,
    story: r.story,
    authorLabel: r.is_anonymous
      ? anonLabelFromUserId(r.user_id)
      : (r.child_name?.trim() ?? ""),
    createdAt: r.created_at,
  }));

  return (
    // 성능: content-visibility:auto 로 화면 밖이면 paint 스킵 →
    // 페이지 끝까지 스크롤 안 했을 때 FM 콘솔 렌더 비용 차감.
    // contain-intrinsic-size 로 lay out 시 미리 자리 잡아 점프 방지.
    <section
      aria-label="토리FM 라이브 스튜디오"
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "900px 1400px",
      }}
    >
      <LiveStudioConsole
        orgId={orgId}
        sessionId={liveSession.id}
        sessionName={liveSession.name}
        scheduledStart={liveSession.scheduled_start}
        scheduledEnd={liveSession.scheduled_end}
        startedAt={liveSession.started_at}
        song={nowSong || null}
        artist={nowArtist || null}
        story={nowStory || null}
        parentName={nowParentName}
        nowPlayingKind={playingRequest?.kind ?? null}
        isAnonymous={playingRequest?.is_anonymous ?? false}
        playingStoryItems={playingStoryItems}
        controls={
          <FmSessionControls
            sessionId={liveSession.id}
            isLive={liveSession.is_live}
            queuedCount={queuedRequests.length}
            playingCount={playingGroup.length}
          />
        }
        initialChatMessages={chatMessages}
        initialPendingRequests={pendingRequests}
        initialQueuedRequests={queuedRequests}
        initialPlayingRequest={playingRequest}
        initialPlayingGroup={playingGroup}
        initialOpenRequests={liveAllRequests}
        eventId={liveSession.event_id ?? null}
        initialRpsRoom={initialRpsRoom}
        embedded
      />
    </section>
  );
}
