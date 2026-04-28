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
  loadPendingRequests,
} from "@/lib/tori-fm/queries";
import { loadOrgEventSummaries } from "@/lib/org-events/queries";
import { CreateSessionForm } from "./CreateSessionForm";
import { FmSessionControls } from "./FmSessionControls";
import { StartBroadcastButton } from "./StartBroadcastButton";
import { LiveStudioConsole } from "./LiveStudioConsole";
import { LinkFmToEventButton } from "./link-fm-to-event-button";

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

  // 현재 재생 중인 큐 정보 + LIVE 세션 전용 interactive 데이터
  const [nowPlaying, chatMessages, pendingRequests] = await Promise.all([
    liveSession?.current_queue_id
      ? loadRadioQueueItemWithSubmission(liveSession.current_queue_id)
      : Promise.resolve(null),
    liveSession ? loadChatMessages(liveSession.id, 50) : Promise.resolve([]),
    liveSession ? loadPendingRequests(liveSession.id) : Promise.resolve([]),
  ]);

  const nowSong =
    typeof nowPlaying?.submission.payload_json.song_title === "string"
      ? (nowPlaying.submission.payload_json.song_title as string)
      : "";
  const nowArtist =
    typeof nowPlaying?.submission.payload_json.artist === "string"
      ? (nowPlaying.submission.payload_json.artist as string)
      : "";
  const nowStory =
    typeof nowPlaying?.submission.payload_json.story_text === "string"
      ? (nowPlaying.submission.payload_json.story_text as string)
      : "";

  const upcoming = sessions.filter((s) => categorizeSession(s) === "UPCOMING");
  const live = sessions.filter((s) => s.is_live);
  const past = sessions.filter((s) => categorizeSession(s) === "PAST");

  const publicUrl = `/screen/tori-fm/${orgId}`;

  return (
    <div className="min-h-screen bg-[#0a141d]">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <nav aria-label="breadcrumb" className="text-xs text-white/50">
          <Link href={`/org/${orgId}`} className="hover:text-amber-200">
            기관홈
          </Link>
          <span className="mx-2">/</span>
          <span className="font-semibold text-amber-200">
            토리FM 제어실
          </span>
          {selectedEvent && (
            <>
              <span className="mx-2">/</span>
              <span className="font-semibold text-amber-200">
                🎪 {selectedEvent.name || "(이름 없음)"}
              </span>
            </>
          )}
        </nav>

        {/* 행사별 필터 — 참가자 페이지와 동일한 패턴 */}
        {events.length > 0 && (
          <section
            aria-label="행사별 보기"
            className="rounded-3xl border border-white/10 bg-black/30 p-3 backdrop-blur-sm"
          >
            <p className="mb-2 px-1 text-[11px] font-bold text-amber-200">
              🎪 행사별로 보기
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/org/${orgId}/tori-fm`}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold transition ${
                  !selectedEvent
                    ? "border-amber-300 bg-amber-300 text-[#1B2B3A] shadow-md"
                    : "border-white/20 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                <span aria-hidden>📋</span>
                <span>전체</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    !selectedEvent ? "bg-[#1B2B3A]/15" : "bg-white/10"
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
                        ? "border-amber-300 bg-amber-300 text-[#1B2B3A] shadow-md"
                        : "border-white/20 bg-white/5 text-white/70 hover:bg-white/10"
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
                        active ? "bg-[#1B2B3A]/15" : "bg-white/10"
                      }`}
                    >
                      {count}
                    </span>
                  </Link>
                );
              })}
            </div>
            {selectedEvent && (
              <p className="mt-2 px-1 text-[11px] text-amber-100/70">
                💡 아래 세션 만들기 폼에서 만드는 신규 세션은{" "}
                <b className="text-amber-200">
                  &quot;{selectedEvent.name || "(이름 없음)"}&quot;
                </b>{" "}
                행사에 자동 연결돼요.
              </p>
            )}
          </section>
        )}

      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1B2B3A] via-[#26394C] to-[#1B2B3A] p-5 text-white shadow-xl md:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl backdrop-blur"
            aria-hidden
          >
            📻
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-amber-100 md:text-xl">토리FM 제어실</h1>
            <p className="text-xs text-amber-200/70">
              방송 세션을 만들고 신청곡을 편성하세요
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/org/${orgId}/missions/radio`}
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/20"
            >
              🎙 모더레이션
            </Link>
            <Link
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-[#1B2B3A] shadow-md shadow-amber-400/30 transition hover:bg-amber-300"
            >
              🖥 전광판 열기
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
            parentName={nowPlaying?.user?.parent_name ?? null}
            controls={
              <FmSessionControls
                sessionId={liveSession.id}
                isLive={liveSession.is_live}
                currentQueueId={liveSession.current_queue_id}
                approvedQueueIds={approvedQueue.map((q) => q.id)}
              />
            }
            initialChatMessages={chatMessages}
            initialPendingRequests={pendingRequests}
          />
        ) : (
          <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1B2B3A] via-[#26394C] to-[#1B2B3A] p-5 text-center text-white shadow-xl md:p-7">
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

            {upcoming.length > 0 ? (
              <>
                <p className="mt-4 text-xs text-white/60">
                  다음 예정 방송을 지금 바로 시작해보세요.
                </p>
                <div className="mt-2 flex flex-col items-center gap-2">
                  <p className="text-sm font-bold text-amber-200">
                    🟢 {upcoming[0].name}
                  </p>
                  <p className="text-[11px] text-white/50">
                    예정: {fmtDateTime(upcoming[0].scheduled_start)} ~{" "}
                    {fmtDateTime(upcoming[0].scheduled_end)}
                  </p>
                  <StartBroadcastButton
                    sessionId={upcoming[0].id}
                    sessionName={upcoming[0].name}
                    variant="full"
                  />
                </div>
              </>
            ) : !liveSessionRaw ? (
              <p className="mt-1 text-xs text-white/60">
                먼저 아래에서 이 행사용 방송 세션을 만들어 주세요.
              </p>
            ) : null}
          </section>
        )
      ) : (
        <section className="rounded-3xl border border-white/10 bg-black/30 p-5 text-center text-white/80 backdrop-blur-sm md:p-7">
          <p className="text-3xl" aria-hidden>
            🎪
          </p>
          <p className="mt-2 text-sm font-bold text-amber-100">
            먼저 어느 행사의 방송을 다룰지 선택해 주세요
          </p>
          <p className="mt-1 text-xs text-white/60">
            위쪽 <span className="font-bold text-amber-200">🎪 행사별로 보기</span>{" "}
            칩을 클릭하면 그 행사의 LIVE 콘솔과 세션 목록이 열립니다.
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

      {/* 세션 목록 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-amber-100">
            <span aria-hidden>🗓</span>
            <span>방송 세션</span>
          </h2>
        </div>
        <CreateSessionForm
          orgId={orgId}
          eventId={selectedEvent?.event_id}
        />

        {sessions.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/60 backdrop-blur-sm">
            아직 만들어진 세션이 없어요.
          </p>
        ) : (
          <div className="space-y-3">
            {live.length > 0 && (
              <SessionGroup
                orgId={orgId}
                title="📻 LIVE"
                items={live}
                accent="rose"
              />
            )}
            {upcoming.length > 0 && (
              <SessionGroup
                orgId={orgId}
                title="🟢 예정"
                items={upcoming}
                accent="green"
              />
            )}
            {past.length > 0 && (
              <SessionGroup
                orgId={orgId}
                title="🕓 지난 방송"
                items={past}
                accent="gray"
              />
            )}
          </div>
        )}
      </section>

      {/* 승인된 큐 */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-amber-100">
          <span aria-hidden>📋</span>
          <span>방송 대기 큐 ({approvedQueue.length})</span>
        </h2>
        {approvedQueue.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/60 backdrop-blur-sm">
            승인된 사연이 없어요.{" "}
            <Link
              href={`/org/${orgId}/missions/radio`}
              className="font-semibold text-amber-300 underline"
            >
              모더레이션으로 이동
            </Link>
          </p>
        ) : (
          <ul className="space-y-2">
            {approvedQueue.map((q, idx) => {
              const song =
                typeof q.submission_payload.song_title === "string"
                  ? q.submission_payload.song_title
                  : "";
              const story =
                typeof q.submission_payload.story_text === "string"
                  ? q.submission_payload.story_text
                  : "";
              const isCurrent = liveSession?.current_queue_id === q.id;
              return (
                <li
                  key={q.id}
                  className={`rounded-2xl border bg-black/30 p-3 backdrop-blur-sm ${
                    isCurrent
                      ? "border-rose-400/60 ring-2 ring-rose-400/30"
                      : "border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-xs font-bold text-amber-200 ring-1 ring-amber-400/30">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">
                        🎵 {song || "(제목 미입력)"}
                      </p>
                      {story && (
                        <p className="truncate text-[11px] text-white/60">
                          {story}
                        </p>
                      )}
                    </div>
                    {isCurrent && (
                      <span className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-md shadow-rose-500/40">
                        재생 중
                      </span>
                    )}
                    {q.played_at && !isCurrent && (
                      <span className="shrink-0 rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-200 ring-1 ring-sky-400/30">
                        방송됨
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      </div>
    </div>
  );
}

function SessionGroup({
  orgId,
  title,
  items,
  accent,
}: {
  orgId: string;
  title: string;
  items: ToriFmSessionRow[];
  accent: "rose" | "green" | "gray";
}) {
  const borderCls =
    accent === "rose"
      ? "border-rose-400/40"
      : accent === "green"
        ? "border-emerald-400/30"
        : "border-white/10";
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-amber-200/70">{title}</p>
      <ul className="space-y-2">
        {items.map((s) => (
          <li
            key={s.id}
            className={`rounded-2xl border bg-black/30 p-3 text-white backdrop-blur-sm ${borderCls}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">
                  {s.name}
                </p>
                <p className="text-[11px] text-white/60">
                  🕐 {fmtDateTime(s.scheduled_start)} ~{" "}
                  {fmtDateTime(s.scheduled_end)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {accent === "green" && !s.is_live && (
                  <StartBroadcastButton
                    sessionId={s.id}
                    sessionName={s.name}
                  />
                )}
                <Link
                  href={`/org/${orgId}/tori-fm/${s.id}`}
                  className="rounded-xl border border-amber-300/40 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-200 transition hover:bg-amber-400/20"
                >
                  편집
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
