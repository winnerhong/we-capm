// server-only — cron/관리자 트리거용.
// approval_mode='AUTO_24H' 인 org_mission 에 걸린 SUBMITTED 제출을
// submitted_at + 24h 이후에 자동 승인한다.
// 멱등: user_acorn_transactions 의 UNIQUE(source_type='mission_submission', source_id)
// 덕분에 동일 제출에 대한 이중 크레딧 방지.

import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  approveSubmissionCore,
  type ApproveCoreResult,
} from "@/lib/missions/review-core";
import type { MissionSubmissionRow, OrgMissionRow } from "@/lib/missions/types";

export interface AutoApproveResult {
  approved: number;
  skipped: number;
  failed: number;
  scanned: number;
  errors: Array<{ submissionId: string; message: string }>;
}

type SbResp<T> = { data: T[] | null; error: { message: string } | null };

/**
 * 24시간 경과한 SUBMITTED 제출을 자동 승인한다.
 * - SUBMITTED 만 대상 (PENDING_REVIEW 는 수동 리뷰 필요)
 * - approval_mode='AUTO_24H' 인 미션에 속한 건만
 * - approveSubmissionCore 가 멱등이므로 재시도 안전
 *
 * reviewedBy 로 'cron:auto_approve_24h' 식별자를 기록.
 */
export async function runAutoApprove24h(): Promise<AutoApproveResult> {
  const result: AutoApproveResult = {
    approved: 0,
    skipped: 0,
    failed: 0,
    scanned: 0,
    errors: [],
  };

  const supabase = await createClient();

  const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 1) AUTO_24H 미션 id 목록
  const missionsResp = (await (
    supabase.from("org_missions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<SbResp<Pick<OrgMissionRow, "id">>>;
      };
    }
  )
    .select("id")
    .eq("approval_mode", "AUTO_24H")) as SbResp<Pick<OrgMissionRow, "id">>;

  if (missionsResp.error) {
    throw new Error(
      `AUTO_24H 미션 조회 실패: ${missionsResp.error.message}`
    );
  }
  const missionIds = (missionsResp.data ?? []).map((m) => m.id);
  if (missionIds.length === 0) return result;

  // 2) 24h 경과한 SUBMITTED 제출 목록
  const subsResp = (await (
    supabase.from("mission_submissions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          in: (k: string, v: string[]) => {
            lte: (k: string, v: string) => Promise<SbResp<MissionSubmissionRow>>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("status", "SUBMITTED")
    .in("org_mission_id", missionIds)
    .lte("submitted_at", cutoffIso)) as SbResp<MissionSubmissionRow>;

  if (subsResp.error) {
    throw new Error(`제출 조회 실패: ${subsResp.error.message}`);
  }

  const submissions = subsResp.data ?? [];
  result.scanned = submissions.length;

  for (const sub of submissions) {
    try {
      const r: ApproveCoreResult = await approveSubmissionCore({
        submissionId: sub.id,
        reviewedBy: "cron:auto_approve_24h",
      });
      if (r.alreadyApproved) {
        result.skipped += 1;
      } else if (r.ok) {
        result.approved += 1;
      } else {
        result.skipped += 1;
      }
    } catch (e) {
      result.failed += 1;
      result.errors.push({
        submissionId: sub.id,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return result;
}
