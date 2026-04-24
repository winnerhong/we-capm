// 참가자용 토리FM 전체화면 — 라이브 세션이 있으면 현재 곡/사연을 보여준다.
// Phase 2.E — Realtime 구독(LiveFmRefresher) 마운트로 LIVE 전환/곡 교체 즉시 반영.

import Link from "next/link";
import { requireAppUser } from "@/lib/user-auth-guard";
import {
  loadLiveFmSessionForOrg,
  loadRadioQueueItemWithSubmission,
  loadFirstActiveOrgMissionByKind,
} from "@/lib/missions/queries";
import type { RadioSubmissionPayload } from "@/lib/missions/types";
import {
  loadActivePoll,
  loadChatMessages,
  loadOpenSessionRequests,
  loadTopSongs,
} from "@/lib/tori-fm/queries";
import { LiveFmRefresher } from "./LiveFmRefresher";
import { ChatPanel } from "./ChatPanel";
import { PollCard } from "./PollCard";
import { ReactionBar } from "./ReactionBar";
import { RequestsWithHearts } from "./RequestsWithHearts";
import { SubmitRequestDialog } from "./SubmitRequestDialog";
import { TodayRankingSummary } from "./TodayRankingSummary";

export const dynamic = "force-dynamic";

function formatTimeRange(start: string, end: string): string {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const fmt = (d: Date) =>
      d.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    return `${fmt(s)} ~ ${fmt(e)}`;
  } catch {
    return "";
  }
}

