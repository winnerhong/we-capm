import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "./control-room.module.css";
import { HeaderBar } from "./widgets/header-bar";
import { ParticipantsTile } from "./widgets/participants-tile";
import { FmTile } from "./widgets/fm-tile";
import { ChatTile } from "./widgets/chat-tile";
import { PendingTile } from "./widgets/pending-tile";
import { StampsTile } from "./widgets/stamps-tile";
import { AcornsTile } from "./widgets/acorns-tile";
import { ActivityFeedTile } from "./widgets/activity-feed-tile";
import { LeaderboardTile } from "./widgets/leaderboard-tile";
import { BroadcastTile } from "./widgets/broadcast-tile";
import { HeatmapTile } from "./widgets/heatmap-tile";

type Props = {
  snapshot: ControlRoomSnapshot;
  orgId: string;
  isTvMode: boolean;
};

export function ControlRoomGrid({ snapshot, orgId, isTvMode }: Props) {
  return (
    <div
      className={`${styles.bg} ${isTvMode ? styles.tvScale : ""}`}
      data-tv={isTvMode ? "1" : "0"}
    >
      <div
        className={`mx-auto flex flex-col ${
          isTvMode
            ? "max-w-[3840px] gap-[1.25em] p-[1.25em]"
            : "max-w-[1600px] gap-4 p-4 md:p-6"
        }`}
      >
        {/* row 1: Header */}
        <HeaderBar snapshot={snapshot} orgId={orgId} isTvMode={isTvMode} />

        {/* row 2: 4 tiles — 모바일 1열, md 2열, xl 4열 */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 ${
            isTvMode ? "gap-[1.25em]" : "gap-4"
          }`}
        >
          <ParticipantsTile snapshot={snapshot} orgId={orgId} />
          <StampsTile stamps={snapshot.stamps} isTvMode={isTvMode} />
          <AcornsTile acorns={snapshot.acorns} isTvMode={isTvMode} />
          <FmTile snapshot={snapshot} />
        </div>

        {/* row 3: Activity Feed + Leaderboard — 모바일 1열, md 이상 2열 */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 ${
            isTvMode ? "gap-[1.25em]" : "gap-4"
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

        {/* row 4: Chat + Pending — 모바일 1열, md 이상 2열 */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 ${
            isTvMode ? "gap-[1.25em]" : "gap-4"
          }`}
        >
          <ChatTile snapshot={snapshot} isTvMode={isTvMode} />
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
      </div>
    </div>
  );
}
