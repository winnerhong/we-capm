import { describe, expect, it } from "vitest";
import { calcCompleteness, toneForPercent } from "./calculator";
import type { ProfileSchema, ProfileSnapshot } from "./types";

/** 테스트 전용 스키마 픽스처: db_field 2개 + doc_approved 1개 + docs_all_approved 1개 */
function buildSchema(): ProfileSchema {
  return {
    accountType: "partner",
    groups: [
      {
        id: "basic",
        label: "기본 정보",
        icon: "🏷",
        fields: [
          {
            id: "name",
            label: "이름",
            check: { kind: "db_field", column: "name" },
          },
          {
            id: "phone",
            label: "연락처",
            check: { kind: "db_field", column: "phone" },
          },
        ],
      },
      {
        id: "docs",
        label: "서류",
        icon: "📄",
        fields: [
          {
            id: "biz",
            label: "사업자등록증",
            check: { kind: "doc_approved", docType: "BIZ_LICENSE" },
          },
          {
            id: "all",
            label: "필수서류",
            check: {
              kind: "docs_all_approved",
              requiredTypes: ["ID_CARD", "BANK"],
            },
          },
        ],
      },
    ],
  };
}

describe("profile-completeness/calculator.ts", () => {
  describe("calcCompleteness", () => {
    it("모든 필드 완료 → percent 100, completedCount=totalCount, isComplete true", () => {
      const schema = buildSchema();
      const snap: ProfileSnapshot = {
        db: { name: "홍길동", phone: "010" },
        docs: {
          BIZ_LICENSE: "APPROVED",
          ID_CARD: "APPROVED",
          BANK: "APPROVED",
        },
      };
      const r = calcCompleteness(schema, snap);
      expect(r.percent).toBe(100);
      expect(r.completedCount).toBe(r.totalCount);
      expect(r.totalCount).toBe(4);
      expect(r.isComplete).toBe(true);
      expect(r.missing).toHaveLength(0);
    });

    it("빈 snapshot → percent 0, completedCount 0, isComplete false", () => {
      const schema = buildSchema();
      const snap: ProfileSnapshot = { db: {}, docs: {} };
      const r = calcCompleteness(schema, snap);
      expect(r.percent).toBe(0);
      expect(r.completedCount).toBe(0);
      expect(r.totalCount).toBe(4);
      expect(r.isComplete).toBe(false);
      expect(r.missing).toHaveLength(4);
    });

    it("일부 채워짐 (db 1/2 + docs 1/2) → round(2/4*100) = 50", () => {
      const schema = buildSchema();
      const snap: ProfileSnapshot = {
        db: { name: "홍길동", phone: "" }, // phone 은 공백 → 미완
        docs: {
          BIZ_LICENSE: "APPROVED",
          ID_CARD: "APPROVED",
          BANK: "PENDING", // docs_all_approved 는 실패
        },
      };
      const r = calcCompleteness(schema, snap);
      expect(r.completedCount).toBe(2);
      expect(r.totalCount).toBe(4);
      expect(r.percent).toBe(50);
      expect(r.isComplete).toBe(false);
      expect(r.missing.map((m) => m.id).sort()).toEqual(["all", "phone"]);
    });

    it("12개 중 5개 완료 → round(5/12*100) = 42", () => {
      const fields = Array.from({ length: 12 }, (_, i) => ({
        id: `f${i}`,
        label: `필드 ${i}`,
        check: { kind: "db_field" as const, column: `col${i}` },
      }));
      const schema: ProfileSchema = {
        accountType: "partner",
        groups: [{ id: "g", label: "G", icon: "🧪", fields }],
      };
      const db: Record<string, string> = {};
      for (let i = 0; i < 5; i++) db[`col${i}`] = "v";
      const r = calcCompleteness(schema, { db, docs: {} });
      expect(r.completedCount).toBe(5);
      expect(r.totalCount).toBe(12);
      expect(r.percent).toBe(Math.round((5 / 12) * 100));
      expect(r.percent).toBe(42);
    });

    it("db_field 분기: 공백 문자열은 미완료", () => {
      const schema: ProfileSchema = {
        accountType: "partner",
        groups: [
          {
            id: "g",
            label: "G",
            icon: "🧪",
            fields: [
              {
                id: "x",
                label: "X",
                check: { kind: "db_field", column: "x" },
              },
            ],
          },
        ],
      };
      expect(calcCompleteness(schema, { db: { x: "   " }, docs: {} }).percent).toBe(0);
      expect(calcCompleteness(schema, { db: { x: "value" }, docs: {} }).percent).toBe(100);
    });

    it("doc_approved 분기: PENDING 은 미완, APPROVED 만 완료", () => {
      const schema: ProfileSchema = {
        accountType: "partner",
        groups: [
          {
            id: "g",
            label: "G",
            icon: "🧪",
            fields: [
              {
                id: "d",
                label: "D",
                check: { kind: "doc_approved", docType: "T1" },
              },
            ],
          },
        ],
      };
      expect(calcCompleteness(schema, { db: {}, docs: { T1: "PENDING" } }).percent).toBe(0);
      expect(calcCompleteness(schema, { db: {}, docs: { T1: "REJECTED" } }).percent).toBe(0);
      expect(calcCompleteness(schema, { db: {}, docs: { T1: "APPROVED" } }).percent).toBe(100);
      expect(calcCompleteness(schema, { db: {}, docs: {} }).percent).toBe(0);
    });

    it("docs_all_approved: 요구 문서 중 하나라도 미승인이면 false", () => {
      const schema: ProfileSchema = {
        accountType: "partner",
        groups: [
          {
            id: "g",
            label: "G",
            icon: "🧪",
            fields: [
              {
                id: "all",
                label: "모든 서류",
                check: {
                  kind: "docs_all_approved",
                  requiredTypes: ["A", "B"],
                },
              },
            ],
          },
        ],
      };
      expect(
        calcCompleteness(schema, {
          db: {},
          docs: { A: "APPROVED", B: "PENDING" },
        }).percent
      ).toBe(0);
      expect(
        calcCompleteness(schema, {
          db: {},
          docs: { A: "APPROVED", B: "APPROVED" },
        }).percent
      ).toBe(100);
    });

    it("weight 적용: w=3 인 필드 완료 시 weight 가중치 반영", () => {
      const schema: ProfileSchema = {
        accountType: "partner",
        groups: [
          {
            id: "g",
            label: "G",
            icon: "🧪",
            fields: [
              {
                id: "a",
                label: "A",
                weight: 3,
                check: { kind: "db_field", column: "a" },
              },
              {
                id: "b",
                label: "B",
                weight: 1,
                check: { kind: "db_field", column: "b" },
              },
            ],
          },
        ],
      };
      // a 만 채움 → weight 3/4 = 75
      const r = calcCompleteness(schema, { db: { a: "v" }, docs: {} });
      expect(r.totalWeight).toBe(4);
      expect(r.completedWeight).toBe(3);
      expect(r.percent).toBe(75);
      expect(r.completedCount).toBe(1); // count 는 가중치 무시
      expect(r.totalCount).toBe(2);
    });

    it("그룹별 percent 계산 확인", () => {
      const schema = buildSchema();
      const snap: ProfileSnapshot = {
        db: { name: "홍길동", phone: "010" }, // basic 100%
        docs: { BIZ_LICENSE: "APPROVED" }, // docs 50% (1/2)
      };
      const r = calcCompleteness(schema, snap);
      const basic = r.groups.find((g) => g.id === "basic")!;
      const docs = r.groups.find((g) => g.id === "docs")!;
      expect(basic.percent).toBe(100);
      expect(basic.completed).toBe(2);
      expect(docs.percent).toBe(50);
      expect(docs.completed).toBe(1);
    });

    it("빈 스키마 (groups 전체 없음) → percent 100, isComplete false (totalCount=0)", () => {
      const schema: ProfileSchema = { accountType: "partner", groups: [] };
      const r = calcCompleteness(schema, { db: {}, docs: {} });
      expect(r.percent).toBe(100); // totalWeight 0 분기
      expect(r.totalCount).toBe(0);
      expect(r.isComplete).toBe(false); // totalCount=0 가드
    });

    it("boolean true 는 완료, false 는 미완", () => {
      const schema: ProfileSchema = {
        accountType: "partner",
        groups: [
          {
            id: "g",
            label: "G",
            icon: "🧪",
            fields: [
              {
                id: "flag",
                label: "flag",
                check: { kind: "db_field", column: "flag" },
              },
            ],
          },
        ],
      };
      expect(calcCompleteness(schema, { db: { flag: true }, docs: {} }).percent).toBe(100);
      expect(calcCompleteness(schema, { db: { flag: false }, docs: {} }).percent).toBe(0);
    });
  });

  describe("toneForPercent", () => {
    it("100+ → celebrate", () => {
      expect(toneForPercent(100)).toBe("celebrate");
      expect(toneForPercent(120)).toBe("celebrate");
    });
    it("80~99 → emerald", () => {
      expect(toneForPercent(80)).toBe("emerald");
      expect(toneForPercent(99)).toBe("emerald");
    });
    it("50~79 → amber", () => {
      expect(toneForPercent(50)).toBe("amber");
      expect(toneForPercent(79)).toBe("amber");
    });
    it("0~49 → rose", () => {
      expect(toneForPercent(0)).toBe("rose");
      expect(toneForPercent(49)).toBe("rose");
    });
  });
});
