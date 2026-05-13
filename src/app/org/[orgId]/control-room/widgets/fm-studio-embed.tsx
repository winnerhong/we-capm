// 관제실 하단에 토리FM 라이브 스튜디오를 그대로 임베드.
// /org/[orgId]/tori-fm 페이지의 LiveStudioConsole 데이터 흐름을 동일하게 재현.
//
// LIVE 세션이 없으면 안내 카드만 노출.

import Link from "next/link";
import {
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

export async function FmStudioEmbed({ orgId }: { orgId: string }) {
  const liveSession = await loadLiveFmSessionForOrg(orgId);

  if (!liveSession) {
    return (
      <section
        aria-label="토리FM"
        className="rounded-3xl border border-amber-500/20 bg-gradient-to-b from-[#0a1228] via-[#0d1838] to-[#101e44] p-6 text-center text-white shadow-xl"
      >
        <p className="text-3xl" aria-hidden>
          📻
        </p>
        <p className="mt-2 text-sm font-bold text-amber-100">
          진행 중인 토리FM 방송이 없어요
        </p>
        <p className="mt-1 text-[11px] text-white/60">
          /tori-fm 에서 방송을 시작하면 여기에 라이브 스튜디오가 노출됩니다.
        </p>
        <Link
          href={`/org/${orgId}/tori-fm`}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-[#1B2B3A] shadow-md hover:bg-amber-300"
        >
          🎙 토리FM 스튜디오로 이동 →
        </Link>
      </section>
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
    loadChatMessages(liveSession.id, 50),
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

  const initialStoryRequests = liveAllRequests.filter(
    (r) =>
      r.kind === "story_only" &&
      (r.status === "PENDING" ||
        r.status === "APPROVED" ||
        r.status === "QUEUED")
  );

  const playingStoryItems = playingGroup.map((r) => ({
    id: r.id,
    story: r.story,
    authorLabel: r.is_anonymous
      ? anonLabelFromUserId(r.user_id)
      : (r.child_name?.trim() ?? ""),
    createdAt: r.created_at,
  }));

  return (
    <section
      aria-label="토리FM 라이브 스튜디오 (관제실 임베드)"
      className="space-y-2"
    >
      <div className="flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-sm font-bold text-amber-200">
          🎙 토리FM 라이브 스튜디오
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/95 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-md">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            ON AIR
          </span>
        </h2>
        <Link
          href={`/org/${orgId}/tori-fm${
            liveSession.event_id ? `?event=${liveSession.event_id}` : ""
          }`}
          className="rounded-lg bg-amber-400/90 px-2.5 py-1 text-[10px] font-bold text-[#1B2B3A] shadow hover:bg-amber-300"
        >
          ↗ 풀스크린
        </Link>
      </div>
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
        initialStoryRequests={initialStoryRequests}
        eventId={liveSession.event_id ?? null}
        initialRpsRoom={initialRpsRoom}
      />
    </section>
  );
}
