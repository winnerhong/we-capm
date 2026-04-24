// server-only helper — 도토리 지급 시 플랫폼/기관 상한을 일괄 적용.
// submitMissionAction (AUTO_APPROVED path) 와 review-core.approveSubmissionCore 공용.

import "server-only";
import {
  loadOrgDailyAcornCap,
  loadPlatformAcornGuidelines,
  sumUserAcornsToday,
} from "@/lib/missions/queries";

export interface AcornCapContext {
  /** 플랫폼 절대 상한 (기관이 이걸 넘어 설정 불가) */
  platformHardCap: number;
  /** 플랫폼 미션당 상한 */
  platformMaxPerMission: number;
  /** 기관이 설정한 일일 상한 — 미설정 시 platform.max_daily_suggested 로 폴백 */
  orgDailyCap: number;
  /** 오늘 이 유저가 이미 받은 누적 도토리 */
  todayAwarded: number;
}

/**
 * 도토리 상한 컨텍스트 로드.
 * - 플랫폼 가이드라인 없으면 안전한 기본값(50/200/20) 사용
 * - 기관 cap 없으면 platform.max_daily_suggested 로 폴백
 */
export async function loadAcornCapContext(
  userId: string,
  orgId: string
): Promise<AcornCapContext> {
  const [guidelines, orgCap, todayAwarded] = await Promise.all([
    loadPlatformAcornGuidelines(),
    loadOrgDailyAcornCap(orgId),
    sumUserAcornsToday(userId, orgId),
  ]);

  const platformHardCap = guidelines?.max_daily_hard_cap ?? 200;
  const platformMaxPerMission = guidelines?.max_per_mission ?? 20;
  const platformSuggested = guidelines?.max_daily_suggested ?? 50;
  const orgDailyCap = orgCap?.daily_cap ?? platformSuggested;

  return {
    platformHardCap,
    platformMaxPerMission,
    orgDailyCap,
    todayAwarded,
  };
}

export interface CapResult {
  /** 실제 지급 가능한 도토리 (0 이상) */
  allowed: number;
  /** 깎였을 때 사유 */
  reason?: string;
}

/**
 * 요청한 도토리 수를 제한 규칙에 맞춰 실제 지급가능 수치로 변환.
 *  - max_per_mission 클램프
 *  - effectiveCap = min(orgDailyCap, platformHardCap) — 기관이 하드캡보다 크게 설정해도 하드캡이 우선
 *  - remaining = max(effectiveCap - todayAwarded, 0)
 *  - 최종 = min(clamped, remaining)
 */
export function capAcornAmount(
  requested: number,
  ctx: AcornCapContext
): CapResult {
  const req = Math.max(0, Math.floor(requested || 0));
  if (req === 0) return { allowed: 0 };

  const reasons: string[] = [];

  // 1) 미션당 상한 클램프
  let clamped = req;
  if (clamped > ctx.platformMaxPerMission) {
    clamped = ctx.platformMaxPerMission;
    reasons.push(`미션당 상한 ${ctx.platformMaxPerMission}도토리 적용`);
  }

  // 2) 효과적인 일일 상한 = min(org, platform hard)
  const effectiveCap = Math.min(ctx.orgDailyCap, ctx.platformHardCap);
  const remaining = Math.max(effectiveCap - ctx.todayAwarded, 0);

  let allowed = clamped;
  if (allowed > remaining) {
    allowed = remaining;
    if (remaining === 0) {
      reasons.push("일일 상한 초과");
    } else {
      reasons.push(`일일 잔여 ${remaining}도토리 로 제한`);
    }
  }

  return {
    allowed,
    reason: reasons.length > 0 ? reasons.join(", ") : undefined,
  };
}
