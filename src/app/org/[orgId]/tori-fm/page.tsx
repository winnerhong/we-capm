import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import {
  loadFmSessionsByOrg,
  loadLiveFmSessionForOrg,
  loadRadioQueueDetailed,
  loadRadioQueueItemWithSubmission,
} from "@/lib/missions/queries";
import type {
  RadioModerationStatus,
  ToriFmSessionRow,
} from "@/lib/missions/types";
import {
  loadChatMessages,
  loadOpenSessionRequests,
  loadPendingRequests,
  loadPlayingGroup,
  loadQueuedRequests,
} from "@/lib/tori-fm/queries";
import { anonLabelFromUserId } from "@/lib/tori-fm/types";
import { loadOrgEventSummaries } from "@/lib/org-events/queries";
import { loadActiveRpsRoomForFmSession } from "@/lib/rps/queries";
import { FmSessionControls } from "./FmSessionControls";
import { LiveStudioConsole } from "./LiveStudioConsole";
import { LinkFmToEventButton } from "./link-fm-to-event-button";
import { QuickStartLiveButton } from "./QuickStartLiveButton";

export const dynamic = "force-dynamic";

function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function categorizeSession(s: ToriFmSessionRow): "LIVE" | "UPCOMING" | "PAST" {
  if (s.is_live) return "LIVE";
  const now = Date.now();
  const start = new Date(s.scheduled_start).getTime();
  if (Number.isFinite(start) && start > now) return "UPCOMING";
  return "PAST";
}

