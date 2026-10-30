import { describe, expect, it } from "vitest";
import { computeApplicationStats, NO_CLASS_LABEL } from "./application-stats";
import type { OrgEventApplicationRow } from "./types";

function app(
  over: Partial<OrgEventApplicationRow>
): OrgEventApplicationRow {
  return {
    id: "a1",
    event_id: "e1",
    org_id: "o1",
    phone: "01012345678",
    children: [],
    companions: [],
    party_size: 0,
    status: "APPROVED",
    note: null,
    approved_user_id: null,
    reviewed_by: null,
    reviewed_at: null,
    canceled_at: null,
    created_at: "2026-10-29T12:00:00+09:00",
    ...over,
  } as OrgEventApplicationRow;
}

describe("computeApplicationStats", () => {
  it("빈 목록이면 전부 0", () => {
    const s = computeApplicationStats([]);
    expect(s.familyCount).toBe(0);
    expect(s.headcount.total).toBe(0);
    expect(s.avgPartySize).toBe(0);
    expect(s.byClass).toEqual([]);
  });

  it("인원·반별·동반 구성·조부모 가족을 센다", () => {
    const s = computeApplicationStats([
      app({
        id: "a1",
        children: [
          { name: "김하나", class_name: "토끼반" },
          { name: "김두리", class_name: "토끼반" },
        ],
        companions: [
          { label: "엄마", kind: "ADULT" },
          { label: "할머니", kind: "SENIOR" },
        ],
      }),
      app({
        id: "a2",
        children: [{ name: "이세모", class_name: "" }],
        companions: [
          { label: "엄마", kind: "ADULT" },
          { label: "동생", kind: "CHILD" },
        ],
        created_at: "2026-10-30T09:00:00+09:00",
      }),
    ]);

    expect(s.familyCount).toBe(2);
    // 유아 = 원아 3 + 아동 동반 1, 성인 2, 조부모 1
    expect(s.headcount).toEqual({
      childCount: 4,
      adultCount: 2,
      seniorCount: 1,
      total: 7,
    });
    expect(s.avgPartySize).toBe(3.5);
    expect(s.seniorFamilyCount).toBe(1);

    // 반별 — 토끼반: 원아 2·가족 1·총 4명, 미지정: 원아 1·가족 1·총 3명
    expect(s.byClass).toEqual([
      { className: "토끼반", familyCount: 1, childCount: 2, personTotal: 4 },
      {
        className: NO_CLASS_LABEL,
        familyCount: 1,
        childCount: 1,
        personTotal: 3,
      },
    ]);

    // 동반 구성 — 엄마 2가 맨 앞.
    expect(s.byCompanionLabel[0]).toEqual({
      label: "엄마",
      kind: "ADULT",
      count: 2,
    });

    // 추이 — 과거 → 현재 순.
    expect(s.byDate.map((d) => d.count)).toEqual([1, 1]);
  });
});
