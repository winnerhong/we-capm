// server-only: 기관의 행사 id 목록 — 요청당 한 번.
//
// 왜 따로 두나:
//   "이 기관의 행사 id 전부" 는 참가자를 세는 거의 모든 집계의 첫 걸음이다.
//   그래서 관제실·기관 홈·도토리 집계가 **각자** 같은 질의를 쐈다. 관제실 한
//   장에서만 여섯 번이었다. 같은 답을 여섯 번 받아 오는 셈이고, 게다가 이건
//   뒤따르는 질의를 막는 사슬의 첫 칸이라 여섯 번이 그대로 지연으로 쌓인다.
//
// cache() 는 **요청 안에서만** 유효하다. 요청이 끝나면 사라지므로 행사를 새로
// 만들거나 지운 결과는 다음 화면에 바로 반영된다.

import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

type SbResp<T> = { data: T[] | null; error: unknown };

/** 이 기관의 행사 id 전부 (상태 무관). 실패하면 빈 배열 — 부르는 쪽이 안 죽는다. */
export const loadOrgEventIds = cache(async function loadOrgEventIds(
  orgId: string
): Promise<string[]> {
  if (!orgId) return [];
  try {
    const supabase = await createClient();
    const resp = (await (
      supabase.from("org_events" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => Promise<SbResp<{ id: string }>>;
        };
      }
    )
      .select("id")
      .eq("org_id", orgId)) as SbResp<{ id: string }>;

    if (resp.error) {
      console.error("[org-events/loadOrgEventIds] error", resp.error);
      return [];
    }
    return (resp.data ?? []).map((r) => r.id);
  } catch (e) {
    console.error("[org-events/loadOrgEventIds] throw", e);
    return [];
  }
});

/**
 * 이 기관 행사에 참가한 보호자 user_id (중복 제거, 필터 없음).
 *
 * 관제실과 도토리 집계가 각자 같은 두 단계(행사 id → 참가자)를 밟고 있었다.
 * 뒤에 붙는 필터(기관 소속만, 특정 user 만)는 부르는 쪽마다 다르므로 여기서는
 * **거르지 않은 원본**만 준다.
 */
export const loadOrgEventParticipantUserIds = cache(
  async function loadOrgEventParticipantUserIds(
    orgId: string
  ): Promise<string[]> {
    const eventIds = await loadOrgEventIds(orgId);
    if (eventIds.length === 0) return [];

    try {
      const supabase = await createClient();
      const resp = (await (
        supabase.from("org_event_participants" as never) as unknown as {
          select: (c: string) => {
            in: (
              k: string,
              v: string[]
            ) => Promise<SbResp<{ user_id: string }>>;
          };
        }
      )
        .select("user_id")
        .in("event_id", eventIds)) as SbResp<{ user_id: string }>;

      if (resp.error) {
        console.error(
          "[org-events/loadOrgEventParticipantUserIds] error",
          resp.error
        );
        return [];
      }
      return Array.from(
        new Set((resp.data ?? []).map((r) => r.user_id).filter(Boolean))
      );
    } catch (e) {
      console.error("[org-events/loadOrgEventParticipantUserIds] throw", e);
      return [];
    }
  }
);
