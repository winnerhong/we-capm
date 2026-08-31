import { describe, expect, it } from "vitest";
import {
  floorSeconds,
  formatElapsed,
  parSecondsFor,
  penaltyForRejected,
  scoreForApproved,
  speedFactor,
} from "./core";

describe("speedFactor — 등수를 가르는 연속량", () => {
  it("기준 시간을 넘기면 보너스가 없다 (그래도 기본점은 받는다)", () => {
    expect(speedFactor(180, 180)).toBe(0);
    expect(speedFactor(999, 180)).toBe(0);
  });

  it("바닥보다 빠르면 0 — 새로고침으로 시계를 0으로 되돌리는 꼼수를 막는다", () => {
    // par 180 → floor 18초
    expect(floorSeconds(180)).toBe(18);
    expect(speedFactor(0, 180)).toBe(0);
    expect(speedFactor(17, 180)).toBe(0);
  });

  it("바닥에서 최댓값 1", () => {
    expect(speedFactor(18, 180)).toBe(1);
  });

  it("바닥과 기준 사이에서는 단조 감소한다", () => {
    const a = speedFactor(30, 180);
    const b = speedFactor(90, 180);
    const c = speedFactor(150, 180);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
    expect(c).toBeGreaterThan(0);
  });

  it("1초만 달라도 값이 갈린다 — 동점이 안 나는 이유", () => {
    expect(speedFactor(90, 180)).not.toBe(speedFactor(91, 180));
  });

  it("음수·NaN 은 0 으로 떨어뜨린다", () => {
    expect(speedFactor(-1, 180)).toBe(0);
    expect(speedFactor(Number.NaN, 180)).toBe(0);
  });
});

describe("scoreForApproved", () => {
  it("소요 시간을 못 쟀으면 기본점만 준다 — 못 잰 것으로 손해 보면 안 된다", () => {
    const s = scoreForApproved({ acorns: 3, elapsedSeconds: null, par: 180 });
    expect(s.base).toBe(300);
    expect(s.speedBonus).toBe(0);
    expect(s.total).toBe(300);
  });

  it("가장 빠른 정상 제출은 기본점의 1.5배까지 받는다", () => {
    const s = scoreForApproved({ acorns: 3, elapsedSeconds: 18, par: 180 });
    expect(s.base).toBe(300);
    expect(s.speedBonus).toBe(150);
    expect(s.total).toBe(450);
  });

  it("느려도 기본점은 깎이지 않는다 — 속도는 가산점만", () => {
    const slow = scoreForApproved({ acorns: 3, elapsedSeconds: 600, par: 180 });
    expect(slow.total).toBe(300);
    expect(slow.total).toBeGreaterThanOrEqual(slow.base);
  });

  it("의심스럽게 빠르면 이유를 남긴다", () => {
    const s = scoreForApproved({ acorns: 3, elapsedSeconds: 2, par: 180 });
    expect(s.speedBonus).toBe(0);
    expect(s.note).toContain("너무 빨라");
  });

  it("도토리 0짜리 미션은 점수도 0", () => {
    const s = scoreForApproved({ acorns: 0, elapsedSeconds: 30, par: 180 });
    expect(s.total).toBe(0);
  });

  it("같은 미션을 푼 두 집은 초가 다르면 점수가 다르다", () => {
    const fast = scoreForApproved({ acorns: 5, elapsedSeconds: 40, par: 180 });
    const slower = scoreForApproved({ acorns: 5, elapsedSeconds: 41, par: 180 });
    expect(fast.total).not.toBe(slower.total);
  });
});

describe("penaltyForRejected", () => {
  it("반려는 기본점의 25% 를 깎는다 (음수)", () => {
    expect(penaltyForRejected(4)).toBe(-100);
  });

  it("두 번 반려면 두 번 깎인다 — 원장이라 누적된다", () => {
    const one = penaltyForRejected(4);
    expect(one + one).toBe(-200);
  });

  it("도토리 0짜리는 깎을 것도 없다", () => {
    expect(penaltyForRejected(0)).toBe(0);
  });

  it("대충 낸 뒤 다시 제대로 낸 집은 처음부터 제대로 낸 집을 못 이긴다", () => {
    const clean = scoreForApproved({ acorns: 4, elapsedSeconds: 60, par: 180 });
    const messy =
      penaltyForRejected(4) +
      scoreForApproved({ acorns: 4, elapsedSeconds: 60, par: 180 }).total;
    expect(messy).toBeLessThan(clean.total);
  });
});

describe("parSecondsFor", () => {
  it("미션 설정이 있으면 그것을 쓴다", () => {
    expect(parSecondsFor("PHOTO", { par_seconds: 45 })).toBe(45);
  });

  it("설정이 없으면 종류별 기본값", () => {
    expect(parSecondsFor("QR_QUIZ", null)).toBe(90);
    expect(parSecondsFor("TREASURE", {})).toBe(600);
  });

  it("모르는 종류·이상한 값은 안전한 기본값으로", () => {
    expect(parSecondsFor("NOPE", null)).toBe(180);
    expect(parSecondsFor("PHOTO", { par_seconds: -5 })).toBe(180);
    expect(parSecondsFor("PHOTO", { par_seconds: "빠름" })).toBe(180);
  });
});

describe("formatElapsed", () => {
  it("분·초로 읽히게", () => {
    expect(formatElapsed(45)).toBe("45초");
    expect(formatElapsed(60)).toBe("1분");
    expect(formatElapsed(80)).toBe("1분 20초");
    expect(formatElapsed(null)).toBe("-");
  });
});
