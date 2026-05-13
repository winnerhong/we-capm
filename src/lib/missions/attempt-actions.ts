"use server";

// Phase 2 관제 — 참가자 미션 수행 telemetry.
//
// 모든 액션은 silent fail. mission_attempts 테이블이 없거나 RLS 충돌 시에도
// 미션 페이지·제출 흐름 자체를 막지 않도록 try/catch 로 swallow.

import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/user-auth-guard";
import { loadOrgMissionById } from "@/lib/missions/queries";

type Row = Record<string, unknown>;

/**
 * 미션 페이지 입장 — attempt upsert.
 * 같은 (user_id, org_mission_id) 면 opened_at·last_seen_at 갱신 + 완료 마킹 해제.
 */
export async function startMissionAttemptAction(
  orgMissionId: string
): Promise<void> {
  try {
    const user = await requireAppUser();
    if (!orgMissionId) return;
    const mission = await loadOrgMissionById(orgMissionId);
    if (!mission || mission.org_id !== user.orgId) return;

    const supabase = await createClient();
    const now = new Date().toISOString();

    // 우선 upsert 시도. UNIQUE(user_id, org_mission_id) 충돌 시 UPDATE.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error: upErr } = await sb
      .from("mission_attempts")
      .upsert(
        {
          org_id: mission.org_id,
          user_id: user.id,
          org_mission_id: mission.id,
          opened_at: now,
          last_seen_at: now,
          completed_submission_id: null,
        } as Row,
        { onConflict: "user_id,org_mission_id" }
      );
    if (upErr) {
      console.error("[attempt/start] upsert err", upErr.message);
    }
  } catch (e) {
    console.error("[attempt/start] throw", e);
  }
}

/**
 * 30초 heartbeat — last_seen_at 갱신. 페이지 떠 있는 동안 호출.
 */
export async function heartbeatMissionAttemptAction(
  orgMissionId: string
): Promise<void> {
  try {
    const user = await requireAppUser();
    if (!orgMissionId) return;

    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error } = await sb
      .from("mission_attempts")
      .update({ last_seen_at: new Date().toISOString() } as Row)
      .eq("user_id", user.id)
      .eq("org_mission_id", orgMissionId)
      .is("completed_submission_id", null);
    if (error) {
      console.error("[attempt/heartbeat] update err", error.message);
    }
  } catch (e) {
    console.error("[attempt/heartbeat] throw", e);
  }
}

/**
 * 제출 완료 마킹 — submitMissionAction 내부에서 호출.
 * silent fail.
 */
export async function markAttemptCompletedAction(
  orgMissionId: string,
  userId: string,
  submissionId: string
): Promise<void> {
  try {
    if (!orgMissionId || !userId || !submissionId) return;
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error } = await sb
      .from("mission_attempts")
      .update({ completed_submission_id: submissionId } as Row)
      .eq("user_id", userId)
      .eq("org_mission_id", orgMissionId);
    if (error) {
      console.error("[attempt/complete] update err", error.message);
    }
  } catch (e) {
    console.error("[attempt/complete] throw", e);
  }
}
