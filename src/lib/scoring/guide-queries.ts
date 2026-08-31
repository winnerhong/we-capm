// server-only: 기관 상단 배점표에 그릴 것.
//
// 상단 nav 는 행사에 매여 있지 않다(기관 화면 전부가 지나간다). 그래서 「지금
// 행사」를 여기서 고른다 — 진행중 > 예정(가까운 것) > 최근 종료 순이다.
// 행사 상태 순서는 앱 전체가 쓰는 예정→진행→종료→보관 과 같은 어휘를 쓴다.
//
// 실패 정책: throw 하지 않는다. 배점표가 안 뜨는 건 불편하지만, 이것 때문에 기관
// 포털의 상단 nav 가 통째로 죽으면 그게 사고다.

import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { buildAcornGuide } from "@/lib/missions/acorn-guide-core";
import { LIKE_ACORN_CAP } from "@/lib/missions/photo-feed-core";
import { buildScoreRules, type AcornScoreGuide } from "./guide-core";

// 화면도 쓰는 정의는 guide-core.ts(순수)가 갖는다. 여기서 다시 내보내 두면
// 부르는 쪽이 "어느 파일에서 가져오지"를 고민하지 않아도 된다.
export type { AcornScoreGuide } from "./guide-core";

const EMPTY: AcornScoreGuide = {
  eventName: null,
  eventStatus: null,
  earn: [],
  rules: buildScoreRules([]),
};

type EventRow = {
  id: string;
  name: string | null;
  status: string;
  starts_at: string | null;
};

type MissionRow = {
  kind: string;
  acorns: number | null;
  quest_pack_id: string | null;
  is_active: boolean | null;
  config_json: Record<string, unknown> | null;
};

/** 진행중 > 예정(가까운 것) > 최근 종료. 없으면 null. */
function pickCurrent(rows: EventRow[]): EventRow | null {
  if (rows.length === 0) return null;
  const live = rows.filter((r) => r.status === "LIVE");
  if (live.length > 0) return live[0];

  const draft = rows
    .filter((r) => r.status === "DRAFT")
    .sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? ""));
  if (draft.length > 0) return draft[0];

  const ended = rows
    .filter((r) => r.status === "ENDED")
    .sort((a, b) => (b.starts_at ?? "").localeCompare(a.starts_at ?? ""));
  return ended[0] ?? rows[0];
}

/**
 * 기관 상단 배점표.
 *
 * 상단 nav 는 기관 화면 **전부**가 지나므로 요청당 한 번만 읽는다.
 */
export const loadOrgAcornGuide = cache(async function loadOrgAcornGuide(
  orgId: string
): Promise<AcornScoreGuide> {
  if (!orgId) return EMPTY;

  try {
    const supabase = await createClient();

    // 행사와 미션은 서로를 필요로 하지 않는다. 예전엔 행사를 먼저 기다린 뒤
    // 미션을 읽었는데, 이 로더는 레이아웃에 있어서 기관 화면 **전부**가 그
    // 두 왕복을 줄 세워 기다렸다. 계측하면 홈에서만 300ms 였다.
    const evP = (
      supabase.from("org_events" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => Promise<{
            data: EventRow[] | null;
            error: unknown;
          }>;
        };
      }
    )
      .select("id, name, status, starts_at")
      .eq("org_id", orgId) as Promise<{
      data: EventRow[] | null;
      error: unknown;
    }>;

    // 미션은 기관 단위로 읽는다. 행사↔스탬프북↔미션을 타고 들어가면 왕복이
    // 세 번인데, 배점표에 필요한 건 "이 기관이 켜 둔 미션의 종류와 도토리" 뿐이다.
    const mP = (
      supabase.from("org_missions" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => Promise<{
            data: MissionRow[] | null;
            error: unknown;
          }>;
        };
      }
    )
      .select("kind, acorns, quest_pack_id, is_active, config_json")
      .eq("org_id", orgId) as Promise<{
      data: MissionRow[] | null;
      error: unknown;
    }>;

    const [evResp, mResp] = await Promise.all([evP, mP]);

    const current = pickCurrent(evResp.data ?? []);
    const missions = (mResp.data ?? []).filter((m) => m.is_active !== false);

    // 최종 보상 문턱 — 있으면 "얼마 모으면 무엇" 이 마지막 줄에 붙는다.
    const finalCfg = missions.find((m) => m.kind === "FINAL_REWARD")
      ?.config_json as { tiers?: unknown } | undefined;
    const tiers = Array.isArray(finalCfg?.tiers)
      ? (finalCfg.tiers as Array<{ label?: string; threshold?: number }>)
      : [];

    return {
      eventName: current?.name?.trim() || null,
      eventStatus: current?.status ?? null,
      earn: buildAcornGuide({
        missions,
        // 좋아요 도토리는 행사별 스위치라 기관 단위에서는 단정할 수 없다.
        // 확실하지 않은 줄은 적지 않는다 — 틀린 안내가 없는 안내보다 나쁘다.
        feedEnabled: false,
        likeAcornCap: LIKE_ACORN_CAP,
        tiers,
      }),
      rules: buildScoreRules(missions.map((m) => m.kind)),
    };
  } catch (e) {
    console.error("[scoring/guide] threw", e);
    return EMPTY;
  }
});
