import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENTRY_LEAD_MIN,
  MAX_ENTRY_LEAD_MIN,
  parseEntryLeadInput,
  resolveEntryTime,
} from "./entry-time";

// 2026-09-12(토) 09:40 KST 시작 — 실제 「Slow 마라톤」 행사 시각.
const START = "2026-09-12T09:40:00+09:00";

describe("resolveEntryTime", () => {
  it("20분 전을 계산하고 문구까지 만든다", () => {
    const r = resolveEntryTime(START, 20);
    expect(r).not.toBeNull();
    expect(r!.clock).toBe("오전 09:20");
    expect(r!.leadMin).toBe(20);
    expect(r!.label).toBe("오전 09:20부터 (20분 전)");
  });

  it("40분 전으로 바꾸면 시각도 문구도 같이 움직인다", () => {
    const r = resolveEntryTime(START, 40);
    expect(r!.clock).toBe("오전 09:00");
    expect(r!.label).toBe("오전 09:00부터 (40분 전)");
  });

  it("행사 시각이 바뀌면 입장시간이 따라온다 (분 저장의 이유)", () => {
    const later = resolveEntryTime("2026-09-12T10:00:00+09:00", 20);
    expect(later!.clock).toBe("오전 09:40");
  });

  /* ── 숨김 조건 ── */

  it("null 이면 숨김 (관리자가 안 쓰기로 함)", () => {
    expect(resolveEntryTime(START, null)).toBeNull();
  });

  it("0 도 숨김 — 0을 넣는 의도는 '안 씀' 이다", () => {
    expect(resolveEntryTime(START, 0)).toBeNull();
  });

  it("음수는 숨김", () => {
    expect(resolveEntryTime(START, -10)).toBeNull();
  });

  it("행사 시작 시각이 없으면 숨김 (계산 기준이 없다)", () => {
    expect(resolveEntryTime(null, 20)).toBeNull();
    expect(resolveEntryTime("", 20)).toBeNull();
  });

  it("행사 시작 시각이 깨져 있으면 숨김", () => {
    expect(resolveEntryTime("not-a-date", 20)).toBeNull();
  });

  /* ── 배포 순서 안전장치 ── */

  it("undefined(컬럼 미적용)면 기본 20분으로 폴백해 화면이 비지 않는다", () => {
    const r = resolveEntryTime(START, undefined);
    expect(r!.leadMin).toBe(DEFAULT_ENTRY_LEAD_MIN);
    expect(r!.clock).toBe("오전 09:20");
  });

  it("undefined 와 null 은 다르다 — null 은 폴백하지 않고 숨긴다", () => {
    expect(resolveEntryTime(START, undefined)).not.toBeNull();
    expect(resolveEntryTime(START, null)).toBeNull();
  });

  /* ── 경계 ── */

  it("상한을 넘으면 240분으로 잘린다", () => {
    const r = resolveEntryTime(START, 999);
    expect(r!.leadMin).toBe(MAX_ENTRY_LEAD_MIN);
  });

  it("입장 시각이 정확히 자정이면 숨긴다 (문구가 깨지므로)", () => {
    // 00:20 시작 − 20분 = 00:00
    expect(resolveEntryTime("2026-09-12T00:20:00+09:00", 20)).toBeNull();
  });
});

describe("parseEntryLeadInput", () => {
  it("숫자 문자열을 그대로 읽는다", () => {
    expect(parseEntryLeadInput("40")).toBe(40);
  });

  it("빈 값 · 0 · 공백은 숨김(null)", () => {
    expect(parseEntryLeadInput("")).toBeNull();
    expect(parseEntryLeadInput("   ")).toBeNull();
    expect(parseEntryLeadInput("0")).toBeNull();
  });

  it("숫자가 아니면 숨김", () => {
    expect(parseEntryLeadInput("abc")).toBeNull();
  });

  it("상한을 넘으면 잘린다", () => {
    expect(parseEntryLeadInput("9999")).toBe(MAX_ENTRY_LEAD_MIN);
  });

  it("소수는 내림", () => {
    expect(parseEntryLeadInput("20.9")).toBe(20);
  });
});
