import { describe, expect, it } from "vitest";
import { buildAcornGuide } from "./acorn-guide-core";

describe("buildAcornGuide", () => {
  it("같은 종류 미션은 한 줄로 묶는다 — 5개를 5줄로 늘어놓으면 안내가 아니다", () => {
    const g = buildAcornGuide({
      missions: [
        { kind: "PHOTO", acorns: 3 },
        { kind: "PHOTO", acorns: 3 },
        { kind: "PHOTO", acorns: 3 },
      ],
    });
    expect(g).toHaveLength(1);
    expect(g[0].detail).toBe("3개 · 하나당 +3");
  });

  it("같은 종류인데 값이 다르면 범위로 적는다", () => {
    const g = buildAcornGuide({
      missions: [
        { kind: "PHOTO", acorns: 2 },
        { kind: "PHOTO", acorns: 5 },
      ],
    });
    expect(g[0].detail).toBe("2개 · 하나당 +2~5");
  });

  it("한 개뿐이면 개수를 세지 않는다", () => {
    const g = buildAcornGuide({ missions: [{ kind: "QR_QUIZ", acorns: 1 }] });
    expect(g[0].detail).toBe("하나당 +1");
  });

  it("많이 주는 미션이 위로 — 궁금한 건 '뭘 하면 제일 많이 받나' 다", () => {
    const g = buildAcornGuide({
      missions: [
        { kind: "QR_QUIZ", acorns: 1 },
        { kind: "TREASURE", acorns: 8 },
        { kind: "PHOTO", acorns: 3 },
      ],
    });
    expect(g.map((i) => i.detail)).toEqual([
      "하나당 +8",
      "하나당 +3",
      "하나당 +1",
    ]);
  });

  it("최종 보상은 '모으는 법' 이 아니라서 미션 목록에서 뺀다", () => {
    const g = buildAcornGuide({
      missions: [
        { kind: "PHOTO", acorns: 3 },
        { kind: "FINAL_REWARD", acorns: 0 },
      ],
    });
    expect(g).toHaveLength(1);
  });

  it("좋아요는 피드를 켠 행사에서만 — 끈 행사에 적으면 거짓말이 된다", () => {
    expect(
      buildAcornGuide({ missions: [], feedEnabled: false }).length
    ).toBe(0);
    const on = buildAcornGuide({ missions: [], feedEnabled: true });
    expect(on).toHaveLength(1);
    expect(on[0].detail).toContain("사진당 5개까지");
  });

  it("좋아요 상한이 바뀌면 문구도 따라간다", () => {
    const g = buildAcornGuide({
      missions: [],
      feedEnabled: true,
      likeAcornCap: 3,
    });
    expect(g[0].detail).toContain("사진당 3개까지");
  });

  it("최종 보상 문턱은 가장 낮은 것 하나만 — 전부 늘어놓으면 표가 된다", () => {
    const g = buildAcornGuide({
      missions: [],
      tiers: [
        { label: "은도토리", threshold: 30 },
        { label: "금도토리", threshold: 50 },
        { label: "동도토리", threshold: 10 },
      ],
    });
    expect(g).toHaveLength(1);
    expect(g[0].label).toBe("동도토리");
    expect(g[0].detail).toBe("10개부터 · 최고 50개");
  });

  it("문턱이 하나면 범위를 적지 않는다", () => {
    const g = buildAcornGuide({
      missions: [],
      tiers: [{ label: "완주 선물", threshold: 20 }],
    });
    expect(g[0].detail).toBe("20개 모으면");
  });

  it("망가진 문턱(0·없음)은 무시한다", () => {
    const g = buildAcornGuide({
      missions: [],
      tiers: [{ label: "?", threshold: 0 }, { label: "?" }],
    });
    expect(g).toHaveLength(0);
  });

  it("아무것도 설정되지 않은 행사면 빈 배열 — 빈 안내는 띄우지 않는다", () => {
    expect(buildAcornGuide({ missions: [] })).toEqual([]);
  });

  it("모르는 미션 종류도 지워지지 않고 기본 아이콘으로 남는다", () => {
    const g = buildAcornGuide({ missions: [{ kind: "FUTURE_KIND", acorns: 4 }] });
    expect(g).toHaveLength(1);
    expect(g[0].icon).toBe("🌿");
  });
});
