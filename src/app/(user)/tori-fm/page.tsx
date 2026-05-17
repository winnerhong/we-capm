// 참가자용 토리FM 전체화면 — 라이브 세션이 있으면 현재 곡/사연을 보여준다.
// Phase 2.E — Realtime 구독(LiveFmRefresher) 마운트로 LIVE 전환/곡 교체 즉시 반영.

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/user-auth-guard";
import { userHasAnyLiveEvent } from "@/lib/org-events/queries";
import {
  getAcornBalance,
  loadChildrenForUser,
  loadPrimaryClassByUserIds,
  loadTopAcornFamilies,
} from "@/lib/app-user/queries";
import { AcornTopBoard } from "@/components/acorn-top-board";
import { loadOrgNameById } from "@/lib/org-partner";
import {
  loadLiveFmSessionForOrg,
  loadFmSessionsByOrg,
  loadRadioQueueItemWithSubmission,
  loadFirstActiveOrgMissionByKind,
} from "@/lib/missions/queries";
import {
  RADIO_REWARD_DEFAULTS,
  type RadioSubmissionPayload,
} from "@/lib/missions/types";
import {
  loadChatMessages,
  loadOpenSessionRequests,
  loadPlayingGroup,
  loadQueuedRequests,
  loadTopHeartedRequests,
  loadTopSongs,
} from "@/lib/tori-fm/queries";
import {
  getCheerCountAction,
  getMyCheerSentCountAction,
} from "@/lib/tori-fm/actions";
import { anonLabelFromUserId } from "@/lib/tori-fm/types";
import { loadOrgFmBrandName } from "@/lib/tori-fm/branding";
import { LiveFmRefresher } from "./LiveFmRefresher";
import { MiniStage, type MiniStageNowPlaying } from "./MiniStage";
import { RequestsWithHearts } from "./RequestsWithHearts";
import { SubmitRequestDialog } from "./SubmitRequestDialog";
import { BroadcastQueueViewer } from "./BroadcastQueueViewer";

export const dynamic = "force-dynamic";

export default async function ToriFmPage() {
  const user = await requireAppUser();
  // 예정(DRAFT) 행사만 있는 참가자는 FM 차단.
  if (!(await userHasAnyLiveEvent(user.id))) redirect("/home");
  const [
    liveSession,
    allSessions,
    radioMission,
    brandName,
    children,
    acornBalance,
    topFamilies,
    freshOrgName,
  ] = await Promise.all([
    loadLiveFmSessionForOrg(user.orgId),
    loadFmSessionsByOrg(user.orgId),
    loadFirstActiveOrgMissionByKind(user.orgId, "RADIO"),
    loadOrgFmBrandName(user.orgId),
    loadChildrenForUser(user.id),
    getAcornBalance(user.id),
    loadTopAcornFamilies(user.orgId, 5),
    loadOrgNameById(user.orgId, user.orgName || "소속 기관"),
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
    queuedRequests,
  ] = await Promise.all([
    session ? loadChatMessages(session.id, 30) : Promise.resolve([]),
    session ? loadOpenSessionRequests(session.id) : Promise.resolve([]),
    session ? loadTopSongs(session.id, 5) : Promise.resolve([]),
    Promise.resolve([] as string[]),
    session ? loadPlayingGroup(session.id) : Promise.resolve([]),
    session ? loadTopHeartedRequests(session.id, 5) : Promise.resolve([]),
    session ? loadQueuedRequests(session.id) : Promise.resolve([]),
  ]);

  // 작성자(반) prefix 표시용 — 등장한 모든 user_id 에 대해 한 번에 반 이름 조회.
  // 신청곡 + 큐 + PLAYING 묶음 + 채팅 메시지 사용자까지 합쳐 1회만 조회.
  const authorUserIds = Array.from(
    new Set([
      ...requests.map((r) => r.user_id),
      ...queuedRequests.map((r) => r.user_id),
      ...playingGroup.map((r) => r.user_id),
    ])
  );
  const classByUser = await loadPrimaryClassByUserIds(authorUserIds);
  const classByUserObj: Record<string, string> = {};
  for (const [k, v] of classByUser) classByUserObj[k] = v;

  // PLAYING 곡이 있으면 — 본인 곡이면 받은 응원, 그 외엔 본인이 보낸 응원 카운트 prefetch.
  // MiniStage 의 초기 cheerCount 로 사용되어 깜빡임 방지.
  const playingHeadForCheer = playingGroup[0] ?? null;
  let initialCheerCount = 0;
  if (playingHeadForCheer) {
    initialCheerCount =
      playingHeadForCheer.user_id === user.id
        ? await getCheerCountAction(playingHeadForCheer.id)
        : await getMyCheerSentCountAction(playingHeadForCheer.id);
  }

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
      {/* 도토리 TOP 5 가족 — 최상단 노출 */}
      <AcornTopBoard
        families={topFamilies}
        myUserId={user.id}
        orgName={freshOrgName}
      />

      {/* Realtime 구독 — 라이브 상태/곡 변화 자동 반영 */}
      <LiveFmRefresher orgId={user.orgId} />

      {/* 헤더 */}
      <nav className="text-[11px] text-[#6B6560]">
        <Link href="/home" className="hover:underline">
          ← 홈으로
        </Link>
      </nav>

      {/* 미니 전광판 — 라이브커머스 스타일 풀블리드. middleSlot 으로 방송 대기 큐 노출. */}
      <MiniStage
        orgId={user.orgId}
        brandName={brandName}
        initialSession={session}
        initialNowPlaying={initialNowPlaying}
        initialChatMessages={chatMessages}
        currentUserId={user.id}
        initialCheerCount={initialCheerCount}
        middleSlot={
          session ? (
            <BroadcastQueueViewer
              sessionId={session.id}
              initialQueued={queuedRequests}
              myUserId={user.id}
              classByUser={classByUserObj}
            />
          ) : null
        }
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
            rewardSong={(() => {
              const cfg = (radioMission?.config_json ?? {}) as {
                reward_song?: number;
              };
              return typeof cfg.reward_song === "number"
                ? cfg.reward_song
                : RADIO_REWARD_DEFAULTS.song;
            })()}
            rewardStory={(() => {
              const cfg = (radioMission?.config_json ?? {}) as {
                reward_story?: number;
              };
              return typeof cfg.reward_story === "number"
                ? cfg.reward_story
                : RADIO_REWARD_DEFAULTS.story;
            })()}
          />

          <RequestsWithHearts
            sessionId={sessionId}
            initialRequests={requests}
            heartedIds={userHearted}
            theme="dark"
            showBoost
            acornBalance={acornBalance}
            classByUser={classByUserObj}
          />

        </>
      )}
    </div>
  );
}
