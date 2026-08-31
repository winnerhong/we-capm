// server-only: 행사 점수 랭킹 읽기.
//
// 원장(user_score_events)이 아직 없으면 **빈 결과**를 돌려준다. 부르는 쪽은 그때
// 예전대로 도토리 합계로 줄을 세운다 — 마이그레이션 20260902000000 을 적용하기
// 전에도 랭킹 화면이 비지 않아야 한다.

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { reportQueryFailure } from "@/lib/supabase/schema-gap";

const MIGRATION = "20260902000000_score_ledger.sql";

export type ScoreRankRow = {
  userId: string;
  totalPoints: number;
  /** 마지막으로 점수를 얻은 시각 — 동점일 때 먼저 도달한 집이 앞이다. */
  lastScoredAt: string | null;
};

type RpcRow = {
  user_id: string;
  total_points: number | string;
  last_scored_at: string | null;
};

/**
 * 행사 하나의 점수 랭킹.
 *
 * 순서·동점 처리는 DB 함수 event_score_ranking 이 정한다(집계와 정렬을 JS 로
 * 끌고 오면 참가자가 늘수록 전부 받아와야 한다).
 *
 * @returns 점수 원장이 없거나 실패하면 빈 배열
 */
export async function loadEventScoreRanking(
  eventId: string,
  limit = 5
): Promise<ScoreRankRow[]> {
  if (!eventId) return [];
  const n = Math.max(1, Math.min(50, Math.floor(limit) || 5));

  try {
    const supabase = await createClient();
    const { data, error } = await (
      supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, string>
        ) => Promise<{ data: RpcRow[] | null; error: unknown }>;
      }
    ).rpc("event_score_ranking", { p_event_id: eventId });

    if (error || !data) {
      reportQueryFailure("event_score_ranking", MIGRATION, error);
      return [];
    }

    return data.slice(0, n).map((r) => ({
      userId: r.user_id,
      totalPoints: Number(r.total_points) || 0,
      lastScoredAt: r.last_scored_at,
    }));
  } catch (e) {
    reportQueryFailure("event_score_ranking", MIGRATION, e);
    return [];
  }
}
