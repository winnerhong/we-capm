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
import { loadOrgEvents } from "@/lib/org-events/queries";
import type {
  BroadcastMissionConfig,
  BroadcastTargetScope,
  OrgMissionRow,
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

/* -------------------------------------------------------------------------- */
/* 3) loadBroadcastSetupAction                                                */
/*    관제실에서 헤더의 "돌발미션" 인라인 모달이 lazy fetch 로 호출.          */
/*    모달 mount 시 missions 리스트 + 활성 행사 같이 받아온다.                */
/* -------------------------------------------------------------------------- */

export type BroadcastSetupSummary = {
  id: string;
  title: string;
  icon: string | null;
  description: string | null;
  acorns: number;
  prompt: string;
  duration_sec: number;
  submission_kind: "PHOTO" | "TEXT";
  is_active: boolean;
};

function parseBroadcastCfg(
  raw: Record<string, unknown>
): BroadcastMissionConfig {
  const dur =
    typeof raw.duration_sec === "number" && raw.duration_sec > 0
      ? Math.floor(raw.duration_sec)
      : 300;
  const prompt = typeof raw.prompt === "string" ? raw.prompt : "";
  const kindRaw =
    typeof raw.submission_kind === "string" ? raw.submission_kind : "";
  return {
    duration_sec: dur,
    prompt,
    submission_kind: kindRaw === "TEXT" ? "TEXT" : "PHOTO",
  };
}

/* -------------------------------------------------------------------------- */
/* 4) createBroadcastMissionAction / updateBroadcastMissionAction /           */
/*    deleteBroadcastMissionAction                                            */
/*    돌발 미션 콘솔에서 신규 생성 / 인라인 수정 / 삭제.                       */
/* -------------------------------------------------------------------------- */

export interface BroadcastMissionInput {
  title: string;
  prompt: string;
  durationSec: number; // 60 ~ 3600
  acorns: number; // 0 ~ 99
  submissionKind: "PHOTO" | "TEXT";
  icon: string | null;
  description: string | null;
}

function sanitizeInput(input: BroadcastMissionInput): BroadcastMissionInput {
  const title = input.title.trim();
  if (!title) throw new Error("제목을 입력해 주세요");
  if (title.length > 80) throw new Error("제목은 80자 이내로 입력해 주세요");
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("프롬프트를 입력해 주세요");
  if (prompt.length > 400)
    throw new Error("프롬프트는 400자 이내로 입력해 주세요");
  const durationSec = Math.max(
    60,
    Math.min(3600, Math.floor(input.durationSec))
  );
  const acorns = Math.max(0, Math.min(99, Math.floor(input.acorns)));
  const submissionKind: "PHOTO" | "TEXT" =
    input.submissionKind === "TEXT" ? "TEXT" : "PHOTO";
  const icon = input.icon?.trim() || null;
  const description = input.description?.trim() || null;
  return { title, prompt, durationSec, acorns, submissionKind, icon, description };
}

export async function createBroadcastMissionAction(
  input: BroadcastMissionInput
): Promise<{ id: string }> {
  const org = await requireOrg();
  const s = sanitizeInput(input);
  const supabase = await createClient();

  const resp = (await (
    supabase.from("org_missions" as never) as unknown as {
      insert: (r: Row) => {
        select: (c: string) => {
          single: () => Promise<{ data: { id: string } | null; error: SbErr }>;
        };
      };
    }
  )
    .insert({
      org_id: org.orgId,
      kind: "BROADCAST",
      title: s.title,
      description: s.description,
      icon: s.icon ?? "⚡",
      acorns: s.acorns,
      config_json: {
        duration_sec: s.durationSec,
        prompt: s.prompt,
        submission_kind: s.submissionKind,
      } satisfies BroadcastMissionConfig,
      is_active: true,
    } satisfies Row)
    .select("id")
    .single()) as { data: { id: string } | null; error: SbErr };

  if (resp.error || !resp.data) {
    throw new Error(
      `돌발 미션 생성 실패: ${resp.error?.message ?? "알 수 없는 오류"}`
    );
  }

  revalidatePath(`/org/${org.orgId}/missions/broadcast`);
  revalidatePath(`/org/${org.orgId}/missions/catalog`);
  return { id: resp.data.id };
}

export async function updateBroadcastMissionAction(
  missionId: string,
  input: BroadcastMissionInput
): Promise<void> {
  const org = await requireOrg();
  if (!UUID_RE.test(missionId))
    throw new Error("잘못된 미션 ID 입니다");
  const s = sanitizeInput(input);

  // 소유권 가드 — 다른 org 의 미션 수정 차단.
  const mission = await loadOrgMissionById(missionId);
  if (!mission || mission.org_id !== org.orgId) {
    throw new Error("권한이 없는 미션이에요");
  }
  if (mission.kind !== "BROADCAST") {
    throw new Error("돌발 미션만 수정 가능합니다");
  }

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_missions" as never) as unknown as {
      update: (r: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      title: s.title,
      description: s.description,
      icon: s.icon ?? "⚡",
      acorns: s.acorns,
      config_json: {
        duration_sec: s.durationSec,
        prompt: s.prompt,
        submission_kind: s.submissionKind,
      } satisfies BroadcastMissionConfig,
    } satisfies Row)
    .eq("id", missionId)) as { error: SbErr };

  if (resp.error) {
    throw new Error(`돌발 미션 수정 실패: ${resp.error.message}`);
  }

  revalidatePath(`/org/${org.orgId}/missions/broadcast`);
  revalidatePath(`/org/${org.orgId}/missions/catalog`);
}

