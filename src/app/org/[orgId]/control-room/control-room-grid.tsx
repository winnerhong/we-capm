import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "./control-room.module.css";
import { HeaderBar } from "./widgets/header-bar";
import { ParticipantsTile } from "./widgets/participants-tile";
// FmTile · ChatTile · PendingTile · MissionProgressTile · LeaderboardTile 제거됨.
//  - 토리FM 라이브 스튜디오가 페이지 하단 풀콘솔로 임베드 → FM/채팅 중복 회피
//  - 검토 대기는 사진월/짝꿍 세션의 인라인 검수 모달로 흡수
//  - 미션별 진행률은 가족 매트릭스 우측 평시 사이드/미션 헤더 hover 로 노출
//  - 순위 TOP 10 은 가족 매트릭스 각 행 prefix 의 🥇🥈🥉/숫자 배지로 흡수
import { StampsTile } from "./widgets/stamps-tile";
import { AcornsTile } from "./widgets/acorns-tile";
import { HeatmapTile } from "./widgets/heatmap-tile";
import { PhotoWallTile } from "./widgets/photo-wall-tile";
import { FamilyGridTile } from "./widgets/family-grid-tile";
import { LiveAttemptsTile } from "./widgets/live-attempts-tile";
import { CoopSessionsTile } from "./widgets/coop-sessions-tile";
import { PhotoCoopRow } from "./widgets/photo-coop-row";
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

        {/* row 2.5: 👥 가족 × 미션 매트릭스 (가로 풀폭) — 포토월/짝꿍세션보다 위 */}
        <div className="grid grid-cols-1">
          <FamilyGridTile
            grid={snapshot.familyGrid}
            photos={snapshot.photoWall}
            missionProgress={snapshot.missionProgress}
            isTvMode={isTvMode}
          />
        </div>

        {/* row 2.7: 📸 가족 사진 월 + 👫 짝꿍 세션 — 가로 반반.
            짝꿍 자연 height 를 ResizeObserver 로 측정 → 포토월 wrapper 에 cap.
            결과: 포토월은 짝꿍 "다음" 페이지네이션까지의 높이 안에서 내부 스크롤. */}
        <PhotoCoopRow
          isTvMode={isTvMode}
          photoWall={
            <PhotoWallTile items={snapshot.photoWall} isTvMode={isTvMode} />
          }
          coopSessions={
            <CoopSessionsTile
              items={snapshot.coopSessions}
              isTvMode={isTvMode}
            />
          }
        />

        {/* row 3 제거됨 — 순위는 가족 매트릭스 각 행 prefix 의 🥇🥈🥉/숫자 배지로 흡수.
            미션별 진행률은 가족 매트릭스 우측 평시 사이드/미션 헤더 hover 로 노출. */}

        {/* row 6: Heatmap(12, fullwidth) — 24h 시간대별 활동량
            (돌발 미션 BroadcastTile 은 헤더 우측 작은 버튼으로 이동) */}
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
