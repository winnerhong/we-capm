// server-only 내부 헬퍼.
// review-actions.ts ("use server") 와 auto-approve.ts 에서 공용으로 쓰는
// 승인 코어 로직. "use server" 파일은 모든 export 가 async 함수여야 해서
// 타입/비동기아닌 헬퍼를 함께 둘 수 없다 → 별도 모듈로 분리.

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadOrgMissionById } from "@/lib/missions/queries";
import {
  capAcornAmount,
  loadAcornCapContext,
} from "@/lib/missions/acorn-cap";
import type { MissionSubmissionRow } from "@/lib/missions/types";

type Row = Record<string, unknown>;
type SbErr = { message: string; code?: string } | null;
type SbRespOne<T> = { data: T | null; error: SbErr };

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function loadSubmissionById(
  supabase: SupabaseServerClient,
  submissionId: string
): Promise<MissionSubmissionRow | null> {
  const resp = (await (
    supabase.from("mission_submissions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<MissionSubmissionRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", submissionId)
    .maybeSingle()) as SbRespOne<MissionSubmissionRow>;

  return resp.data ?? null;
}

async function updateSubmissionStatus(
  supabase: SupabaseServerClient,
  submissionId: string,
  patch: Row
): Promise<SbErr> {
  const resp = (await (
    supabase.from("mission_submissions" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update(patch)
    .eq("id", submissionId)) as { error: SbErr };
  return resp.error;
}

/**
 * 승인 시 도토리 지급 (ledger + app_users.acorn_balance 업데이트).
 * UNIQUE 인덱스 덕분에 재호출 시 23505 로 멱등 처리.
 */
async function awardAcorns(
  supabase: SupabaseServerClient,
  params: {
    userId: string;
    amount: number;
    submissionId: string;
    memo: string;
  }
): Promise<void> {
  const { userId, amount, submissionId, memo } = params;
  if (!amount || amount <= 0) return;

  const txResp = (await (
    supabase.from("user_acorn_transactions" as never) as unknown as {
      insert: (r: Row) => Promise<{ error: SbErr }>;
    }
  ).insert({
    user_id: userId,
    amount,
    reason: "MISSION",
    source_type: "mission_submission",
    source_id: submissionId,
    memo,
  })) as { error: SbErr };

  if (txResp.error) {
    if (txResp.error.code === "23505") return; // 이미 크레딧
    console.error("[review-core/awardAcorns] ledger error", {
      code: txResp.error.code,
    });
    throw new Error(`도토리 지급 실패: ${txResp.error.message}`);
  }

  const balResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<{ acorn_balance: number | null }>
          >;
        };
      };
    }
  )
    .select("acorn_balance")
    .eq("id", userId)
    .maybeSingle()) as SbRespOne<{ acorn_balance: number | null }>;

  const current = balResp.data?.acorn_balance ?? 0;
  const next = current + amount;

  const updResp = (await (
    supabase.from("app_users" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ acorn_balance: next })
    .eq("id", userId)) as { error: SbErr };

  if (updResp.error) {
    console.error("[review-core/awardAcorns] balance error", {
      code: updResp.error.code,
    });
    // ledger 는 박혔지만 balance 드리프트 — 운영 reconcile 대상
  }
}

export interface ApproveCoreResult {
  ok: boolean;
  alreadyApproved?: boolean;
  skipped?: boolean;
  acorns?: number;
}

/**
 * 승인 공통 로직.
 *  - SUBMITTED / PENDING_REVIEW 만 승인 처리
 *  - APPROVED / AUTO_APPROVED 이면 idempotent no-op (alreadyApproved)
 *  - REJECTED / REVOKED 면 skipped
 *  - reviewedBy: managerId 또는 'cron:auto_approve_24h'
 */
export async function approveSubmissionCore(params: {
  submissionId: string;
  reviewedBy: string;
  expectedOrgId?: string;
}): Promise<ApproveCoreResult> {
  const { submissionId, reviewedBy, expectedOrgId } = params;
  if (!submissionId) throw new Error("submissionId가 비어 있어요");

  const supabase = await createClient();
  const submission = await loadSubmissionById(supabase, submissionId);
  if (!submission) throw new Error("제출을 찾을 수 없어요");

  const mission = await loadOrgMissionById(submission.org_mission_id);
  if (!mission) throw new Error("연결된 미션을 찾을 수 없어요");

  if (expectedOrgId && mission.org_id !== expectedOrgId) {
    throw new Error("다른 기관의 제출이에요");
  }

  if (submission.status === "APPROVED" || submission.status === "AUTO_APPROVED") {
    return { ok: true, alreadyApproved: true };
  }
  if (submission.status !== "SUBMITTED" && submission.status !== "PENDING_REVIEW") {
    return { ok: false, skipped: true };
  }

  const requested = mission.acorns ?? 0;

  // 상한 적용 — 승인 시점 컨텍스트로 계산
  let amount = requested;
  let memoSuffix = "";
  if (requested > 0) {
    const ctx = await loadAcornCapContext(submission.user_id, mission.org_id);
    const { allowed, reason } = capAcornAmount(requested, ctx);
    amount = allowed;
    if (reason && allowed !== requested) memoSuffix = ` (${reason})`;
  }

  const updErr = await updateSubmissionStatus(supabase, submissionId, {
    status: "APPROVED",
    awarded_acorns: amount,
    reviewed_at: new Date().toISOString(),
    reviewed_by: reviewedBy,
    reject_reason: null,
  });
  if (updErr) throw new Error(`승인 실패: ${updErr.message}`);

  await awardAcorns(supabase, {
    userId: submission.user_id,
    amount,
    submissionId,
    memo: `${mission.kind}:${mission.title}${memoSuffix}`,
  });

  return { ok: true, acorns: amount };
}
