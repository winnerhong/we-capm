// 참가자용 토리FM 전체화면 — 라이브 세션이 있으면 현재 곡/사연을 보여준다.
// Phase 2.E — Realtime 구독(LiveFmRefresher) 마운트로 LIVE 전환/곡 교체 즉시 반영.

import Link from "next/link";
import { requireAppUser } from "@/lib/user-auth-guard";
import { loadChildrenForUser } from "@/lib/app-user/queries";
import {
  loadLiveFmSessionForOrg,
  loadFmSessionsByOrg,
  loadRadioQueueItemWithSubmission,
  loadFirstActiveOrgMissionByKind,
} from "@/lib/missions/queries";
import type { RadioSubmissionPayload } from "@/lib/missions/types";
import {
  loadChatMessages,
  loadOpenSessionRequests,
  loadPlayingGroup,
  loadTopHeartedRequests,
  loadTopSongs,
} from "@/lib/tori-fm/queries";
import { anonLabelFromUserId } from "@/lib/tori-fm/types";
import { loadOrgFmBrandName } from "@/lib/tori-fm/branding";
import { LiveFmRefresher } from "./LiveFmRefresher";
import { MiniStage, type MiniStageNowPlaying } from "./MiniStage";
import { RequestsWithHearts } from "./RequestsWithHearts";
import { SubmitRequestDialog } from "./SubmitRequestDialog";
import { TodayRankingSummary } from "./TodayRankingSummary";

export const dynamic = "force-dynamic";

