import { describe, expect, it } from "vitest";
import {
  DURATION_SCALES,
  addMinutesToLocalInput,
  composeLocalInput,
  deriveDurationMin,
  formatDurationKo,
  minuteOptions,
  splitLocalInput,
} from "./duration-range";

describe("formatDurationKo", () => {
  it("한 시간 미만은 분만", () => {
    expect(formatDurationKo(5)).toBe("5분");
    expect(formatDurationKo(55)).toBe("55분");
  });

  it("행사 길이 — 2시간 50분", () => {
    expect(formatDurationKo(170)).toBe("2시간 50분");
  });

  it("딱 떨어지면 0 단위를 붙이지 않는다", () => {
    expect(formatDurationKo(60)).toBe("1시간");
    expect(formatDurationKo(60 * 24)).toBe("1일");
    expect(formatDurationKo(60 * 24 * 7)).toBe("7일");
  });

  it("스탬프북처럼 어중간한 값도 읽힌다", () => {
    // 7일 4시간 56분 — 예전 화면에서 종료를 직접 찍어 저장된 값
    expect(formatDurationKo(7 * 1440 + 296)).toBe("7일 4시간 56분");
  });

  it("0 이하는 표시하지 않는다", () => {
    expect(formatDurationKo(0)).toBe("-");
    expect(formatDurationKo(-10)).toBe("-");
  });
});

describe("splitLocalInput / composeLocalInput", () => {
  it("왕복해도 같은 값", () => {
    const v = "2026-09-12T09:30";
    const p = splitLocalInput(v)!;
    expect(p).toEqual({ date: "2026-09-12", hour: 9, minute: 30 });
    expect(composeLocalInput(p.date, p.hour, p.minute)).toBe(v);
  });

  it("빈 값·깨진 값은 null", () => {
    expect(splitLocalInput("")).toBeNull();
    expect(splitLocalInput(null)).toBeNull();
    expect(splitLocalInput("2026-09-12")).toBeNull();
  });

  it("날짜가 없으면 조합하지 않는다 (시각만 있는 값은 무의미)", () => {
    expect(composeLocalInput("", 9, 30)).toBe("");
  });

  it("범위를 벗어난 시/분은 잘라 넣는다", () => {
    expect(composeLocalInput("2026-09-12", 99, 99)).toBe("2026-09-12T23:59");
  });
});

describe("addMinutesToLocalInput", () => {
  it("종료 일시를 계산한다 — 09:40 + 2시간 50분 = 12:30", () => {
    expect(addMinutesToLocalInput("2026-09-12T09:40", 170)).toBe(
      "2026-09-12T12:30"
    );
  });

  it("자정을 넘어 날짜가 바뀐다", () => {
    expect(addMinutesToLocalInput("2026-09-12T23:30", 60)).toBe(
      "2026-09-13T00:30"
    );
  });

  it("일 단위 기간도 같은 시각으로 떨어진다 (스탬프북 1주)", () => {
    expect(addMinutesToLocalInput("2026-09-12T09:30", 7 * 1440)).toBe(
      "2026-09-19T09:30"
    );
  });

  it("월을 넘어간다", () => {
    expect(addMinutesToLocalInput("2026-09-30T10:00", 2 * 1440)).toBe(
      "2026-10-02T10:00"
    );
  });

  it("시작이 없으면 빈 문자열 — 종료만 남기지 않는다", () => {
    expect(addMinutesToLocalInput("", 60)).toBe("");
    expect(addMinutesToLocalInput("not-a-date", 60)).toBe("");
  });
});

describe("deriveDurationMin", () => {
  it("저장된 두 시각의 간격을 읽는다", () => {
    expect(
      deriveDurationMin("2026-09-12T09:40", "2026-09-12T12:30", "hours")
    ).toBe(170);
  });

  it("일 눈금에서도 실제 간격 그대로 (반올림하지 않는다)", () => {
    // 손대기 전까지는 기존 값이 튀지 않아야 한다
    expect(
      deriveDurationMin("2026-09-12T09:30", "2026-09-19T14:26", "days")
    ).toBe(7 * 1440 + 296);
  });

  it("값이 없으면 눈금별 기본 기간", () => {
    expect(deriveDurationMin("", "", "hours")).toBe(
      DURATION_SCALES.hours.defaultMin
    );
    expect(deriveDurationMin("2026-09-12T09:30", "", "days")).toBe(
      DURATION_SCALES.days.defaultMin
    );
  });

  it("종료가 시작보다 빠르면 기본값 — 음수 기간은 슬라이더에 없다", () => {
    expect(
      deriveDurationMin("2026-09-12T12:00", "2026-09-12T09:00", "hours")
    ).toBe(DURATION_SCALES.hours.defaultMin);
  });

  it("슬라이더 범위를 넘는 기존 값은 잘린다", () => {
    // 1년짜리 스탬프북 → 6개월(상한)
    expect(
      deriveDurationMin("2026-01-01T09:00", "2027-01-01T09:00", "days")
    ).toBe(DURATION_SCALES.days.maxMin);
  });

  it("시 눈금 하한 아래(1분)도 잘린다", () => {
    expect(
      deriveDurationMin("2026-09-12T09:00", "2026-09-12T09:01", "hours")
    ).toBe(DURATION_SCALES.hours.minMin);
  });
});

describe("minuteOptions", () => {
  it("기본은 5분 단위 12개", () => {
    const o = minuteOptions(0);
    expect(o).toHaveLength(12);
    expect(o[0]).toBe(0);
    expect(o.at(-1)).toBe(55);
  });

  it("5의 배수가 아닌 기존 값은 목록에 끼워 넣는다", () => {
    // 이게 없으면 09:33 이 셀렉터에서 사라지고 저장 때 시각이 바뀐다
    const o = minuteOptions(33);
    expect(o).toContain(33);
    expect(o).toHaveLength(13);
    expect(o.indexOf(33)).toBe(o.indexOf(30) + 1);
  });

  it("이미 있는 값은 중복으로 넣지 않는다", () => {
    expect(minuteOptions(30)).toHaveLength(12);
  });
});

describe("눈금 설정", () => {
  it("일 눈금은 1주 스탬프북을 담을 수 있다 (시 눈금은 못 담는다)", () => {
    expect(DURATION_SCALES.days.maxMin).toBeGreaterThanOrEqual(7 * 1440);
    expect(DURATION_SCALES.hours.maxMin).toBeLessThan(7 * 1440);
  });

  it("모든 프리셋이 슬라이더 범위 안", () => {
    for (const key of ["hours", "days"] as const) {
      const cfg = DURATION_SCALES[key];
      for (const p of cfg.presets) {
        expect(p.mins).toBeGreaterThanOrEqual(cfg.minMin);
        expect(p.mins).toBeLessThanOrEqual(cfg.maxMin);
      }
    }
  });
});
