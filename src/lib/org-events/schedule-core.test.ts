import { describe, expect, it } from "vitest";
import {
  composeStartsAt,
  computeEndsAt,
  DURATION_PRESETS,
  formatDuration,
  HOUR_OPTIONS,
  MAX_DURATION_MIN,
  MIN_DURATION,
  MIN_OPTIONS,
  pad,
  toLocalIsoMinute,
} from "./schedule-core";

describe("pad", () => {
  it("한 자리는 0 을 붙인다", () => {
    expect(pad(0)).toBe("00");
    expect(pad(9)).toBe("09");
    expect(pad(10)).toBe("10");
  });
});

describe("formatDuration", () => {
  it("한 시간 미만은 분만", () => {
    expect(formatDuration(5)).toBe("5분");
    expect(formatDuration(45)).toBe("45분");
  });

  it("딱 떨어지면 분을 안 적는다", () => {
    expect(formatDuration(60)).toBe("1시간");
    expect(formatDuration(120)).toBe("2시간");
  });

  it("스크린샷의 그 값", () => {
    expect(formatDuration(170)).toBe("2시간 50분");
  });

  it("하루를 넘기면 일까지", () => {
    expect(formatDuration(60 * 25)).toBe("1일 1시간");
  });
});

describe("composeStartsAt", () => {
  it("날짜·시·분을 datetime-local 모양으로", () => {
    expect(composeStartsAt("2026-09-12", 9, 40)).toBe("2026-09-12T09:40");
  });

  it("날짜가 없으면 빈 문자열", () => {
    expect(composeStartsAt("", 9, 40)).toBe("");
  });
});

describe("computeEndsAt", () => {
  it("시작 + 기간", () => {
    // 09:40 + 2시간 50분 = 12:30 (스크린샷과 같은 값)
    expect(computeEndsAt("2026-09-12T09:40", 170)).toBe("2026-09-12T12:30");
  });

  it("날짜를 넘어가도 맞다", () => {
    expect(computeEndsAt("2026-09-12T23:30", 60)).toBe("2026-09-13T00:30");
  });

  it("시작이 없으면 빈 문자열", () => {
    expect(computeEndsAt("", 60)).toBe("");
  });

  it("못 읽는 값이면 빈 문자열 — 던지지 않는다", () => {
    expect(computeEndsAt("어제", 60)).toBe("");
  });
});

describe("toLocalIsoMinute", () => {
  it("초는 버리고 분까지만", () => {
    expect(toLocalIsoMinute(new Date(2026, 8, 12, 9, 40, 33))).toBe(
      "2026-09-12T09:40"
    );
  });
});

describe("선택지", () => {
  it("시는 0..23, 분은 5분 단위 12칸", () => {
    expect(HOUR_OPTIONS).toHaveLength(24);
    expect(HOUR_OPTIONS[23]).toBe(23);
    expect(MIN_OPTIONS).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
  });

  it("프리셋은 전부 슬라이더 범위 안이고 5분 단위다", () => {
    for (const p of DURATION_PRESETS) {
      expect(p.mins).toBeGreaterThanOrEqual(MIN_DURATION);
      expect(p.mins).toBeLessThanOrEqual(MAX_DURATION_MIN);
      expect(p.mins % 5).toBe(0);
    }
  });

  it("프리셋 라벨은 formatDuration 과 같은 말을 쓴다", () => {
    // 칩에 "1시간" 이라 적혀 있는데 눌렀더니 위에 "60분" 이 뜨면 같은 값인지
    // 의심하게 된다.
    for (const p of DURATION_PRESETS) {
      expect(formatDuration(p.mins)).toBe(p.label);
    }
  });
});
