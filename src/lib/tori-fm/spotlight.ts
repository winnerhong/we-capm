// 전광판 스포트라이트 — 타입 + 쿼리 헬퍼.
// 액션은 src/lib/tori-fm/actions.ts (triggerSpotlightAction / dismissSpotlightAction).
//
// SpotlightKind 4종:
//   STORY            : 사연 풀스크린 (DJ 가 선택한 사연을 큰 화면에 띄움)
//   HEART_RAIN       : 떠오르는 하트 폭우 (5~10초)
//   EMOJI_RAIN       : 자연·식물 이모지 비 (5~10초)
//   BANNER           : 가로 슬라이드 응원 배너 (3~5초)

import { createClient } from "@/lib/supabase/server";

export type SpotlightKind = "STORY" | "HEART_RAIN" | "EMOJI_RAIN" | "BANNER";

export interface FmSpotlightEventRow {
  id: string;
  session_id: string;
  kind: SpotlightKind;
  payload_json: Record<string, unknown>;
  triggered_at: string;
  expires_at: string | null;
  dismissed_at: string | null;
  triggered_by_org_id: string | null;
}

/**
 * kind 별 기본 지속 시간(초). NULL 이면 dismiss 까지 무한 (DJ 명시 종료).
 */
export const DEFAULT_SPOTLIGHT_DURATION_SEC: Record<SpotlightKind, number | null> = {
  STORY: 30, // 30초 후 자동 dismiss (DJ 가 길게 두고 싶으면 다시 트리거)
  HEART_RAIN: 6,
  EMOJI_RAIN: 6,
  BANNER: 4,
};

/**
 * 현재 세션의 활성 스포트라이트(만료 전 / dismiss 전) 가장 최신 1건.
 * 전광판 SpotlightReceiver 가 초기 렌더 시 호출.
 */
export async function loadActiveSpotlight(
  sessionId: string
): Promise<FmSpotlightEventRow | null> {
  if (!sessionId) return null;

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const resp = (await (
    supabase.from("fm_spotlight_events" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          is: (k: string, v: null) => {
            or: (q: string) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => {
                limit: (n: number) => {
                  maybeSingle: () => Promise<{
                    data: FmSpotlightEventRow | null;
                  }>;
                };
              };
            };
          };
        };
      };
    }
  )
    .select(
      "id, session_id, kind, payload_json, triggered_at, expires_at, dismissed_at, triggered_by_org_id"
    )
    .eq("session_id", sessionId)
    .is("dismissed_at", null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("triggered_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: FmSpotlightEventRow | null };

  return resp.data;
}
