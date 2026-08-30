import { describe, expect, it } from "vitest";
import {
  DEFAULT_SURVEY_LEAD_MIN,
  MAX_SURVEY_LEAD_MIN,
  normalizeComment,
  normalizeRating,
  parseSurveyLeadInput,
  ratingStars,
  resolveSurveyGate,
  resolveSurveyOpenAt,
} from "./survey-core";

describe("resolveSurveyGate", () => {
  const base = {
    surveyEnabled: true,
    eventStatus: "ENDED",
    alreadyAnswered: false,
  };

  it("켜져 있고 시작한 행사면 답할 수 있다", () => {
    expect(resolveSurveyGate(base)).toEqual({
      canAnswer: true,
      alreadyAnswered: false,
    });
  });

  it("이미 낸 사람도 답할 수 있다 — 고칠 수 있어야 한다", () => {
    const g = resolveSurveyGate({ ...base, alreadyAnswered: true });
    expect(g.canAnswer).toBe(true);
    if (g.canAnswer) expect(g.alreadyAnswered).toBe(true);
  });

  it("기관이 안 켰으면 닫혀 있다", () => {
    const g = resolveSurveyGate({ ...base, surveyEnabled: false });
    expect(g.canAnswer).toBe(false);
    if (!g.canAnswer) expect(g.reason).toContain("받지 않아요");
  });

  it("시작 전(DRAFT) 행사는 답할 게 없다", () => {
    const g = resolveSurveyGate({ ...base, eventStatus: "DRAFT" });
    expect(g.canAnswer).toBe(false);
    if (!g.canAnswer) expect(g.reason).toContain("시작되면");
  });

  it("진행 중(LIVE)에는 시각이 돼야 열린다 — 행사 초반에 소감을 묻지 않는다", () => {
    const g = resolveSurveyGate({
      ...base,
      eventStatus: "LIVE",
      endsAt: "2026-05-16T13:00:00+09:00",
      openLeadMin: 30,
      now: "2026-05-16T10:00:00+09:00",
    });
    expect(g.canAnswer).toBe(false);
    if (!g.canAnswer) expect(g.reason).toContain("12:30");
  });
});

describe("normalizeRating", () => {
  it("1~5 만 통과", () => {
    expect(normalizeRating(1)).toBe(1);
    expect(normalizeRating(5)).toBe(5);
  });

  it("범위를 벗어나면 버린다 — 0점·6점이 저장되면 평균이 망가진다", () => {
    expect(normalizeRating(0)).toBeNull();
    expect(normalizeRating(6)).toBeNull();
    expect(normalizeRating(-3)).toBeNull();
  });

  it("문자열 숫자도 받는다 (폼에서 문자열로 온다)", () => {
    expect(normalizeRating("4")).toBe(4);
  });

  it("숫자가 아니면 버린다", () => {
    expect(normalizeRating("좋아요")).toBeNull();
    expect(normalizeRating(null)).toBeNull();
    expect(normalizeRating(undefined)).toBeNull();
  });

  it("소수는 반올림", () => {
    expect(normalizeRating(4.4)).toBe(4);
    expect(normalizeRating(4.6)).toBe(5);
  });
});

describe("normalizeComment", () => {
  it("앞뒤 공백을 턴다", () => {
    expect(normalizeComment("  좋았어요 ")).toBe("좋았어요");
  });

  it("공백만 있으면 없는 것", () => {
    expect(normalizeComment("   ")).toBeNull();
    expect(normalizeComment("")).toBeNull();
  });

  it("문자열이 아니면 없는 것", () => {
    expect(normalizeComment(42)).toBeNull();
  });

  it("너무 길면 자른다", () => {
    expect(normalizeComment("가".repeat(900))?.length).toBe(500);
  });
});

describe("ratingStars", () => {
  it("별 다섯 칸을 채운다", () => {
    expect(ratingStars(5)).toBe("★★★★★");
    expect(ratingStars(3)).toBe("★★★☆☆");
  });

  it("평균값(소수)도 반올림해 채운다", () => {
    expect(ratingStars(4.4)).toBe("★★★★☆");
  });

  it("범위 밖 값이 들어와도 다섯 칸을 넘지 않는다", () => {
    expect(ratingStars(9)).toBe("★★★★★");
    expect(ratingStars(-1)).toBe("☆☆☆☆☆");
  });
});

/* ========================================================================== */
/* 언제 열리나 — 시계가 스위치를 대신 눌러준다                                 */
/* ========================================================================== */

