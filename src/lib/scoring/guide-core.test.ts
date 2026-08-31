import { describe, expect, it } from "vitest";
import { buildScoreRules, SCORE_RULE_NOTES } from "./guide-core";
import { REJECT_PENALTY_RATIO, SPEED_BONUS_RATIO } from "./core";

describe("buildScoreRules", () => {
  it("규칙 세 줄 — 기본 · 속도 · 반려", () => {
    const r = buildScoreRules(["PHOTO"]);
    expect(r).toHaveLength(3);
    expect(r.map((x) => x.tone)).toEqual(["base", "bonus", "penalty"]);
  });

  it("숫자를 손으로 적지 않는다 — 상수를 바꾸면 안내도 바뀐다", () => {
    const r = buildScoreRules(["PHOTO"]);
    expect(r[1].detail).toContain(`+${Math.round(SPEED_BONUS_RATIO * 100)}%`);
    expect(r[2].detail).toContain(`−${Math.round(REJECT_PENALTY_RATIO * 100)}%`);
  });

  it("켜져 있는 미션의 기준 시간만 예시로 든다", () => {
    const r = buildScoreRules(["QR_QUIZ"]);
    expect(r[1].detail).toContain("1분 30초"); // QR 90초
    expect(r[1].detail).not.toContain("10분"); // 보물찾기는 안 켜져 있다
  });

  it("예시는 짧은 것부터 셋까지 — 다 늘어놓으면 안내가 표가 된다", () => {
    const r = buildScoreRules([
      "TREASURE",
      "PHOTO",
      "QR_QUIZ",
      "COOP",
      "RADIO",
    ]);
    const parts = r[1].detail.split("·");
    expect(parts).toHaveLength(3);
    // 가장 짧은 QR(90초)이 먼저
    expect(parts[0]).toContain("1분 30초");
  });

  it("최종 보상은 기준 시간 예시에서 뺀다 — 모아서 받는 것이지 푸는 게 아니다", () => {
    const r = buildScoreRules(["FINAL_REWARD"]);
    // 예시로 들 미션이 없으니 규칙만 적힌 폴백 문구가 나온다.
    expect(r[1].detail).not.toContain("최종 보상");
    expect(r[1].detail).toBe("기준 시간 안에 끝내면 최대 +50%");
  });

  it("미션 종류를 모르면 예시 없이 규칙만", () => {
    const r = buildScoreRules([]);
    expect(r[1].detail).toContain("기준 시간 안에");
  });

  it("도토리가 깎이지 않는다는 사실을 반려 줄에 적는다", () => {
    expect(buildScoreRules([])[2].detail).toContain("도토리는 안 깎여요");
  });

  it("느려도 손해가 없다는 것을 반드시 말한다 — 없으면 아이를 재촉하게 된다", () => {
    expect(SCORE_RULE_NOTES.some((n) => n.includes("느려도"))).toBe(true);
  });
});