export default async function OrgToriFmPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ event?: string }>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  const session = await requireOrg();

  const [liveSessionRaw, allSessions, approvedQueue, events] = await Promise.all([
    loadLiveFmSessionForOrg(orgId),
    loadFmSessionsByOrg(orgId),
    loadRadioQueueDetailed(
      orgId,
      "APPROVED" as RadioModerationStatus
    ),
    loadOrgEventSummaries(orgId),
  ]);

  // 행사 필터 — ?event={id} 가 유효한 행사일 때만 적용
  const requestedEventId = (sp.event ?? "").trim();
  const selectedEvent =
    requestedEventId && events.find((e) => e.event_id === requestedEventId)
      ? events.find((e) => e.event_id === requestedEventId) ?? null
      : null;

  // 필터링 적용 — selectedEvent 가 있으면 해당 event_id 만, 없으면 전체
  const sessions = selectedEvent
    ? allSessions.filter((s) => s.event_id === selectedEvent.event_id)
    : allSessions;
  const liveSession =
    selectedEvent && liveSessionRaw?.event_id !== selectedEvent.event_id
      ? null
      : liveSessionRaw;

  // OFF 상태 fallback 세션 — selectedEvent 의 가장 최근 세션 (LIVE 시작 전이라도
  // 누적된 신청곡/사연/랭킹을 호스트가 미리 볼 수 있게 함).
  const fallbackSession = !liveSession
    ? sessions[0] ?? null
    : null;

  // 현재 재생 중인 큐 정보 + LIVE 세션 전용 interactive 데이터
  // + OFF 상태 fallback 세션의 신청곡(미리보기)
  const [
    nowPlaying,
    chatMessages,
    pendingRequests,
    queuedRequests,
    playingGroup,
    initialRpsRoom,
    offAirRequests,
    liveAllRequests,
  ] = await Promise.all([
    liveSession?.current_queue_id
      ? loadRadioQueueItemWithSubmission(liveSession.current_queue_id)
      : Promise.resolve(null),
    liveSession ? loadChatMessages(liveSession.id, 50) : Promise.resolve([]),
    liveSession ? loadPendingRequests(liveSession.id) : Promise.resolve([]),
    liveSession ? loadQueuedRequests(liveSession.id) : Promise.resolve([]),
    liveSession ? loadPlayingGroup(liveSession.id) : Promise.resolve([]),
    liveSession
      ? loadActiveRpsRoomForFmSession(liveSession.id)
      : Promise.resolve(null),
    fallbackSession
      ? loadOpenSessionRequests(fallbackSession.id)
      : Promise.resolve([]),
    // RequestsWithHearts(통합) 용 — OPEN 신청곡 + 사연 모두.
    liveSession
      ? loadOpenSessionRequests(liveSession.id)
      : Promise.resolve([]),
  ]);

  // PLAYING 묶음의 첫 row 가 head — NOW PLAYING 의 곡명/아티스트/사연 head 결정.
  const playingRequest = playingGroup[0] ?? null;

  // NOW PLAYING fallback — PLAYING request 우선, 없으면 current_queue_id 기반
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
  // 작성자 표시 — PLAYING request 가 익명이면 anonLabel, 아니면 child_name 우선
  const nowParentName = playingRequest
    ? playingRequest.is_anonymous
      ? anonLabelFromUserId(playingRequest.user_id)
      : (playingRequest.child_name ?? null)
    : (nowPlaying?.user?.parent_name ?? null);

  // StoryQueueCard 용 — 익명 사연 중 active(PENDING/APPROVED/QUEUED) 만.
  const initialStoryRequests = liveAllRequests.filter(
    (r) =>
      r.kind === "story_only" &&
      (r.status === "PENDING" ||
        r.status === "APPROVED" ||
        r.status === "QUEUED")
  );

  // 같은 곡 묶음 사연 — 작성자 라벨은 서버에서 익명/실명 분기.
  // (호스트 NOW PLAYING 카드와 BroadcastQueueCard 양쪽이 사용)
  const playingStoryItems = playingGroup.map((r) => ({
    id: r.id,
    story: r.story,
    authorLabel: r.is_anonymous
      ? anonLabelFromUserId(r.user_id)
      : (r.child_name?.trim() ?? ""),
    createdAt: r.created_at,
  }));

  const upcoming = sessions.filter((s) => categorizeSession(s) === "UPCOMING");
  const live = sessions.filter((s) => s.is_live);
  const past = sessions.filter((s) => categorizeSession(s) === "PAST");

  const publicUrl = `/screen/tori-fm/${orgId}`;

  return (
    <div className="min-h-screen bg-[#FFF8F0]">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-4 md:py-6">
        <nav aria-label="breadcrumb" className="text-xs text-[#6B6560]">
          <Link href={`/org/${orgId}`} className="hover:text-amber-700">
            기관홈
          </Link>
          <span className="mx-2">/</span>
          <span className="font-semibold text-[#1B2B3A]">
            토리FM 라이브 스튜디오
          </span>
          {selectedEvent && (
            <>
              <span className="mx-2">/</span>
              <span className="font-semibold text-amber-700">
                🎪 {selectedEvent.name || "(이름 없음)"}
              </span>
            </>
          )}
        </nav>

        {/* 행사별 필터 — 라이트 베이지 카드 톤 */}
        {events.length > 0 && (
          <section
            aria-label="행사별 보기"
            className="rounded-3xl border border-amber-200/60 bg-white/80 p-3 shadow-sm backdrop-blur-sm"
          >
            <p className="mb-2 px-1 text-[11px] font-bold text-amber-700">
              🎪 행사별로 보기
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/org/${orgId}/tori-fm`}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold transition ${
                  !selectedEvent
                    ? "border-amber-400 bg-amber-400 text-[#1B2B3A] shadow-md"
                    : "border-amber-200/70 bg-white text-[#6B6560] hover:bg-amber-50"
                }`}
              >
                <span aria-hidden>📋</span>
                <span>전체</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    !selectedEvent ? "bg-[#1B2B3A]/15" : "bg-amber-100"
                  }`}
                >
                  {allSessions.length}
                </span>
              </Link>
              {events.map((e) => {
                const active = selectedEvent?.event_id === e.event_id;
                const count = allSessions.filter(
                  (s) => s.event_id === e.event_id
                ).length;
                const isLive = e.status === "LIVE";
                return (
                  <Link
                    key={e.event_id}
                    href={`/org/${orgId}/tori-fm?event=${e.event_id}`}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold transition ${
                      active
                        ? "border-amber-400 bg-amber-400 text-[#1B2B3A] shadow-md"
                        : "border-amber-200/70 bg-white text-[#6B6560] hover:bg-amber-50"
                    }`}
                  >
                    {isLive && (
                      <span
                        className={`relative inline-flex h-1.5 w-1.5 ${
                          active ? "" : "animate-pulse"
                        }`}
                        aria-hidden
                      >
                        <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
                      </span>
                    )}
                    <span className="max-w-[10rem] truncate">
                      {e.name || "(이름 없음)"}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                        active ? "bg-[#1B2B3A]/15" : "bg-amber-100"
                      }`}
                    >
                      {count}
                    </span>
                  </Link>
                );
              })}
            </div>
            {selectedEvent && (
              <p className="mt-2 px-1 text-[11px] text-amber-700/80">
                💡 아래 세션 만들기 폼에서 만드는 신규 세션은{" "}
                <b className="text-amber-800">
                  &quot;{selectedEvent.name || "(이름 없음)"}&quot;
                </b>{" "}
                행사에 자동 연결돼요.
              </p>
            )}
          </section>
        )}

      <header className="rounded-3xl border border-amber-200/70 bg-white/90 p-5 shadow-sm backdrop-blur-sm md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#070C1F] via-[#0B1538] to-[#0F1F4A] text-3xl text-amber-100 shadow-md"
            aria-hidden
          >
            {/* LIVE 일 때 라디오 아이콘 둘레 파동 */}
            {liveSession && (
              <span className="absolute -inset-1 animate-ping rounded-2xl bg-rose-400/40" />
            )}
            <span className="relative">🎙</span>
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 text-lg font-bold text-[#1B2B3A] md:text-xl">
              토리FM 라이브 스튜디오
              {liveSession && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-rose-500/95 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-md shadow-rose-500/40"
                  aria-label="ON AIR"
                >
                  <span className="relative inline-flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                  ON AIR
                </span>
              )}
            </h1>
            <p className="text-xs text-[#6B6560]">
              방송 세션을 만들고 신청곡을 편성하세요
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/org/${orgId}/missions/radio`}
              className="rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 shadow-sm transition hover:bg-amber-100"
            >
              📋 모더레이션
            </Link>
            <Link
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-[#1B2B3A] shadow-md shadow-amber-400/30 transition hover:bg-amber-300"
            >
              📺 전광판 열기
            </Link>
          </div>
        </div>
      </header>

      {/* Live 세션 — 행사를 선택해야 LIVE 콘솔이 노출됨. 전체 모드에서는 안내만. */}
      {selectedEvent ? (
        liveSession ? (
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
            eventId={selectedEvent.event_id}
            initialRpsRoom={initialRpsRoom}
          />
        ) : (
          <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#070C1F] via-[#0B1538] to-[#0F1F4A] p-5 text-center text-white shadow-xl backdrop-blur-md md:p-7">
            <p className="text-3xl" aria-hidden>
              📻
            </p>
            <p className="mt-2 text-sm font-bold text-amber-100">
              현재 진행 중인 방송이 없어요
            </p>

            {/* 다른 곳에서 LIVE 중인 세션 발견 — 이 행사로 연결 제안 */}
            {liveSessionRaw &&
              liveSessionRaw.event_id !== selectedEvent.event_id && (
                <div className="mx-auto mt-4 inline-flex max-w-sm flex-col items-center gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-200">
                    <span
                      className="relative inline-flex h-1.5 w-1.5"
                      aria-hidden
                    >
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
                    </span>
                    <span>
                      {liveSessionRaw.event_id
                        ? "다른 행사에서 LIVE 중"
                        : "행사 미연결로 LIVE 중"}
                    </span>
                  </span>
                  <p className="text-sm font-bold text-amber-100">
                    {liveSessionRaw.name}
                  </p>
                  <p className="text-[10px] leading-relaxed text-white/60">
                    이 LIVE 세션은 현재 이 행사에 연결되어 있지 않아요. 같은
                    행사로 옮기려면 아래 버튼을 누르세요.
                  </p>
                  <LinkFmToEventButton
                    eventId={selectedEvent.event_id}
                    eventName={selectedEvent.name || "(이름 없음)"}
                    sessionId={liveSessionRaw.id}
                    sessionName={liveSessionRaw.name}
                  />
                </div>
              )}

            {!liveSessionRaw && (
              <div className="mx-auto mt-5 max-w-sm">
                <QuickStartLiveButton
                  orgId={orgId}
                  eventId={selectedEvent.event_id}
                  defaultName={`${selectedEvent.name || "토리FM"} 라이브`}
                />
              </div>
            )}

          </section>
        )
      ) : (
        <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#070C1F] via-[#0B1538] to-[#0F1F4A] p-5 text-center text-white shadow-xl backdrop-blur-md md:p-7">
          <p className="text-3xl" aria-hidden>
            🎪
          </p>
          <p className="mt-2 text-sm font-bold text-amber-100">
            먼저 어느 행사의 방송을 다룰지 선택해 주세요
          </p>
          <p className="mt-1 text-xs text-white/70">
            위쪽 <span className="font-bold text-amber-200">🎪 행사별로 보기</span>{" "}
            칩을 클릭하면 그 행사의 LIVE 콘솔이 열립니다.
          </p>
          {liveSessionRaw && (
            <div className="mt-4 inline-flex flex-col items-center gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-200">
                <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
                </span>
                <span>지금 LIVE 중인 방송</span>
              </span>
              <p className="text-sm font-bold text-amber-100">
                {liveSessionRaw.name}
              </p>
              {liveSessionRaw.event_id && (
                <Link
                  href={`/org/${orgId}/tori-fm?event=${liveSessionRaw.event_id}`}
                  className="rounded-xl bg-amber-400 px-3 py-1.5 text-[11px] font-bold text-[#1B2B3A] shadow-md hover:bg-amber-300"
                >
                  🎬 이 행사 콘솔로 이동 →
                </Link>
              )}
            </div>
          )}
        </section>
      )}

      </div>
    </div>
  );
}

