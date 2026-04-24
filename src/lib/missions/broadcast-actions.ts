"use server";

/**
 * 돌발 미션(BROADCAST) 서버 액션 — Phase 3.E 구현.
 *
 * - triggerBroadcastAction: BROADCAST org_mission을 즉시 발동해서
 *   mission_broadcasts 행을 생성한다. expires_at 까지 참가자가 제출 가능.
 * - cancelBroadcastAction: 진행 중인 mission_broadcasts 를 취소하고
 *   cancelled_at 타임스탬프를 찍는다.
 *
 * 발동은 org 세션(운영자)만 가능하고 기관 범위(ORG/EVENT)로 제한.
 * ALL 범위는 관리자(admin) 전용 → org 세션 액션에서는 거부.
 */

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  loadBroadcastById,
  loadOrgMissionById,
} from "@/lib/missions/queries";
import type {
  BroadcastMissionConfig,
  BroadcastTargetScope,
} from "@/lib/missions/types";

type Row = Record<string, unknown>;
type SbErr = { message: string; code?: string } | null;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* -------------------------------------------------------------------------- */
/* 1) triggerBroadcastAction                                                  */
/* -------------------------------------------------------------------------- */

export async function triggerBroadcastAction(
  orgMissionId: string,
  targetScope: BroadcastTargetScope,
  targetEventId?: string
): Promise<void> {
  const org = await requireOrg();
  if (!orgMissionId) throw new Error("미션을 찾을 수 없어요");

  if (
    targetScope !== "ORG" &&
    targetScope !== "EVENT" &&
    targetScope !== "ALL"
  ) {
    throw new Error("대상 범위가 올바르지 않아요");
  }

  if (targetScope === "ALL") {
    throw new Error("ALL 범위는 관리자만 가능해요");
  }

  let eventId: string | null = null;
  if (targetScope === "EVENT") {
    const raw = (targetEventId ?? "").trim();
    if (!raw) throw new Error("이벤트를 선택해 주세요");
    if (!UUID_RE.test(raw)) throw new Error("이벤트 ID 형식이 올바르지 않아요");
    eventId = raw;
  }

  const mission = await loadOrgMissionById(orgMissionId);
  if (!mission) throw new Error("미션을 찾을 수 없어요");
  if (mission.org_id !== org.orgId) {
    throw new Error("다른 기관의 미션은 발동할 수 없어요");
  }
  if (mission.kind !== "BROADCAST") {
    throw new Error("돌발 미션이 아니에요");
  }
  if (!mission.is_active) {
    throw new Error("현재 진행할 수 없는 미션이에요");
  }

  const cfg = (mission.config_json ?? {}) as Partial<BroadcastMissionConfig>;
  // DB check: 30 ~ 3600 sec. 앱에서 먼저 clamp.
  const durationSec = Math.max(
    30,
    Math.min(3600, cfg.duration_sec ?? 300)
  );
  const prompt = typeof cfg.prompt === "string" ? cfg.prompt : "";
  if (!prompt.trim()) {
    throw new Error("돌발 미션의 프롬프트가 설정되지 않았어요");
  }

  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + durationSec * 1000).toISOString();

  const insertResp = (await (
    supabase.from("mission_broadcasts" as never) as unknown as {
      insert: (r: Row) => Promise<{ error: SbErr }>;
    }
  ).insert({
    org_mission_id: orgMissionId,
    triggered_by_org_id: org.orgId,
    target_scope: targetScope,
    target_event_id: eventId,
    prompt_snapshot: prompt,
    duration_sec: durationSec,
    fires_at: nowIso,
    expires_at: expiresAt,
  } satisfies Row)) as { error: SbErr };

  if (insertResp.error) {
    console.error("[broadcast/trigger] error", {
      code: insertResp.error.code,
    });
    throw new Error(`돌발 미션 발동 실패: ${insertResp.error.message}`);
  }

  revalidatePath(`/org/${org.orgId}/missions/broadcast`);
  revalidatePath("/broadcasts");
  revalidatePath("/home");
}

/* -------------------------------------------------------------------------- */
/* 1.5) createSampleBroadcastMissionAction — 빈 상태용 원클릭 시드             */
/* -------------------------------------------------------------------------- */

/**
 * org_missions 에 BROADCAST kind 샘플 미션 1건을 생성.
 * 브로드캐스트 콘솔 빈 상태에서 "바로 만들어서 발동" 플로우용.
 * 중복 호출 방지는 UI 에서 transition pending 으로 막음.
 */
export async function createSampleBroadcastMissionAction(): Promise<void> {
  const org = await requireOrg();
  const supabase = await createClient();

  const resp = (await (
    supabase.from("org_missions" as never) as unknown as {
      insert: (r: Row) => Promise<{ error: SbErr }>;
    }
  ).insert({
    org_id: org.orgId,
    kind: "BROADCAST",
    title: "⚡ 지금 이 순간 인증샷",
    description: "돌발 미션 샘플 — 원하는 대로 내용을 수정해서 쓰세요",
    icon: "⚡",
    acorns: 10,
    config_json: {
      duration_sec: 300,
      prompt: "지금 이 순간을 사진 1장으로 남겨주세요! 무엇이든 좋아요 📸",
      submission_kind: "PHOTO",
    } satisfies BroadcastMissionConfig,
    is_active: true,
  } satisfies Row)) as { error: SbErr };

  if (resp.error) {
    console.error("[broadcast/createSample] error", {
      code: resp.error.code,
    });
    throw new Error(`샘플 돌발 미션 생성 실패: ${resp.error.message}`);
  }

  revalidatePath(`/org/${org.orgId}/missions/broadcast`);
  revalidatePath(`/org/${org.orgId}/missions/catalog`);
}

/* -------------------------------------------------------------------------- */
/* 2) cancelBroadcastAction                                                   */
/* -------------------------------------------------------------------------- */

export async function cancelBroadcastAction(
  broadcastId: string
): Promise<void> {
  const org = await requireOrg();
  if (!broadcastId) throw new Error("broadcastId가 비어 있어요");

  const broadcast = await loadBroadcastById(broadcastId);
  if (!broadcast) throw new Error("돌발 미션을 찾을 수 없어요");
  if (broadcast.triggered_by_org_id !== org.orgId) {
    throw new Error("다른 기관의 돌발 미션은 취소할 수 없어요");
  }

  if (broadcast.cancelled_at) {
    // idempotent
    revalidatePath(`/org/${org.orgId}/missions/broadcast`);
    return;
  }
  if (new Date(broadcast.expires_at).getTime() <= Date.now()) {
    throw new Error("이미 종료된 돌발 미션이에요");
  }

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const resp = (await (
    supabase.from("mission_broadcasts" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ cancelled_at: nowIso })
    .eq("id", broadcastId)) as { error: SbErr };

  if (resp.error) {
    throw new Error(`돌발 미션 취소 실패: ${resp.error.message}`);
  }

  revalidatePath(`/org/${org.orgId}/missions/broadcast`);
  revalidatePath("/broadcasts");
  revalidatePath("/home");
}
