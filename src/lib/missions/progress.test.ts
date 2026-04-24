import { describe, expect, it } from "vitest";
import {
  computePackProgress,
  computeTier,
  computeTreasureState,
  isMissionUnlocked,
} from "./progress";
import type {
  FinalRewardMissionConfig,
  MissionSubmissionRow,
  MissionTreasureProgressRow,
  OrgMissionRow,
  SubmissionStatus,
  TreasureMissionConfig,
  UnlockRule,
} from "./types";

/* -------------------------- fixture helpers -------------------------- */

function mkMission(overrides: Partial<OrgMissionRow> = {}): OrgMissionRow {
  return {
    id: overrides.id ?? "m1",
    org_id: "org1",
    quest_pack_id: "pack1",
    source_mission_id: null,
    kind: overrides.kind ?? "PHOTO",
    title: overrides.title ?? "미션",
    description: null,
    icon: null,
    acorns: overrides.acorns ?? 10,
    config_json: {},
    display_order: overrides.display_order ?? 1,
    unlock_rule: (overrides.unlock_rule ?? "ALWAYS") as UnlockRule,
    unlock_threshold: overrides.unlock_threshold ?? null,
    unlock_previous_id: overrides.unlock_previous_id ?? null,
    approval_mode: "AUTO",
    starts_at: null,
    ends_at: null,
    geofence_lat: null,
    geofence_lng: null,
    geofence_radius_m: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mkSubmission(
  missionId: string,
  status: SubmissionStatus,
  awarded: number | null = null
): MissionSubmissionRow {
  return {
    id: `sub-${missionId}-${status}`,
    org_mission_id: missionId,
    user_id: "u1",
    child_id: null,
    status,
    payload_json: {},
    awarded_acorns: awarded,
    reviewed_by: null,
    reviewed_at: null,
    reject_reason: null,
    idempotency_key: null,
    submitted_at: "2026-01-01T00:00:00Z",
  };
}

/* ----------------------------- tests ----------------------------- */

describe("missions/progress.ts", () => {
  describe("computePackProgress", () => {
    it("빈 미션/제출 → totalSlots 0, percent 0, isComplete false", () => {
      const r = computePackProgress([], [], 0);
      expect(r.totalSlots).toBe(0);
      expect(r.completedSlots).toBe(0);
      expect(r.percent).toBe(0);
      expect(r.isComplete).toBe(false);
      expect(r.nextMission).toBeNull();
      expect(r.acornsEarned).toBe(0);
      expect(r.acornsPossible).toBe(0);
    });

    it("전체 승인 → percent 100, isComplete true, nextMission null", () => {
      const missions = [
        mkMission({ id: "a", acorns: 3, display_order: 1 }),
        mkMission({ id: "b", acorns: 5, display_order: 2 }),
      ];
      const subs = [
        mkSubmission("a", "APPROVED", 3),
        mkSubmission("b", "AUTO_APPROVED", 5),
      ];
      const r = computePackProgress(missions, subs, 8);
      expect(r.percent).toBe(100);
      expect(r.isComplete).toBe(true);
      expect(r.completedSlots).toBe(2);
      expect(r.totalSlots).toBe(2);
      expect(r.acornsEarned).toBe(8);
      expect(r.acornsPossible).toBe(8);
      expect(r.nextMission).toBeNull();
    });

    it("3/5 승인 → percent 60", () => {
      const missions = [
        mkMission({ id: "a", display_order: 1 }),
        mkMission({ id: "b", display_order: 2 }),
        mkMission({ id: "c", display_order: 3 }),
        mkMission({ id: "d", display_order: 4 }),
        mkMission({ id: "e", display_order: 5 }),
      ];
      const subs = [
        mkSubmission("a", "APPROVED", 1),
        mkSubmission("b", "AUTO_APPROVED", 2),
        mkSubmission("c", "APPROVED", 3),
      ];
      const r = computePackProgress(missions, subs, 6);
      expect(r.totalSlots).toBe(5);
      expect(r.completedSlots).toBe(3);
      expect(r.percent).toBe(60);
      expect(r.isComplete).toBe(false);
    });

    it("SUBMITTED / PENDING_REVIEW 는 미완료로 간주 (보수적)", () => {
      const missions = [mkMission({ id: "a" }), mkMission({ id: "b" })];
      const subs = [
        mkSubmission("a", "SUBMITTED"),
        mkSubmission("b", "PENDING_REVIEW"),
      ];
      const r = computePackProgress(missions, subs, 0);
      expect(r.completedSlots).toBe(0);
      expect(r.percent).toBe(0);
    });

    it("REJECTED / REVOKED 는 미완료", () => {
      const missions = [mkMission({ id: "a" }), mkMission({ id: "b" })];
      const subs = [
        mkSubmission("a", "REJECTED"),
        mkSubmission("b", "REVOKED"),
      ];
      expect(computePackProgress(missions, subs, 0).completedSlots).toBe(0);
    });

    it("FINAL_REWARD 미션은 totalSlots/percent 에서 제외", () => {
      const missions = [
        mkMission({ id: "a", kind: "PHOTO", display_order: 1 }),
        mkMission({ id: "b", kind: "PHOTO", display_order: 2 }),
        mkMission({ id: "final", kind: "FINAL_REWARD", display_order: 99, acorns: 0 }),
      ];
      const subs = [mkSubmission("a", "APPROVED", 1)];
      const r = computePackProgress(missions, subs, 1);
      expect(r.totalSlots).toBe(2); // FINAL 제외
      expect(r.completedSlots).toBe(1);
      expect(r.percent).toBe(50);
    });

    it("nextMission 은 display_order ASC 로 unlocked 미완료 중 첫 번째", () => {
      const missions = [
        mkMission({ id: "a", display_order: 1 }),
        mkMission({ id: "b", display_order: 2 }),
        mkMission({ id: "c", display_order: 3 }),
      ];
      const subs = [mkSubmission("a", "APPROVED", 1)];
      const r = computePackProgress(missions, subs, 1);
      expect(r.nextMission?.id).toBe("b");
    });

    it("acornsEarned 는 승인된 submission 의 awarded_acorns 합산", () => {
      const missions = [
        mkMission({ id: "a", acorns: 10 }),
        mkMission({ id: "b", acorns: 20 }),
      ];
      const subs = [
        mkSubmission("a", "APPROVED", 7), // awarded_acorns 가 mission.acorns 와 다를 수 있음
        mkSubmission("b", "SUBMITTED"),
      ];
      const r = computePackProgress(missions, subs, 7);
      expect(r.acornsEarned).toBe(7);
      expect(r.acornsPossible).toBe(30); // 10+20
    });

    it("awarded_acorns 가 null 이면 0 으로 간주", () => {
      const missions = [mkMission({ id: "a", acorns: 5 })];
      const subs = [mkSubmission("a", "APPROVED", null)];
      const r = computePackProgress(missions, subs, 0);
      expect(r.acornsEarned).toBe(0);
      expect(r.completedSlots).toBe(1);
    });
  });

  describe("isMissionUnlocked", () => {
    it("ALWAYS → 항상 unlocked", () => {
      const m = mkMission({ unlock_rule: "ALWAYS" });
      expect(isMissionUnlocked(m, [m], [], 0).unlocked).toBe(true);
    });

    it("SEQUENTIAL: 선행 미션 미완료 → locked", () => {
      const prev = mkMission({ id: "prev", display_order: 1 });
      const cur = mkMission({
        id: "cur",
        display_order: 2,
        unlock_rule: "SEQUENTIAL",
        unlock_previous_id: "prev",
      });
      const r = isMissionUnlocked(cur, [prev, cur], [], 0);
      expect(r.unlocked).toBe(false);
      expect(r.reason).toContain(prev.title);
    });

    it("SEQUENTIAL: 선행 미션 완료 → unlocked", () => {
      const prev = mkMission({ id: "prev" });
      const cur = mkMission({
        id: "cur",
        unlock_rule: "SEQUENTIAL",
        unlock_previous_id: "prev",
      });
      const subs = [mkSubmission("prev", "APPROVED", 1)];
      expect(isMissionUnlocked(cur, [prev, cur], subs, 0).unlocked).toBe(true);
    });

    it("SEQUENTIAL: unlock_previous_id 가 null 이면 unlocked (ALWAYS 취급)", () => {
      const m = mkMission({
        unlock_rule: "SEQUENTIAL",
        unlock_previous_id: null,
      });
      expect(isMissionUnlocked(m, [m], [], 0).unlocked).toBe(true);
    });

    it("SEQUENTIAL: 선행 미션이 삭제됨 → unlocked (안전 fallback)", () => {
      const cur = mkMission({
        id: "cur",
        unlock_rule: "SEQUENTIAL",
        unlock_previous_id: "missing",
      });
      expect(isMissionUnlocked(cur, [cur], [], 0).unlocked).toBe(true);
    });

    it("TIER_GATE: acorns 부족 → locked + reason 에 필요 개수 포함", () => {
      const m = mkMission({
        unlock_rule: "TIER_GATE",
        unlock_threshold: 50,
      });
      const r = isMissionUnlocked(m, [m], [], 30);
      expect(r.unlocked).toBe(false);
      expect(r.reason).toContain("20");
    });

    it("TIER_GATE: acorns 충분 → unlocked", () => {
      const m = mkMission({
        unlock_rule: "TIER_GATE",
        unlock_threshold: 50,
      });
      expect(isMissionUnlocked(m, [m], [], 50).unlocked).toBe(true);
      expect(isMissionUnlocked(m, [m], [], 100).unlocked).toBe(true);
    });

    it("TIER_GATE: threshold null 이면 0 으로 취급 → 항상 unlocked", () => {
      const m = mkMission({
        unlock_rule: "TIER_GATE",
        unlock_threshold: null,
      });
      expect(isMissionUnlocked(m, [m], [], 0).unlocked).toBe(true);
    });
  });

  describe("computeTier", () => {
    const tiers: FinalRewardMissionConfig["tiers"] = [
      { threshold: 10, label: "씨앗", reward_desc: "스티커" },
      { threshold: 30, label: "나무", reward_desc: "배지" },
      { threshold: 100, label: "숲", reward_desc: "트로피" },
    ];

    it("빈 tiers → null", () => {
      expect(computeTier([], 100)).toBeNull();
    });

    it("최저 threshold 미달 → null", () => {
      expect(computeTier(tiers, 5)).toBeNull();
    });

    it("정확히 threshold 값 → 해당 티어", () => {
      expect(computeTier(tiers, 10)?.label).toBe("씨앗");
      expect(computeTier(tiers, 30)?.label).toBe("나무");
    });

    it("최상위 threshold 초과 → 최고 티어", () => {
      expect(computeTier(tiers, 999)?.label).toBe("숲");
    });

    it("중간값 → 바로 아래 티어", () => {
      expect(computeTier(tiers, 50)?.label).toBe("나무");
      expect(computeTier(tiers, 99)?.label).toBe("나무");
      expect(computeTier(tiers, 100)?.label).toBe("숲");
    });

    it("tiers 가 정렬돼 있지 않아도 내부에서 정렬 후 동작", () => {
      const unsorted: FinalRewardMissionConfig["tiers"] = [
        { threshold: 100, label: "숲", reward_desc: "트로피" },
        { threshold: 10, label: "씨앗", reward_desc: "스티커" },
        { threshold: 30, label: "나무", reward_desc: "배지" },
      ];
      expect(computeTier(unsorted, 50)?.label).toBe("나무");
    });
  });

  describe("computeTreasureState", () => {
    const config: TreasureMissionConfig = {
      steps: [
        { order: 1, hint_text: "첫 힌트", unlock_rule: "AUTO" },
        { order: 2, hint_text: "둘째 힌트", unlock_rule: "QR" },
        { order: 3, hint_text: "셋째 힌트", unlock_rule: "ANSWER", answer: "X" },
      ],
      final_qr_token: "final-xyz",
    };

    function mkTp(step: number): MissionTreasureProgressRow {
      return {
        id: `tp-${step}`,
        org_mission_id: "m1",
        user_id: "u1",
        step_order: step,
        unlocked_at: "2026-01-01T00:00:00Z",
        unlock_method: "AUTO",
      };
    }

    it("진척도 없음 → currentStepOrder 1, 빈 unlocked, isComplete false", () => {
      const r = computeTreasureState(config, []);
      expect(r.currentStepOrder).toBe(1);
      expect(r.totalSteps).toBe(3);
      expect(r.unlockedSteps).toEqual([]);
      expect(r.isComplete).toBe(false);
    });

    it("1 단계 언락 → currentStepOrder 2", () => {
      const r = computeTreasureState(config, [mkTp(1)]);
      expect(r.unlockedSteps).toEqual([1]);
      expect(r.currentStepOrder).toBe(2);
      expect(r.isComplete).toBe(false);
    });

    it("전체 언락 → isComplete true", () => {
      const r = computeTreasureState(config, [mkTp(1), mkTp(2), mkTp(3)]);
      expect(r.unlockedSteps).toEqual([1, 2, 3]);
      expect(r.isComplete).toBe(true);
      expect(r.currentStepOrder).toBe(4); // maxUnlocked + 1
    });

    it("중복 step 는 set 으로 dedup", () => {
      const r = computeTreasureState(config, [mkTp(1), mkTp(1), mkTp(2)]);
      expect(r.unlockedSteps).toEqual([1, 2]);
    });

    it("순서 뒤섞여도 정렬된 결과", () => {
      const r = computeTreasureState(config, [mkTp(3), mkTp(1), mkTp(2)]);
      expect(r.unlockedSteps).toEqual([1, 2, 3]);
    });

    it("steps 비었으면 totalSteps 0, isComplete false", () => {
      const empty: TreasureMissionConfig = { steps: [], final_qr_token: "t" };
      const r = computeTreasureState(empty, []);
      expect(r.totalSteps).toBe(0);
      expect(r.isComplete).toBe(false);
    });
  });
});
