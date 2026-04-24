import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startOfDaysAgoKstIso, startOfTodayKstIso } from "./kst";

const KST_ISO_RE = /^\d{4}-\d{2}-\d{2}T00:00:00\+09:00$/;

describe("kst.ts — KST 자정 경계 헬퍼", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("startOfTodayKstIso()", () => {
    it("반환 포맷이 YYYY-MM-DDT00:00:00+09:00 (KST ISO 정규식)", () => {
      const iso = startOfTodayKstIso();
      expect(iso).toMatch(KST_ISO_RE);
    });

    it("시간 부분이 정확히 00:00:00", () => {
      const iso = startOfTodayKstIso();
      expect(iso.slice(11, 19)).toBe("00:00:00");
    });

    it("오프셋이 +09:00 (KST)", () => {
      const iso = startOfTodayKstIso();
      expect(iso.endsWith("+09:00")).toBe(true);
    });

    it("KST 기준 낮 시간대 — 달력 날짜가 일치", () => {
      vi.useFakeTimers();
      // 2026-04-25 10:00 KST = 2026-04-25 01:00 UTC
      vi.setSystemTime(new Date("2026-04-25T01:00:00Z"));
      expect(startOfTodayKstIso()).toBe("2026-04-25T00:00:00+09:00");
    });

    it("KST 자정 직후 — 한국 기준 새 날짜 반영", () => {
      vi.useFakeTimers();
      // 2026-04-25 00:30 KST = 2026-04-24 15:30 UTC
      vi.setSystemTime(new Date("2026-04-24T15:30:00Z"));
      expect(startOfTodayKstIso()).toBe("2026-04-25T00:00:00+09:00");
    });

    it("UTC는 아직 전날이어도 KST 기준 오늘 반환", () => {
      vi.useFakeTimers();
      // UTC 2026-04-24 23:00 = KST 2026-04-25 08:00
      vi.setSystemTime(new Date("2026-04-24T23:00:00Z"));
      expect(startOfTodayKstIso()).toBe("2026-04-25T00:00:00+09:00");
    });
  });

  describe("startOfDaysAgoKstIso()", () => {
    it("반환 포맷 정규식 일치", () => {
      expect(startOfDaysAgoKstIso(3)).toMatch(KST_ISO_RE);
    });

    it("daysAgo=0 은 startOfTodayKstIso() 와 동일", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-25T10:00:00+09:00"));
      expect(startOfDaysAgoKstIso(0)).toBe(startOfTodayKstIso());
    });

    it("daysAgo=7 은 정확히 7일 전 KST 자정", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-25T10:00:00+09:00"));
      expect(startOfDaysAgoKstIso(7)).toBe("2026-04-18T00:00:00+09:00");
    });

    it("daysAgo=1 은 어제", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-25T10:00:00+09:00"));
      expect(startOfDaysAgoKstIso(1)).toBe("2026-04-24T00:00:00+09:00");
    });

    it("월 경계 케이스 — 4월 1일에서 1일전은 3월 31일", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-01T10:00:00+09:00"));
      expect(startOfDaysAgoKstIso(1)).toBe("2026-03-31T00:00:00+09:00");
    });

    it("년 경계 케이스 — 1월 3일에서 5일전은 전년 12월 29일", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-03T10:00:00+09:00"));
      expect(startOfDaysAgoKstIso(5)).toBe("2025-12-29T00:00:00+09:00");
    });

    it("daysAgo=30 은 대략 30일 전 (4월 25일 → 3월 26일)", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-25T10:00:00+09:00"));
      expect(startOfDaysAgoKstIso(30)).toBe("2026-03-26T00:00:00+09:00");
    });

    it("UTC로 변환해도 정확히 7일 차이 (ms 검증)", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-25T10:00:00+09:00"));
      const today = new Date(startOfTodayKstIso()).getTime();
      const sevenAgo = new Date(startOfDaysAgoKstIso(7)).getTime();
      expect(today - sevenAgo).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });
});