export default async function ToriFmPage() {
  const user = await requireAppUser();
  const [liveSession, allSessions, radioMission, brandName, children] =
    await Promise.all([
      loadLiveFmSessionForOrg(user.orgId),
      loadFmSessionsByOrg(user.orgId),
      loadFirstActiveOrgMissionByKind(user.orgId, "RADIO"),
      loadOrgFmBrandName(user.orgId),
      loadChildrenForUser(user.id),
    ]);

  // session 결정 — LIVE 우선, 없으면 가장 최근 만들어진 세션을 fallback 으로 사용.
  // OFF 상태에서도 신청곡·사연 다이얼로그가 동작하려면 sessionId 가 필요함.
  // (호스트가 LIVE 시작 시 새 세션을 만드는 운영 패턴이라, 가장 최근 세션은
  //  사연 보관함 역할을 함.)
  const session = liveSession ?? allSessions[0] ?? null;

  // 신청곡 child_name 자동 표시값 — "OOO 가족" 형태.
  // 등록 자녀가 있으면 자녀 이름들을 "·" 로 합쳐 "{이름들} 가족",
  // 없으면 "{보호자이름} 가족", 그것도 없으면 빈 문자열.
  const enrolledChildren = children.filter((c) => c.is_enrolled);
  const familyLabel =
    enrolledChildren.length > 0
      ? `${enrolledChildren.map((c) => c.name).join("·")} 가족`
      : user.parentName
        ? `${user.parentName} 가족`
        : "";

  // 인터랙티브 레이어 — 세션이 있을 때만 데이터 병렬 로드.
  const sessionLive = !!session?.is_live;
  const sessionId = session?.id ?? "";

  const [
    chatMessages,
    requests,
    topSongs,
    userHearted,
    playingGroup,
    topHearted,
  ] = await Promise.all([
    session ? loadChatMessages(session.id, 30) : Promise.resolve([]),
    session ? loadOpenSessionRequests(session.id) : Promise.resolve([]),
    session ? loadTopSongs(session.id, 5) : Promise.resolve([]),
    Promise.resolve([] as string[]),
    session ? loadPlayingGroup(session.id) : Promise.resolve([]),
    session ? loadTopHeartedRequests(session.id, 5) : Promise.resolve([]),
  ]);

  // 현재 재생 중 — PLAYING 묶음(같은 song_normalized) 우선, 없으면 current_queue_id 기반.
  // playingGroup 의 첫 row 가 head — 곡명/아티스트/kind 의 기준이 됨.
  // storyItems 는 묶음 N건 전체를 created_at ASC 로 매핑(작성자 라벨은 anon/실명 분기).
  const playingHead = playingGroup[0] ?? null;
  let initialNowPlaying: MiniStageNowPlaying | null = null;
  if (playingHead) {
    const storyItems = playingGroup.map((r) => ({
      id: r.id,
      story: r.story,
      authorLabel: r.is_anonymous
        ? anonLabelFromUserId(r.user_id)
        : (r.child_name?.trim() ?? ""),
      createdAt: r.created_at,
    }));
    initialNowPlaying = {
      song: playingHead.song_title ?? "(사연만)",
      artist: playingHead.artist ?? "",
      story: playingHead.story ?? "",
      childName: playingHead.is_anonymous
        ? anonLabelFromUserId(playingHead.user_id)
        : (playingHead.child_name ?? ""),
      kind: playingHead.kind,
      isAnonymous: playingHead.is_anonymous,
      storyItems,
    };
  } else if (session?.current_queue_id) {
    const item = await loadRadioQueueItemWithSubmission(
      session.current_queue_id
    );
    if (item) {
      const p = item.submission.payload_json as Partial<RadioSubmissionPayload>;
      initialNowPlaying = {
        song: typeof p.song_title === "string" ? p.song_title : "",
        artist: typeof p.artist === "string" ? p.artist : "",
        story: typeof p.story_text === "string" ? p.story_text : "",
        childName: typeof p.child_name === "string" ? p.child_name : "",
        kind: "song_request",
        isAnonymous: false,
        storyItems: [],
      };
    }
  }

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

      {/* 미니 전광판 — 라이브커머스 스타일 풀블리드 (행사 커버 + VFX + 드리프트 채팅 + 입력바) */}
      <MiniStage
        orgId={user.orgId}
        brandName={brandName}
        initialSession={session}
        initialNowPlaying={initialNowPlaying}
        initialChatMessages={chatMessages}
        currentUserId={user.id}
      />

      {/* 라디오 미션이 별도 활성화돼 있으면 부가 진입점 표시 (선택 경로).
          LIVE/OFF 무관하게 SubmitRequestDialog 가 항상 노출되므로 이건 보조. */}
      {!sessionLive && radioMission && (
        <div className="rounded-2xl border border-amber-300/30 bg-amber-100/10 p-3 text-center backdrop-blur-sm">
          <Link
            href={`/missions/${radioMission.id}`}
            className="text-[12px] font-semibold text-amber-700 underline"
          >
            🎯 스탬프북 미션으로도 신청할 수 있어요 →
          </Link>
        </div>
      )}

      {/* 인터랙티브 레이어 — 세션이 있을 때만.
          ReactionBar 는 MiniStage 안에 임베드돼 있어 여기서 별도 렌더 안 함. */}
      {session && (
        <>
          <SubmitRequestDialog
            sessionId={sessionId}
            isLive={sessionLive}
            trendingSongs={trendingSongs}
            familyLabel={familyLabel}
          />

          <RequestsWithHearts
            sessionId={sessionId}
            initialRequests={requests}
            heartedIds={userHearted}
            theme="dark"
          />

          {/* 오늘의 인기 신청곡 TOP — 하트 많은 순 (song_request 만, 최대 5) */}
          {(() => {
            const topSongsHearted = topHearted
              .filter((r) => r.kind === "song_request")
              .slice(0, 5);
            if (topSongsHearted.length === 0) return null;
            return (
              <section
                aria-label="오늘의 인기 신청곡 TOP"
                className="rounded-3xl border-l-[5px] border-l-amber-300/50 border-y border-y-white/10 border-r border-r-white/10 bg-[#101935] p-4 shadow-xl shadow-amber-500/10 md:p-5"
              >
                <header className="mb-3 flex items-center gap-2">
                  <span className="text-xl" aria-hidden>
                    🎵
                  </span>
                  <h2 className="text-sm font-extrabold text-amber-100">
                    오늘의 인기 신청곡 TOP {topSongsHearted.length}
                  </h2>
                </header>
                <ol className="space-y-1.5">
                  {topSongsHearted.map((r, idx) => {
                    const medal =
                      idx === 0
                        ? "🥇"
                        : idx === 1
                          ? "🥈"
                          : idx === 2
                            ? "🥉"
                            : null;
                    return (
                      <li
                        key={r.id}
                        className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2"
                      >
                        <span
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center text-base"
                          aria-label={`${idx + 1}위`}
                        >
                          {medal ? (
                            medal
                          ) : (
                            <span className="text-[11px] font-bold text-white/70">
                              {idx + 1}
                            </span>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white/95">
                            🎵 {r.song_title?.trim() || "(사연만)"}
                          </p>
                          {r.artist && (
                            <p className="truncate text-[11px] text-amber-200/80">
                              — {r.artist}
                            </p>
                          )}
                        </div>
                        <span className="flex-shrink-0 rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-200 ring-1 ring-rose-400/40">
                          ❤ {r.heart_count}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })()}

          {/* 오늘의 인기 사연 TOP — 하트 많은 순 (story_only 만, 최대 5).
              warm 톤(보라/오렌지) — 음악 카드와 시각적으로 분리. */}
          {(() => {
            const topStoriesHearted = topHearted
              .filter((r) => r.kind === "story_only")
              .slice(0, 5);
            if (topStoriesHearted.length === 0) return null;
            return (
              <section
                aria-label="오늘의 인기 사연 TOP"
                className="rounded-3xl border-l-[5px] border-l-violet-300/50 border-y border-y-white/10 border-r border-r-white/10 bg-[#1a1638] p-4 shadow-xl shadow-violet-500/15 md:p-5"
              >
                <header className="mb-3 flex items-center gap-2">
                  <span className="text-xl" aria-hidden>
                    💌
                  </span>
                  <h2 className="text-sm font-extrabold text-violet-100">
                    오늘의 인기 사연 TOP {topStoriesHearted.length}
                  </h2>
                </header>
                <ol className="space-y-1.5">
                  {topStoriesHearted.map((r, idx) => {
                    const medal =
                      idx === 0
                        ? "🥇"
                        : idx === 1
                          ? "🥈"
                          : idx === 2
                            ? "🥉"
                            : null;
                    return (
                      <li
                        key={r.id}
                        className="flex items-start gap-2 rounded-2xl border border-violet-300/20 bg-white/[0.04] px-3 py-2.5"
                      >
                        <span
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center text-base"
                          aria-label={`${idx + 1}위`}
                        >
                          {medal ? (
                            medal
                          ) : (
                            <span className="text-[11px] font-bold text-violet-200/80">
                              {idx + 1}
                            </span>
                          )}
                        </span>
                        <blockquote className="min-w-0 flex-1 border-l-2 border-amber-300/40 pl-2.5 text-[12px] leading-relaxed text-white/90 line-clamp-2">
                          {r.story?.trim() ? (
                            <>&ldquo;{r.story}&rdquo;</>
                          ) : (
                            <span className="text-white/55">(사연 없음)</span>
                          )}
                        </blockquote>
                        <span className="flex-shrink-0 rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-200 ring-1 ring-rose-400/40">
                          ❤ {r.heart_count}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })()}

          <TodayRankingSummary sessionId={session.id} />
        </>
      )}
    </div>
  );
}
