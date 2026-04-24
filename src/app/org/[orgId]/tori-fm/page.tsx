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
  loadActivePoll,
  loadChatMessages,
  loadPendingRequests,
} from "@/lib/tori-fm/queries";
import { CreateSessionForm } from "./CreateSessionForm";
import { FmSessionControls } from "./FmSessionControls";
import { StartBroadcastButton } from "./StartBroadcastButton";
import { LiveStudioPanel } from "./LiveStudioPanel";
import { DjChatPanel } from "./DjChatPanel";
import { PollCreator } from "./PollCreator";
import { RequestModerationList } from "./RequestModerationList";

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
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const session = await requireOrg();

  const [liveSession, sessions, approvedQueue] = await Promise.all([
    loadLiveFmSessionForOrg(orgId),
    loadFmSessionsByOrg(orgId),
    loadRadioQueueDetailed(
      orgId,
      "APPROVED" as RadioModerationStatus
    ),
  ]);

  // 현재 재생 중인 큐 정보 + LIVE 세션 전용 interactive 데이터
  const [nowPlaying, chatMessages, pendingRequests, activePoll] =
    await Promise.all([
      liveSession?.current_queue_id
        ? loadRadioQueueItemWithSubmission(liveSession.current_queue_id)
        : Promise.resolve(null),
      liveSession ? loadChatMessages(liveSession.id, 50) : Promise.resolve([]),
      liveSession
        ? loadPendingRequests(liveSession.id)
        : Promise.resolve([]),
      liveSession
        ? loadActivePoll(liveSession.id)
        : Promise.resolve(null),
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
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관홈
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">
          토리FM 제어실
        </span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 text-white shadow-sm md:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl backdrop-blur"
            aria-hidden
          >
            📻
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold md:text-xl">토리FM 제어실</h1>
            <p className="text-xs text-[#D4E4BC]">
              방송 세션을 만들고 신청곡을 편성하세요
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/org/${orgId}/missions/radio`}
              className="rounded-xl border border-white/40 bg-white/15 px-3 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/25"
            >
              🎙 모더레이션
            </Link>
            <Link
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
            >
              🖥 전광판 열기
            </Link>
          </div>
        </div>
      </header>

      {/* Live 세션 — 실시간 스튜디오 패널 */}
      {liveSession ? (
        <>
          <LiveStudioPanel
            sessionName={liveSession.name}
            scheduledStart={liveSession.scheduled_start}
            scheduledEnd={liveSession.scheduled_end}
            startedAt={liveSession.started_at}
            song={nowSong || null}
            artist={nowArtist || null}
            story={nowStory || null}
            parentName={nowPlaying?.user?.parent_name ?? null}
            orgId={orgId}
            controls={
              <FmSessionControls
                sessionId={liveSession.id}
                isLive={liveSession.is_live}
                currentQueueId={liveSession.current_queue_id}
                approvedQueueIds={approvedQueue.map((q) => q.id)}
              />
            }
          />
          <PollCreator
            sessionId={liveSession.id}
            initialPoll={activePoll}
          />
        </>
      ) : (
        <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 text-center shadow-sm md:p-7">
          <p className="text-3xl" aria-hidden>
            📻
          </p>
          <p className="mt-2 text-sm font-bold text-[#2D5A3D]">
            현재 진행 중인 방송이 없어요
          </p>
          {upcoming.length > 0 ? (
            <>
              <p className="mt-1 text-xs text-[#6B6560]">
                다음 예정 방송을 지금 바로 시작해보세요.
              </p>
              <div className="mt-4 flex flex-col items-center gap-2">
                <p className="text-sm font-bold text-[#2D5A3D]">
                  🟢 {upcoming[0].name}
                </p>
                <p className="text-[11px] text-[#8B7F75]">
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
          ) : (
            <p className="mt-1 text-xs text-[#6B6560]">
              먼저 아래에서 방송 세션을 만들어주세요.
            </p>
          )}
        </section>
      )}

      {/* 세션 목록 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span aria-hidden>🗓</span>
            <span>방송 세션</span>
          </h2>
        </div>
        <CreateSessionForm orgId={orgId} />

        {sessions.length === 0 ? (
          <p className="rounded-2xl border border-[#D4E4BC] bg-white p-4 text-xs text-[#6B6560]">
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
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span aria-hidden>📋</span>
          <span>방송 대기 큐 ({approvedQueue.length})</span>
        </h2>
        {approvedQueue.length === 0 ? (
          <p className="rounded-2xl border border-[#D4E4BC] bg-white p-4 text-xs text-[#6B6560]">
            승인된 사연이 없어요.{" "}
            <Link
              href={`/org/${orgId}/missions/radio`}
              className="font-semibold text-[#2D5A3D] underline"
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
                  className={`rounded-2xl border bg-white p-3 shadow-sm ${
                    isCurrent
                      ? "border-rose-300 ring-2 ring-rose-200"
                      : "border-[#D4E4BC]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#E8F0E4] text-xs font-bold text-[#2D5A3D]">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#2D5A3D]">
                        🎵 {song || "(제목 미입력)"}
                      </p>
                      {story && (
                        <p className="truncate text-[11px] text-[#6B6560]">
                          {story}
                        </p>
                      )}
                    </div>
                    {isCurrent && (
                      <span className="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        재생 중
                      </span>
                    )}
                    {q.played_at && !isCurrent && (
                      <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
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

      {/* LIVE 세션 전용 인터랙티브: 신청곡 모더레이션 + DJ 채팅 */}
      {liveSession && (
        <>
          <RequestModerationList
            sessionId={liveSession.id}
            initialPending={pendingRequests}
          />
          <DjChatPanel
            sessionId={liveSession.id}
            initialMessages={chatMessages}
          />
        </>
      )}
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
      ? "border-rose-200"
      : accent === "green"
        ? "border-[#D4E4BC]"
        : "border-zinc-200";
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-[#6B6560]">{title}</p>
      <ul className="space-y-2">
        {items.map((s) => (
          <li
            key={s.id}
            className={`rounded-2xl border bg-white p-3 shadow-sm ${borderCls}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#2D5A3D]">
                  {s.name}
                </p>
                <p className="text-[11px] text-[#6B6560]">
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
                  className="rounded-xl border border-[#2D5A3D] bg-white px-3 py-1.5 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
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
