// server-only: 점수 원장 기록 — 단일 창구.
//
// 계산은 core.ts(순수)가 하고, 여기서는 **쓰기와 실패 처리**만 한다.
//
// ⚠ 점수 기록은 절대 미션 제출·승인을 막지 않는다.
//   원장 테이블이 아직 없거나(마이그레이션 20260902000000 적용 전) 쓰기가 실패해도
//   조용히 넘어간다. 등수는 나중에 다시 계산할 수 있지만, 제출이 실패하면 그 가족은
//   행사장에서 다시 시도해야 한다. 무엇이 더 중요한지는 분명하다.

import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { reportQueryFailure } from "@/lib/supabase/schema-gap";
import { eventIdForSubmission } from "@/lib/app-user/acorn-ledger";
import { parSecondsFor, penaltyForRejected, scoreForApproved } from "./core";

type Supa = Awaited<ReturnType<typeof createClient>>;
type SbErr = { message?: string; code?: string } | null;

const MIGRATION = "20260902000000_score_ledger.sql";

export type ScoreKind =
  | "MISSION_APPROVED"
  | "MISSION_REJECTED"
  | "MISSION_REVOKED"
  | "ADMIN_ADJUST";

type InsertInput = {
  userId: string;
  orgId: string | null;
  eventId: string | null;
  orgMissionId: string | null;
  submissionId: string | null;
  kind: ScoreKind;
  points: number;
  detail?: Record<string, unknown>;
  memo?: string | null;
};

async function insertScoreEvent(
  supabase: Supa,
  input: InsertInput
): Promise<void> {
  if (!input.userId || input.points === 0) return;

  const resp = (await (
    supabase.from("user_score_events" as never) as unknown as {
      insert: (r: unknown) => Promise<{ error: SbErr }>;
    }
  ).insert({
    user_id: input.userId,
    org_id: input.orgId,
    event_id: input.eventId,
    org_mission_id: input.orgMissionId,
    submission_id: input.submissionId,
    kind: input.kind,
    points: input.points,
    detail_json: input.detail ?? {},
    memo: input.memo ?? null,
  })) as { error: SbErr };

  if (!resp.error) return;
  // 23505 = 같은 제출·같은 종류가 이미 있다. 승인은 크론과 수동이 겹칠 수 있어
  // 정상적인 결과다.
  if (resp.error.code === "23505") return;
  reportQueryFailure("user_score_events insert", MIGRATION, resp.error);
}

/**
 * 미션 페이지에 들어온 뒤 지금까지 몇 초 걸렸나.
 *
 * 못 재면 null 이고, 그 경우 속도 보너스 없이 기본점만 간다. 시간을 못 잰 것으로
 * 감점하면 안 된다 — 대개 앱이 attempt 를 못 남긴 우리 쪽 사정이다.
 */
export async function measureElapsedSeconds(
  supabase: Supa,
  userId: string,
  orgMissionId: string
): Promise<number | null> {
  if (!userId || !orgMissionId) return null;
  try {
    const resp = (await (
      supabase.from("mission_attempts" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<{
                data: { opened_at: string } | null;
                error: SbErr;
              }>;
            };
          };
        };
      }
    )
      .select("opened_at")
      .eq("user_id", userId)
      .eq("org_mission_id", orgMissionId)
      .maybeSingle()) as {
      data: { opened_at: string } | null;
      error: SbErr;
    };

    if (resp.error || !resp.data?.opened_at) return null;
    const opened = Date.parse(resp.data.opened_at);
    if (!Number.isFinite(opened)) return null;

    const seconds = Math.round((Date.now() - opened) / 1000);
    // 서버·클라 시계가 어긋나면 음수가 나온다. 그건 «못 쟀다»로 본다.
    if (seconds < 0) return null;
    // 하루를 넘는 값은 페이지를 열어두고 잊은 것이다. 기준을 한참 넘겨 어차피
    // 보너스가 0이므로 그대로 둬도 되지만, 원장에 이상한 숫자를 남기지 않는다.
    if (seconds > 24 * 60 * 60) return null;
    return seconds;
  } catch {
    return null;
  }
}

