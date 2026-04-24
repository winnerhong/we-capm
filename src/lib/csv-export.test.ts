import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatDateKR, splitClassName, todayISO, toCSV } from "./csv-export";

const BOM = "﻿";

describe("csv-export.ts", () => {
  describe("toCSV", () => {
    it("단순 행: 헤더 + 본문 생성 (BOM, CRLF 헤더 구분자)", () => {
      const csv = toCSV(
        [{ a: 1, b: "x" }],
        [
          { key: "a", label: "A" },
          { key: "b", label: "B" },
        ]
      );
      // BOM 포함, 헤더-본문 구분은 CRLF
      expect(csv).toBe(`${BOM}"A","B"\r\n"1","x"`);
    });

    it("모든 값이 따옴표로 감싸진다 (구현 사양)", () => {
      const csv = toCSV(
        [{ name: "홍길동" }],
        [{ key: "name", label: "이름" }]
      );
      expect(csv).toContain('"이름"');
      expect(csv).toContain('"홍길동"');
    });

    it("따옴표 escape (RFC 4180 — 따옴표는 두 번 반복)", () => {
      const csv = toCSV(
        [{ x: 'he said "hi", ok' }],
        [{ key: "x", label: "X" }]
      );
      // 원본의 " → "" 로 변환되고 전체가 "…" 로 감싸짐
      expect(csv).toContain('"he said ""hi"", ok"');
    });

    it("콤마 포함 값도 따옴표 감싸기로 안전하게 처리", () => {
      const csv = toCSV(
        [{ x: "a,b,c" }],
        [{ key: "x", label: "X" }]
      );
      expect(csv).toContain('"a,b,c"');
    });

    it("null / undefined → bare 빈 문자열 (따옴표 wrap 없음)", () => {
      const csv = toCSV(
        [{ a: null, b: undefined }] as Array<{ a: unknown; b: unknown }>,
        [
          { key: "a", label: "A" },
          { key: "b", label: "B" },
        ]
      );
      // 구현: null/undefined 는 escape 함수가 bare "" 반환 (따옴표 wrap 없음)
      // → 행은 "," 로 구분된 빈 두 필드
      expect(csv).toBe(`${BOM}"A","B"\r\n,`);
    });

    it("빈 rows 입력 시 BOM + 헤더 + CRLF 만", () => {
      const csv = toCSV(
        [],
        [
          { key: "a", label: "A" },
          { key: "b", label: "B" },
        ] as const
      );
      expect(csv).toBe(`${BOM}"A","B"\r\n`);
    });

    it("여러 행은 \\n 으로 구분", () => {
      const csv = toCSV(
        [
          { a: 1 },
          { a: 2 },
          { a: 3 },
        ],
        [{ key: "a", label: "A" }]
      );
      expect(csv).toBe(`${BOM}"A"\r\n"1"\n"2"\n"3"`);
    });

    it("숫자는 String() 으로 변환되어 따옴표 감싸짐", () => {
      const csv = toCSV(
        [{ n: 42 }],
        [{ key: "n", label: "N" }]
      );
      expect(csv).toContain('"42"');
    });
  });

  describe("formatDateKR", () => {
    it("null → 빈 문자열", () => {
      expect(formatDateKR(null)).toBe("");
    });

    it("undefined → 빈 문자열", () => {
      expect(formatDateKR(undefined)).toBe("");
    });

    it("빈 문자열 → 빈 문자열", () => {
      expect(formatDateKR("")).toBe("");
    });

    it("invalid 문자열 → 빈 문자열 (NaN fallback)", () => {
      expect(formatDateKR("invalid")).toBe("");
      expect(formatDateKR("not-a-date")).toBe("");
    });

    it("유효한 ISO 문자열 → YYYY-MM-DD HH:mm 포맷", () => {
      // 로컬 타임존 영향 — 정규식 검증
      const out = formatDateKR("2026-04-25T10:30:00+09:00");
      expect(out).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it("한 자릿수 월·일·시·분도 0-padding", () => {
      // KST 기준 2026-01-02 03:04
      const out = formatDateKR("2026-01-02T03:04:00+09:00");
      expect(out).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
      // 포맷 길이 16자 고정 (YYYY-MM-DD HH:mm)
      expect(out.length).toBe(16);
    });
  });

  describe("todayISO", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("YYYY-MM-DD 포맷", () => {
      expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("길이 10 (UTC 날짜)", () => {
      expect(todayISO().length).toBe(10);
    });

    it("고정 시점에서 UTC 기준 날짜", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-25T15:00:00Z"));
      // toISOString().slice(0,10) → UTC
      expect(todayISO()).toBe("2026-04-25");
    });
  });

  describe("splitClassName", () => {
    it('브래킷 포맷 "[1반] 홍길동" → className + name', () => {
      const out = splitClassName("[1반] 홍길동");
      expect(out).toEqual({ className: "1반", name: "홍길동" });
    });

    it("브래킷 없을 때 className 빈 문자열", () => {
      const out = splitClassName("홍길동");
      expect(out).toEqual({ className: "", name: "홍길동" });
    });

    it("브래킷 안 값이 있고 뒤가 비어있을 때 원본을 name 으로", () => {
      // 매치되는데 그룹2가 비어있으면 || raw 로 폴백 (구현 사양)
      const out = splitClassName("[2반] ");
      expect(out.className).toBe("2반");
      // 폴백으로 원본 raw 반환
      expect(out.name).toBe("[2반] ");
    });

    it("브래킷 안 여러 글자 (반 이름)", () => {
      const out = splitClassName("[햇살반] 김철수");
      expect(out).toEqual({ className: "햇살반", name: "김철수" });
    });

    it("브래킷 뒤 공백 여러 개도 허용", () => {
      const out = splitClassName("[3반]   영희");
      expect(out).toEqual({ className: "3반", name: "영희" });
    });

    it("빈 문자열 입력", () => {
      const out = splitClassName("");
      expect(out).toEqual({ className: "", name: "" });
    });
  });
});
