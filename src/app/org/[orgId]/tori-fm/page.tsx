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
import { CreateSessionForm } from "./CreateSessionForm";
import { FmSessionControls } from "./FmSessionControls";
import { StartBroadcastButton } from "./StartBroadcastButton";
import { LiveStudioConsole } from "./LiveStudioConsole";

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
        </nav>

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

      {/* Live 세션 — 통합 스튜디오 콘솔 (4-zone bento) */}
      {liveSession ? (
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
          {upcoming.length > 0 ? (
            <>
              <p className="mt-1 text-xs text-white/60">
                다음 예정 방송을 지금 바로 시작해보세요.
              </p>
              <div className="mt-4 flex flex-col items-center gap-2">
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
          ) : (
            <p className="mt-1 text-xs text-white/60">
              먼저 아래에서 방송 세션을 만들어주세요.
            </p>
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
        <CreateSessionForm orgId={orgId} />

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