/** 승인된 제출에 점수를 준다. 도토리와 별개다. */
export async function recordApprovedScore(
  supabase: Supa,
  params: {
    userId: string;
    orgId: string | null;
    submissionId: string;
    orgMissionId: string;
    missionKind: string;
    missionConfig?: { par_seconds?: unknown } | null;
    acorns: number;
    elapsedSeconds: number | null;
    eventId?: string | null;
  }
): Promise<void> {
  try {
    const par = parSecondsFor(params.missionKind, params.missionConfig);
    const s = scoreForApproved({
      acorns: params.acorns,
      elapsedSeconds: params.elapsedSeconds,
      par,
    });
    if (s.total === 0) return;

    const eventId =
      params.eventId !== undefined
        ? params.eventId
        : await eventIdForSubmission(supabase, params.submissionId);

    await insertScoreEvent(supabase, {
      userId: params.userId,
      orgId: params.orgId,
      eventId,
      orgMissionId: params.orgMissionId,
      submissionId: params.submissionId,
      kind: "MISSION_APPROVED",
      points: s.total,
      detail: {
        base: s.base,
        speedBonus: s.speedBonus,
        elapsedSeconds: params.elapsedSeconds,
        par,
        acorns: params.acorns,
      },
      memo: s.note,
    });
  } catch (e) {
    reportQueryFailure("recordApprovedScore", MIGRATION, e);
  }
}

/**
 * 반려 감점.
 *
 * 재제출은 새 submission 이라 감점은 그대로 남는다 — 대충 냈다가 다시 제대로 낸
 * 집이 처음부터 제대로 낸 집을 못 이기게 하는 것이 목적이다.
 */
export async function recordRejectPenalty(
  supabase: Supa,
  params: {
    userId: string;
    orgId: string | null;
    submissionId: string;
    orgMissionId: string;
    acorns: number;
    reason?: string | null;
    eventId?: string | null;
  }
): Promise<void> {
  try {
    const points = penaltyForRejected(params.acorns);
    if (points === 0) return;

    const eventId =
      params.eventId !== undefined
        ? params.eventId
        : await eventIdForSubmission(supabase, params.submissionId);

    await insertScoreEvent(supabase, {
      userId: params.userId,
      orgId: params.orgId,
      eventId,
      orgMissionId: params.orgMissionId,
      submissionId: params.submissionId,
      kind: "MISSION_REJECTED",
      points,
      detail: { acorns: params.acorns },
      memo: params.reason ?? "반려",
    });
  } catch (e) {
    reportQueryFailure("recordRejectPenalty", MIGRATION, e);
  }
}

/**
 * 오승인 취소 — 줬던 점수를 되돌린다.
 *
 * 감점(MISSION_REJECTED)과 다른 종류인 이유: 이건 **가족의 잘못이 아니라 운영자의
 * 정정**이다. 한 줄로 합치면 나중에 "왜 깎였나"를 설명할 수 없다.
 */
export async function recordScoreRevoke(
  supabase: Supa,
  params: {
    userId: string;
    orgId: string | null;
    submissionId: string;
    orgMissionId: string;
    eventId?: string | null;
  }
): Promise<void> {
  try {
    // 줬던 승인 점수를 찾아 그만큼 음수로 되돌린다.
    const resp = (await (
      supabase.from("user_score_events" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => Promise<{
              data: { points: number }[] | null;
              error: SbErr;
            }>;
          };
        };
      }
    )
      .select("points")
      .eq("submission_id", params.submissionId)
      .eq("kind", "MISSION_APPROVED")) as {
      data: { points: number }[] | null;
      error: SbErr;
    };

    if (resp.error) {
      reportQueryFailure("recordScoreRevoke lookup", MIGRATION, resp.error);
      return;
    }
    const given = (resp.data ?? []).reduce((a, r) => a + (r.points ?? 0), 0);
    if (given <= 0) return;

    const eventId =
      params.eventId !== undefined
        ? params.eventId
        : await eventIdForSubmission(supabase, params.submissionId);

    await insertScoreEvent(supabase, {
      userId: params.userId,
      orgId: params.orgId,
      eventId,
      orgMissionId: params.orgMissionId,
      submissionId: params.submissionId,
      kind: "MISSION_REVOKED",
      points: -given,
      detail: { revoked: given },
      memo: "승인 취소",
    });
  } catch (e) {
    reportQueryFailure("recordScoreRevoke", MIGRATION, e);
  }
}
