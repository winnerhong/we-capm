// 참가자용 토리FM 전체화면 — 라이브 세션이 있으면 현재 곡/사연을 보여준다.
// Phase 2.E — Realtime 구독(LiveFmRefresher) 마운트로 LIVE 전환/곡 교체 즉시 반영.

import Link from "next/link";
import { requireAppUser } from "@/lib/user-auth-guard";
import { loadChildrenForUser } from "@/lib/app-user/queries";
import {
  loadLiveFmSessionForOrg,
  loadRadioQueueItemWithSubmission,
  loadFirstActiveOrgMissionByKind,
} from "@/lib/missions/queries";
import type { RadioSubmissionPayload } from "@/lib/missions/types";
import {
  loadOpenSessionRequests,
  loadTopSongs,
} from "@/lib/tori-fm/queries";
import { loadOrgFmBrandName } from "@/lib/tori-fm/branding";
import { loadOrgEventById } from "@/lib/org-events/queries";
import { LiveFmRefresher } from "./LiveFmRefresher";
import { MiniStage, type MiniStageNowPlaying } from "./MiniStage";
import { RequestsWithHearts } from "./RequestsWithHearts";
import { SubmitRequestDialog } from "./SubmitRequestDialog";
import { TodayRankingSummary } from "./TodayRankingSummary";

export const dynamic = "force-dynamic";

export default async function ToriFmPage() {
  const user = await requireAppUser();
  const [session, radioMission, brandName, children] = await Promise.all([
    loadLiveFmSessionForOrg(user.orgId),
    loadFirstActiveOrgMissionByKind(user.orgId, "RADIO"),
    loadOrgFmBrandName(user.orgId),
    loadChildrenForUser(user.id),
  ]);

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

  // 현재 재생 중 큐 — MiniStage 의 초기 SSR 데이터로 사용 (이후 클라가 자체 갱신)
  let initialNowPlaying: MiniStageNowPlaying | null = null;
  if (session?.current_queue_id) {
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
      };
    }
  }

  // 인터랙티브 레이어 — 세션이 있을 때만 데이터 병렬 로드.
  const sessionLive = !!session?.is_live;
  const sessionId = session?.id ?? "";

  // 행사 커버 이미지 — 라이브커머스 스타일 풀블리드 배경.
  const event = session?.event_id
    ? await loadOrgEventById(session.event_id)
    : null;
  const coverImageUrl = event?.cover_image_url ?? null;

  const [requests, topSongs, userHearted] = await Promise.all([
    session ? loadOpenSessionRequests(session.id) : Promise.resolve([]),
    session ? loadTopSongs(session.id, 5) : Promise.resolve([]),
    Promise.resolve([] as string[]),
  ]);
  // chatMessages — 더 이상 ChatPanel(드로어)이 없어 SSR 에서 받지 않음.
  // 라이브 채팅은 ScreenEffectsLayer 가 Realtime 으로 바로 받아 DriftUpChat 으로 노출.

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
        coverImageUrl={coverImageUrl}
      />

      {/* 사전예약 CTA — LIVE 아닐 때만 스탬프북 미션 연결.
          LIVE 일 때는 아래 SubmitRequestDialog 사용. */}
      {!sessionLive &&
        (radioMission ? (
          <div className="rounded-2xl border border-amber-300/30 bg-amber-100/10 p-4 backdrop-blur-sm">
            <Link
              href={`/missions/${radioMission.id}`}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 py-3 text-sm font-bold text-[#1B2B3A] shadow-md transition hover:bg-amber-300 active:scale-[0.99]"
            >
              ✏ 신청곡 & 사연 보내기
            </Link>
            <p className="mt-2 text-center text-[11px] text-[#6B6560]">
              승인되면 {brandName} 방송에서 들려드려요
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-300/30 bg-amber-100/10 p-4 text-center backdrop-blur-sm">
            <p className="text-sm font-semibold text-amber-700">
              🎵 아직 신청곡 미션이 열리지 않았어요
            </p>
            <p className="mt-1 text-[12px] text-[#6B6560]">
              기관에서 스탬프북에 토리FM 미션을 추가하면 신청할 수 있어요
            </p>
          </div>
        ))}

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
          />

          <TodayRankingSummary sessionId={session.id} />
        </>
      )}
    </div>
  );
}