describe("resolveSurveyOpenAt", () => {
  // 2026-05-16(토) 09:50 ~ 13:00 KST — 실제 「참좋은 미션트래킹」 시각.
  const ENDS = "2026-05-16T13:00:00+09:00";

  it("종료 30분 전을 계산하고 문구까지 만든다", () => {
    const r = resolveSurveyOpenAt(ENDS, 30);
    expect(r).not.toBeNull();
    expect(r!.clock).toBe("오후 12:30");
    expect(r!.label).toBe("오후 12:30부터 (30분 전)");
  });

  it("행사 시각이 바뀌면 개방 시각이 따라온다 (분으로 저장하는 이유)", () => {
    const later = resolveSurveyOpenAt("2026-05-16T15:00:00+09:00", 30);
    expect(later!.clock).toBe("오후 02:30");
  });

  it("null·0·음수는 자동 개방 없음 — 기관이 종료를 눌러야 열린다", () => {
    expect(resolveSurveyOpenAt(ENDS, null)).toBeNull();
    expect(resolveSurveyOpenAt(ENDS, 0)).toBeNull();
    expect(resolveSurveyOpenAt(ENDS, -10)).toBeNull();
  });

  it("종료 시각이 없거나 깨져 있으면 계산할 기준이 없다", () => {
    expect(resolveSurveyOpenAt(null, 30)).toBeNull();
    expect(resolveSurveyOpenAt("not-a-date", 30)).toBeNull();
  });

  it("종료 시각을 날짜만 적은 행사(자정)는 자동으로 열지 않는다", () => {
    expect(resolveSurveyOpenAt("2026-05-16T00:00:00+09:00", 30)).toBeNull();
  });

  it("undefined(컬럼 미적용)면 기본 30분으로 폴백한다", () => {
    const r = resolveSurveyOpenAt(ENDS, undefined);
    expect(r!.leadMin).toBe(DEFAULT_SURVEY_LEAD_MIN);
    expect(r!.clock).toBe("오후 12:30");
  });

  it("상한을 넘기면 잘라낸다", () => {
    const r = resolveSurveyOpenAt(ENDS, 9999);
    expect(r!.leadMin).toBe(MAX_SURVEY_LEAD_MIN);
  });
});

describe("parseSurveyLeadInput", () => {
  it("숫자를 그대로, 빈 값·0·문자는 자동 안 씀(null)", () => {
    expect(parseSurveyLeadInput("40")).toBe(40);
    expect(parseSurveyLeadInput("")).toBeNull();
    expect(parseSurveyLeadInput("0")).toBeNull();
    expect(parseSurveyLeadInput("어쩌구")).toBeNull();
  });

  it("상한을 넘기면 잘라낸다", () => {
    expect(parseSurveyLeadInput("9999")).toBe(MAX_SURVEY_LEAD_MIN);
  });
});

describe("resolveSurveyGate — 시각까지 포함한 판정", () => {
  const ENDS = "2026-05-16T13:00:00+09:00";
  const base = {
    surveyEnabled: true,
    eventStatus: "LIVE",
    alreadyAnswered: false,
    endsAt: ENDS,
    openLeadMin: 30,
  };

  it("30분 전이 되기 1분 전에는 아직 닫혀 있고, 언제 열리는지 말해준다", () => {
    const g = resolveSurveyGate({
      ...base,
      now: "2026-05-16T12:29:00+09:00",
    });
    expect(g.canAnswer).toBe(false);
    if (!g.canAnswer) {
      expect(g.reason).toBe("오후 12:30부터 열려요");
      expect(g.opensAt).not.toBeNull();
    }
  });

  it("정각이 되면 열린다 — 아직 행사장에 있을 때 받는 게 핵심이다", () => {
    const g = resolveSurveyGate({
      ...base,
      now: "2026-05-16T12:30:00+09:00",
    });
    expect(g.canAnswer).toBe(true);
  });

  it("행사가 끝난 뒤에도 계속 열려 있다 — 늦게 낸 답을 버릴 이유가 없다", () => {
    const g = resolveSurveyGate({
      ...base,
      now: "2026-05-20T09:00:00+09:00",
    });
    expect(g.canAnswer).toBe(true);
  });

  it("기관이 종료를 누르면 시각을 따지지 않는다 — 사람의 결정이 시계보다 위다", () => {
    const g = resolveSurveyGate({
      ...base,
      eventStatus: "ENDED",
      endsAt: null,
      openLeadMin: null,
      now: "2026-05-16T09:00:00+09:00",
    });
    expect(g.canAnswer).toBe(true);
  });

  it("자동 개방을 안 쓰는 행사는 종료 전까지 닫혀 있다", () => {
    const g = resolveSurveyGate({
      ...base,
      openLeadMin: null,
      now: "2026-05-16T12:59:00+09:00",
    });
    expect(g.canAnswer).toBe(false);
    if (!g.canAnswer) expect(g.reason).toBe("행사가 끝나면 열려요");
  });

  it("스위치가 꺼져 있으면 시각이 됐어도 열리지 않는다", () => {
    const g = resolveSurveyGate({
      ...base,
      surveyEnabled: false,
      now: "2026-05-16T12:59:00+09:00",
    });
    expect(g.canAnswer).toBe(false);
  });

  it("예정(DRAFT) 행사는 답할 게 없다", () => {
    const g = resolveSurveyGate({
      ...base,
      eventStatus: "DRAFT",
      now: "2026-05-16T12:59:00+09:00",
    });
    expect(g.canAnswer).toBe(false);
    if (!g.canAnswer) expect(g.reason).toBe("행사가 시작되면 열려요");
  });

  it("이미 낸 사람도 열려 있다 — 고칠 수 있어야 한다", () => {
    const g = resolveSurveyGate({
      ...base,
      alreadyAnswered: true,
      now: "2026-05-16T12:40:00+09:00",
    });
    expect(g.canAnswer).toBe(true);
    if (g.canAnswer) expect(g.alreadyAnswered).toBe(true);
  });
});