export default async function ToriFmPage() {
  const user = await requireAppUser();
  const session = await loadLiveFmSessionForOrg(user.orgId);
  const radioMission = await loadFirstActiveOrgMissionByKind(
    user.orgId,
    "RADIO"
  );

  // 현재 재생 중 큐
  let song: string | null = null;
  let artist: string | null = null;
  let story: string | null = null;
  let childName: string | null = null;
  if (session?.current_queue_id) {
    const item = await loadRadioQueueItemWithSubmission(
      session.current_queue_id
    );
    if (item) {
      const p = item.submission.payload_json as Partial<RadioSubmissionPayload>;
      song = typeof p.song_title === "string" ? p.song_title : null;
      artist = typeof p.artist === "string" ? p.artist : null;
      story = typeof p.story_text === "string" ? p.story_text : null;
      childName = typeof p.child_name === "string" ? p.child_name : null;
    }
  }

  // 인터랙티브 레이어 — 세션이 있을 때만 데이터 병렬 로드.
  const sessionLive = !!session?.is_live;
  const sessionId = session?.id ?? "";

  const [
    chatMessages,
    requests,
    activePoll,
    topSongs,
    userHearted,
    userVote,
  ] = await Promise.all([
    session ? loadChatMessages(session.id, 50) : Promise.resolve([]),
    session ? loadOpenSessionRequests(session.id) : Promise.resolve([]),
    session ? loadActivePoll(session.id) : Promise.resolve(null),
    session ? loadTopSongs(session.id, 5) : Promise.resolve([]),
    Promise.resolve([] as string[]),
    Promise.resolve(null as string | null),
  ]);

  const trendingSongs = topSongs.map((s) => ({
    song_title: s.song_title,
    artist: s.artist ?? "",
  }));

  return (
    <div className="space-y-4">
      {/* Realtime 구독 — 라이브 상태/곡 변화 자동 반영 */}
      <LiveFmRefresher orgId={user.orgId} />

      {/* 헤더 */}
      <nav className="text-[11px] text-[#6B6560]">
        <Link href="/home" className="hover:underline">
          ← 홈으로
        </Link>
      </nav>

      {/* 메인 라디오 카드 */}
      <section className="overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-[#1B2B3A] via-[#26394C] to-[#1B2B3A] p-6 text-white shadow-xl">
        {/* ON AIR */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {session?.is_live ? (
              <>
                <span className="relative inline-flex h-3 w-3" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
                </span>
                <p className="text-[11px] font-bold uppercase tracking-widest text-rose-300">
                  ON AIR
                </p>
              </>
            ) : (
              <>
                <span
                  className="inline-flex h-3 w-3 rounded-full bg-zinc-500"
                  aria-hidden
                />
                <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">
                  OFF AIR
                </p>
              </>
            )}
          </div>
          {session && (
            <p className="text-[10px] font-semibold text-amber-200/80">
              {formatTimeRange(
                session.scheduled_start,
                session.scheduled_end
              )}
            </p>
          )}
        </div>

        {/* 로고 / 제목 */}
        <div className="mt-6 text-center">
          <p className="text-5xl" aria-hidden>
            📻
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-wide text-white">
            토리FM
          </h1>
          <p className="mt-1 text-sm text-amber-200/80">숲 속 라디오</p>
        </div>

        {/* 현재 곡 카드 */}
        {session?.is_live ? (
          song ? (
            <div className="mt-6 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/80">
                ♪ 지금 재생 중
              </p>
              <p className="mt-1 text-lg font-bold text-white">
                {song}
                {artist && (
                  <span className="ml-1 text-sm font-normal text-white/70">
                    — {artist}
                  </span>
                )}
              </p>
              {story && (
                <blockquote className="mt-3 border-l-2 border-amber-300/50 pl-3 text-sm leading-relaxed text-white/85">
                  “{story}”
                </blockquote>
              )}
              {childName && (
                <p className="mt-2 text-right text-[12px] font-semibold text-amber-200/80">
                  — {childName}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-white/10 p-4 text-center backdrop-blur-sm">
              <p className="text-sm text-white/80">
                방송은 시작됐어요. 잠시 후 신청곡이 흘러나와요
              </p>
            </div>
          )
        ) : (
          <div className="mt-6 rounded-2xl bg-white/10 p-4 text-center backdrop-blur-sm">
            <p className="text-sm font-semibold text-white/90">
              아직 방송 시작 전이에요
            </p>
            <p className="mt-1 text-[12px] text-white/60">
              정규 방송 시간에 다시 찾아와 주세요
            </p>
          </div>
        )}

        {/* CTA — LIVE 아닐 때만 스탬프북 미션 연결(사전 예약형). LIVE 일 때는 아래 SubmitRequestDialog 사용. */}
        {!sessionLive &&
          (radioMission ? (
            <>
              <Link
                href={`/missions/${radioMission.id}`}
                className="mt-6 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 py-3 text-sm font-bold text-[#1B2B3A] shadow-md transition hover:bg-amber-300 active:scale-[0.99]"
              >
                ✏ 신청곡 & 사연 보내기
              </Link>
              <p className="mt-2 text-center text-[11px] text-white/50">
                승인되면 토리FM 방송에서 들려드려요
              </p>
            </>
          ) : (
            <div className="mt-6 rounded-2xl border border-amber-300/30 bg-amber-100/10 p-4 text-center backdrop-blur-sm">
              <p className="text-sm font-semibold text-amber-200">
                🎵 아직 신청곡 미션이 열리지 않았어요
              </p>
              <p className="mt-1 text-[12px] text-white/60">
                기관에서 스탬프북에 토리FM 미션을 추가하면 신청할 수 있어요
              </p>
            </div>
          ))}
      </section>

      {/* 인터랙티브 레이어 — 세션이 있을 때만 */}
      {session && (
        <>
          <ReactionBar sessionId={sessionId} isLive={sessionLive} />

          {activePoll && (
            <PollCard
              initialPoll={activePoll}
              userVote={userVote}
              sessionId={sessionId}
            />
          )}

          <SubmitRequestDialog
            sessionId={sessionId}
            isLive={sessionLive}
            trendingSongs={trendingSongs}
          />

          <RequestsWithHearts
            sessionId={sessionId}
            initialRequests={requests}
            heartedIds={userHearted}
          />

          <TodayRankingSummary sessionId={session.id} />

          <ChatPanel
            sessionId={sessionId}
            initialMessages={chatMessages}
            userLabel={user.parentName || "익명"}
            isUserLoggedIn={true}
          />
        </>
      )}
    </div>
  );
}