export async function deleteBroadcastMissionAction(
  missionId: string
): Promise<void> {
  const org = await requireOrg();
  if (!UUID_RE.test(missionId))
    throw new Error("잘못된 미션 ID 입니다");

  // 소유권 가드.
  const mission = await loadOrgMissionById(missionId);
  if (!mission || mission.org_id !== org.orgId) {
    throw new Error("권한이 없는 미션이에요");
  }
  if (mission.kind !== "BROADCAST") {
    throw new Error("돌발 미션만 삭제 가능합니다");
  }

  const supabase = await createClient();

  // hard delete 시도. mission_broadcasts/submissions 의 FK 제약으로 실패하면
  // soft delete (is_active=false) 로 fallback — 발동 기록이 남아 있는 미션은
  // 행 자체 삭제 대신 archive.
  const delResp = (await (
    supabase.from("org_missions" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .delete()
    .eq("id", missionId)) as { error: SbErr };

  if (delResp.error) {
    // FK 위반 등 — soft delete 로 archive.
    const archResp = (await (
      supabase.from("org_missions" as never) as unknown as {
        update: (r: Row) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      }
    )
      .update({ is_active: false } satisfies Row)
      .eq("id", missionId)) as { error: SbErr };
    if (archResp.error) {
      throw new Error(
        `돌발 미션 삭제 실패: ${delResp.error.message} / archive: ${archResp.error.message}`
      );
    }
  }

  revalidatePath(`/org/${org.orgId}/missions/broadcast`);
  revalidatePath(`/org/${org.orgId}/missions/catalog`);
}

export async function loadBroadcastSetupAction(): Promise<{
  missions: BroadcastSetupSummary[];
  activeEvents: Array<{ id: string; name: string }>;
}> {
  const org = await requireOrg();
  const orgId = org.orgId;

  const supabase = await createClient();
  const missionResp = (await (
    supabase.from("org_missions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (
            k: string,
            v: string
          ) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<{ data: OrgMissionRow[] | null }>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("org_id", orgId)
    .eq("kind", "BROADCAST")
    .order("updated_at", { ascending: false })) as {
    data: OrgMissionRow[] | null;
  };

  const missions: BroadcastSetupSummary[] = (missionResp.data ?? []).map(
    (m) => {
      const cfg = parseBroadcastCfg(
        (m.config_json ?? {}) as Record<string, unknown>
      );
      return {
        id: m.id,
        title: m.title,
        icon: m.icon,
        description: m.description,
        acorns: m.acorns,
        prompt: cfg.prompt,
        duration_sec: cfg.duration_sec,
        submission_kind: cfg.submission_kind,
        is_active: m.is_active,
      };
    }
  );

  const events = await loadOrgEvents(orgId, "live");
  const activeEvents = events.map((e) => ({ id: e.id, name: e.name }));

  return { missions, activeEvents };
}
