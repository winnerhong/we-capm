// server-only: "도토리 모으는 법" 안내를 이 행사 설정에서 만들어낸다.
//
// 안내문을 따로 적어두지 않는다 — buildAcornGuide 주석 참고. 여기서는 지금 켜져
// 있는 미션과 스위치를 읽어와 순수 함수에 넘기는 일만 한다.
//
// 조회를 직접 하지 않고 photo-feed-queries 의 캐시된 로더를 쓰는 이유:
//   같은 화면에 사진 카드와 이 안내가 함께 뜬다. 각자 행사·스탬프북·미션을 읽으면
//   한 화면에서 같은 조회가 두 벌씩 나간다(왕복 1회가 27ms 다). React cache 로
//   묶인 로더를 같이 쓰면 두 번째 호출은 공짜다.
//
// 실패 정책: throw 하지 않고 빈 배열. 안내가 없는 건 불편할 뿐이지만, 이걸로
// 리더보드나 행사홈이 통째로 안 뜨면 그게 사고다.

import "server-only";
import { buildAcornGuide, type AcornGuideItem } from "./acorn-guide-core";
import { LIKE_ACORN_CAP } from "./photo-feed-core";
import {
  isPhotoFeedEnabled,
  loadEventMissions,
  loadEventOrgId,
} from "./photo-feed-queries";

/**
 * 이 행사에서 도토리를 얻는 방법들 — 리더보드 카드 아래에 접어 둘 목록.
 */
export async function loadAcornGuide(
  eventId: string
): Promise<AcornGuideItem[]> {
  if (!eventId) return [];
  try {
    const [orgId, feedEnabled] = await Promise.all([
      loadEventOrgId(eventId),
      isPhotoFeedEnabled(eventId),
    ]);

    const missions = await loadEventMissions(eventId, orgId);

    // 최종 보상 문턱은 FINAL_REWARD 미션의 config 에 들어 있다.
    const finalCfg = missions.find((m) => m.kind === "FINAL_REWARD")
      ?.config_json as { tiers?: unknown } | undefined;
    const tiers = Array.isArray(finalCfg?.tiers)
      ? (finalCfg.tiers as Array<{ label?: string; threshold?: number }>)
      : [];

    return buildAcornGuide({
      missions,
      feedEnabled,
      likeAcornCap: LIKE_ACORN_CAP,
      tiers,
    });
  } catch (e) {
    console.error("[acorn-guide] threw", e);
    return [];
  }
}
