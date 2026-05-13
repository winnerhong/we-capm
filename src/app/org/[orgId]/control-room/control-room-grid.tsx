import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "./control-room.module.css";
import { HeaderBar } from "./widgets/header-bar";
import { ParticipantsTile } from "./widgets/participants-tile";
// FmTile · ChatTile 제거됨 — 토리FM 라이브 스튜디오가 페이지 하단에
// 풀콘솔로 임베드되어 FM 세션·신청곡·채팅 모두 거기서 보임.
import { PendingTile } from "./widgets/pending-tile";
import { StampsTile } from "./widgets/stamps-tile";
import { AcornsTile } from "./widgets/acorns-tile";
import { ActivityFeedTile } from "./widgets/activity-feed-tile";
import { LeaderboardTile } from "./widgets/leaderboard-tile";
import { BroadcastTile } from "./widgets/broadcast-tile";
import { HeatmapTile } from "./widgets/heatmap-tile";
import { PhotoWallTile } from "./widgets/photo-wall-tile";
import { MissionProgressTile } from "./widgets/mission-progress-tile";
import { FamilyGridTile } from "./widgets/family-grid-tile";
import { LiveAttemptsTile } from "./widgets/live-attempts-tile";
import { FmStudioEmbed } from "./widgets/fm-studio-embed";

type Props = {
  snapshot: ControlRoomSnapshot;
  orgId: string;
  isTvMode: boolean;
};

// ControlRoomGrid 는 async — FmStudioEmbed (server component) 가 LIVE 세션
// 데이터를 직접 로드한다.
export async function ControlRoomGrid({ snapshot, orgId, isTvMode }: Props) {
  return (
    <div
      className={`${styles.bg} ${isTvMode ? styles.tvScale : ""}`}
      data-tv={isTvMode ? "1" : "0"}
    >
      <div
        className={`mx-auto flex flex-col ${
          isTvMode
            ? "max-w-[3840px] gap-[1.25em] p-[1.25em]"
            : "max-w-[1600px] gap-2.5 p-3 md:gap-3 md:p-4"
        }`}
      >
        {/* row 1: Header */}
        <HeaderBar snapshot={snapshot} orgId={orgId} isTvMode={isTvMode} />

        {/* row 2: 3 stats tiles — 모바일 1열, md 이상 3열 */}
        <div
          className={`grid grid-cols-1 md:grid-cols-3 ${
            isTvMode ? "gap-[1.25em]" : "gap-3"
          }`}
        >
          <ParticipantsTile snapshot={snapshot} orgId={orgId} />
          <StampsTile stamps={snapshot.stamps} isTvMode={isTvMode} />
          <AcornsTile acorns={snapshot.acorns} isTvMode={isTvMode} />
        </div>

        {/* row 2.3: Phase 2 — 🔴 라이브 수행 (정체 가족 강조) */}
        <div className="grid grid-cols-1">
          <LiveAttemptsTile live={snapshot.live} isTvMode={isTvMode} />
        </div>

        {/* row 2.5: Phase 1 관제 — 🎯 미션별 진행률 + 📸 사진 월 */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 ${
            isTvMode ? "gap-[1.25em]" : "gap-3"
          }`}
        >
          <MissionProgressTile
            items={snapshot.missionProgress}
            isTvMode={isTvMode}
          />
          <PhotoWallTile items={snapshot.photoWall} isTvMode={isTvMode} />
        </div>

        {/* row 2.7: Phase 1 관제 — 👥 가족 × 미션 매트릭스 (가로 풀폭) */}
        <div className="grid grid-cols-1">
          <FamilyGridTile
            grid={snapshot.familyGrid}
            photos={snapshot.photoWall}
            isTvMode={isTvMode}
          />
        </div>

        {/* row 3: Activity Feed + Leaderboard — 모바일 1열, md 이상 2열 */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 ${
            isTvMode ? "gap-[1.25em]" : "gap-3"
          }`}
        >
          <ActivityFeedTile
            items={snapshot.activityFeed}
            isTvMode={isTvMode}
          />
          <LeaderboardTile
            items={snapshot.leaderboard}
            isTvMode={isTvMode}
          />
        </div>

        {/* row 4: Pending — 채팅은 FM 임베드와 중복이라 제거. Pending 만 풀폭. */}
        <div className="grid grid-cols-1">
          <PendingTile snapshot={snapshot} />
        </div>

        {/* row 5: Broadcast(12, fullwidth) — 핑크 네온 액션 강조 */}
        <div className="grid grid-cols-1">
          <BroadcastTile
            broadcast={snapshot.broadcast}
            orgId={orgId}
            isTvMode={isTvMode}
          />
        </div>

        {/* row 6: Heatmap(12, fullwidth) — 24h 시간대별 활동량 */}
        <div className="grid grid-cols-1">
          <HeatmapTile heatmap={snapshot.heatmap} isTvMode={isTvMode} />
        </div>

        {/* row 7: 토리FM 라이브 스튜디오 — 관제실과 같은 네이비 바탕 위에
            바로 이어지도록 페이지 안으로 통합. 별도 헤더/풀스크린 버튼 없음. */}
        <FmStudioEmbed orgId={orgId} />
      </div>
    </div>
  );
}
