// server-only (pure — no DB, no client). Takes data, returns computed state.
import type {
  OrgMissionRow,
  MissionSubmissionRow,
  FinalRewardMissionConfig,
  TreasureMissionConfig,
  MissionTreasureProgressRow,
} from "@/lib/missions/types";

export interface PackProgress {
  totalSlots: number;
  completedSlots: number;
  percent: number; // 0..100, rounded
  nextMission: OrgMissionRow | null; // first unlocked + incomplete
  acornsEarned: number;
  acornsPossible: number;
  isComplete: boolean;
}

const APPROVED_LIKE = new Set<string>(["AUTO_APPROVED", "APPROVED"]);

/**
 * 주어진 org_mission에 대해 유저가 "성공 처리된" 제출을 갖고 있는지.
 * SUBMITTED/PENDING_REVIEW는 아직 미완으로 취급 (진척도 보수적 계산).
 */
function isMissionComplete(
  missionId: string,
  submissions: MissionSubmissionRow[]
): boolean {
  for (const s of submissions) {
    if (s.org_mission_id !== missionId) continue;
    if (APPROVED_LIKE.has(s.status)) return true;
  }
  return false;
}

/**
 * 전체 팩 진행률. FINAL_REWARD 슬롯은 totalSlots/percent 계산에서 제외
 * (최종보상은 "달성" 개념이 아니라 누적 도토리의 결과물이라서).
 */
export function computePackProgress(
  orgMissions: OrgMissionRow[],
  submissions: MissionSubmissionRow[],
  userAcorns: number
): PackProgress {
  const regular = orgMissions.filter((m) => m.kind !== "FINAL_REWARD");

  let completedSlots = 0;
  let acornsEarned = 0;
  let acornsPossible = 0;

  for (const m of regular) {
    acornsPossible += m.acorns;
    const done = isMissionComplete(m.id, submissions);
    if (done) {
      completedSlots += 1;
      // 승인된 submission의 awarded_acorns 합산
      for (const s of submissions) {
        if (
          s.org_mission_id === m.id &&
          APPROVED_LIKE.has(s.status)
        ) {
          acornsEarned += s.awarded_acorns ?? 0;
        }
      }
    }
  }

  const totalSlots = regular.length;
  const percent =
    totalSlots === 0 ? 0 : Math.round((completedSlots / totalSlots) * 100);

  // nextMission: display_order ASC 순회하며 unlocked + 미완료 첫 번째
  const sorted = [...regular].sort((a, b) => a.display_order - b.display_order);
  let nextMission: OrgMissionRow | null = null;
  for (const m of sorted) {
    if (isMissionComplete(m.id, submissions)) continue;
    const gate = isMissionUnlocked(m, orgMissions, submissions, userAcorns);
    if (gate.unlocked) {
      nextMission = m;
      break;
    }
  }

  return {
    totalSlots,
    completedSlots,
    percent,
    nextMission,
    acornsEarned,
    acornsPossible,
    isComplete: totalSlots > 0 && completedSlots === totalSlots,
  };
}

/**
 * 단일 미션의 잠금 상태 계산.
 *  - ALWAYS: 무조건 언락
 *  - SEQUENTIAL: unlock_requires_mission_id가 완료돼 있어야 언락
 *  - TIER_GATE: userAcornsInPack >= unlock_requires_acorns
 * (FINAL_REWARD는 보통 TIER_GATE + 가장 낮은 티어 threshold로 관리되지만,
 *  여기서는 일반 규칙만 적용 — FINAL_REWARD 전용 티어 계산은 computeTier에서.)
 */
export function isMissionUnlocked(
  mission: OrgMissionRow,
  allPackMissions: OrgMissionRow[],
  submissions: MissionSubmissionRow[],
  userAcornsInPack: number
): { unlocked: boolean; reason?: string } {
  switch (mission.unlock_rule) {
    case "ALWAYS":
      return { unlocked: true };

    case "SEQUENTIAL": {
      const prereqId = mission.unlock_previous_id;
      if (!prereqId) {
        // 선행 미션 미지정이면 ALWAYS처럼 취급
        return { unlocked: true };
      }
      const prereq = allPackMissions.find((m) => m.id === prereqId);
      if (!prereq) {
        // 선행이 삭제됐다면 안전하게 언락
        return { unlocked: true };
      }
      if (isMissionComplete(prereqId, submissions)) {
        return { unlocked: true };
      }
      return {
        unlocked: false,
        reason: `이전 미션(${prereq.title})을 먼저 완료해주세요`,
      };
    }

    case "TIER_GATE": {
      const req = mission.unlock_threshold ?? 0;
      if (userAcornsInPack >= req) return { unlocked: true };
      const need = req - userAcornsInPack;
      return {
        unlocked: false,
        reason: `도토리 ${need}개 더 모으면 열려요`,
      };
    }

    default:
      return { unlocked: true };
  }
}

/**
 * FINAL_REWARD 티어 계산 — 누적 도토리로 가장 높은 도달 티어 반환.
 * 티어 배열은 threshold ASC로 정렬 후 순회. 하나도 못 넘으면 null.
 */
export function computeTier(
  tiers: FinalRewardMissionConfig["tiers"],
  totalAcorns: number
): { label: string; threshold: number; reward_desc: string } | null {
  if (!tiers || tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold);
  let reached: { label: string; threshold: number; reward_desc: string } | null =
    null;
  for (const t of sorted) {
    if (totalAcorns >= t.threshold) {
      reached = {
        label: t.label,
        threshold: t.threshold,
        reward_desc: t.reward_desc,
      };
    } else {
      break;
    }
  }
  return reached;
}

/**
 * 보물찾기 현재 상태 계산 (pure).
 *  - progress 배열의 step_order 를 모아 unlockedSteps 구성
 *  - currentStepOrder = 가장 높은 unlocked + 1 (비었으면 1)
 *  - isComplete = unlocked 개수 === config.steps.length
 *
 * NOTE: config.steps 는 order 필드를 갖지만 여기서는 길이만 사용.
 *       실제 언락 규칙(AUTO/QR/ANSWER) 검증은 서버 액션에서 진행.
 */
export function computeTreasureState(
  config: TreasureMissionConfig,
  progress: MissionTreasureProgressRow[]
): {
  currentStepOrder: number;
  totalSteps: number;
  unlockedSteps: number[];
  isComplete: boolean;
} {
  const totalSteps = config.steps?.length ?? 0;

  // 중복 제거 + 정렬
  const unlockedSet = new Set<number>();
  for (const p of progress) unlockedSet.add(p.step_order);
  const unlockedSteps = Array.from(unlockedSet).sort((a, b) => a - b);

  const maxUnlocked =
    unlockedSteps.length === 0 ? 0 : unlockedSteps[unlockedSteps.length - 1];
  const currentStepOrder = maxUnlocked + 1;
  const isComplete = totalSteps > 0 && unlockedSteps.length >= totalSteps;

  return {
    currentStepOrder,
    totalSteps,
    unlockedSteps,
    isComplete,
  };
}
