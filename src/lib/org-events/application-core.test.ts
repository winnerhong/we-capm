import { describe, expect, it } from "vitest";
import {
  computeEffectiveCloseAt,
  computeHeadcount,
  deriveParentName,
  formatHeadcount,
  formatPhoneDisplay,
  maskName,
  parseApplicationChildren,
  parseApplicationCompanions,
  resolveApplicationGate,
  validateApplicationInput,
} from "./application-core";
import { COMPANION_PRESETS } from "./types";

const KST_NOON = Date.parse("2026-09-01T12:00:00+09:00");

const ADULT = (label: string) => ({ label, kind: "ADULT" as const });
const CHILD = (label: string) => ({ label, kind: "CHILD" as const });

describe("validateApplicationInput", () => {
  it("정상 입력을 정규화한다 — 연락처 숫자만, 반명 trim", () => {
    const r = validateApplicationInput({
      phone: "010-1234-5678",
      children: [{ name: " 홍유빈 ", className: " 햇살반 " }],
      companions: [ADULT("아빠"), ADULT("엄마")],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.phone).toBe("01012345678");
    expect(r.value.children).toEqual([
      { name: "홍유빈", class_name: "햇살반" },
    ]);
    // 총 인원은 입력이 아니라 파생값
    expect(r.value.partySize).toBe(3);
    expect(r.value.childCount).toBe(1);
    expect(r.value.adultCount).toBe(2);
  });

  it("반명은 비워도 된다 (null 로 저장)", () => {
    const r = validateApplicationInput({
      phone: "01012345678",
      children: [{ name: "홍유빈", className: "" }],
      companions: [],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.children[0].class_name).toBeNull();
  });

  it("동반인 0명도 허용 — 총 인원은 아이 수", () => {
    const r = validateApplicationInput({
      phone: "01012345678",
      children: [{ name: "홍유빈", className: "" }],
      companions: [],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.partySize).toBe(1);
    expect(r.value.adultCount).toBe(0);
  });

  it("같은 이름의 아이는 한 번만 남는다", () => {
    const r = validateApplicationInput({
      phone: "01012345678",
      children: [
        { name: "홍유빈", className: "햇살반" },
        { name: "홍유빈", className: "달빛반" },
        { name: "홍서준", className: "달빛반" },
      ],
      companions: [],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.children.map((c) => c.name)).toEqual(["홍유빈", "홍서준"]);
  });

  it("같은 유형 동반인은 중복 제거하지 않는다 (삼촌 2명)", () => {
    const r = validateApplicationInput({
      phone: "01012345678",
      children: [{ name: "홍유빈", className: "" }],
      companions: [ADULT("삼촌"), ADULT("삼촌")],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.adultCount).toBe(2);
    expect(r.value.partySize).toBe(3);
  });

  it("빈 라벨 동반인 줄은 조용히 버린다", () => {
    const r = validateApplicationInput({
      phone: "01012345678",
      children: [{ name: "홍유빈", className: "" }],
      companions: [ADULT("아빠"), ADULT("   "), ADULT("")],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.companions).toEqual([{ label: "아빠", kind: "ADULT" }]);
    expect(r.value.partySize).toBe(2);
  });

  it("연락처가 9자리면 거절", () => {
    const r = validateApplicationInput({
      phone: "010123456",
      children: [{ name: "홍유빈", className: "" }],
      companions: [],
    });
    expect(r.ok).toBe(false);
  });

  it("아이 이름이 하나도 없으면 거절", () => {
    const r = validateApplicationInput({
      phone: "01012345678",
      children: [{ name: "  ", className: "햇살반" }],
      companions: [ADULT("아빠")],
    });
    expect(r.ok).toBe(false);
  });

  it("자녀 7명은 상한(6) 초과로 거절", () => {
    const r = validateApplicationInput({
      phone: "01012345678",
      children: Array.from({ length: 7 }, (_, i) => ({
        name: `아이${i}`,
        className: "",
      })),
      companions: [],
    });
    expect(r.ok).toBe(false);
  });

  it("동반인 15명은 상한(14) 초과로 거절", () => {
    const r = validateApplicationInput({
      phone: "01012345678",
      children: [{ name: "홍유빈", className: "" }],
      companions: Array.from({ length: 15 }, (_, i) => ADULT(`친척${i}`)),
    });
    expect(r.ok).toBe(false);
  });

  it("총 인원 21명은 상한(20) 초과로 거절", () => {
    const r = validateApplicationInput({
      phone: "01012345678",
      children: Array.from({ length: 6 }, (_, i) => ({
        name: `아이${i}`,
        className: "",
      })),
      // 6 + 14(상한 이내) = 20 은 통과, 여기에 자녀가 하나라도 더 있으면 초과가
      // 되므로 동반인을 상한까지 채운 뒤 자녀 6명으로 정확히 20을 만든 다음
      // 라벨 긴 줄 대신 한 명 더 넣어 21을 만든다.
      companions: Array.from({ length: 14 }, (_, i) => ADULT(`친척${i}`)).concat(
        [ADULT("한명더")]
      ),
    });
    expect(r.ok).toBe(false);
  });

  it("총 20명 정확히는 통과", () => {
    const r = validateApplicationInput({
      phone: "01012345678",
      children: Array.from({ length: 6 }, (_, i) => ({
        name: `아이${i}`,
        className: "",
      })),
      companions: Array.from({ length: 14 }, (_, i) => ADULT(`친척${i}`)),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.partySize).toBe(20);
  });

  it("동반인 라벨이 21자면 거절", () => {
    const r = validateApplicationInput({
      phone: "01012345678",
      children: [{ name: "홍유빈", className: "" }],
      companions: [ADULT("가".repeat(21))],
    });
    expect(r.ok).toBe(false);
  });
});

describe("computeHeadcount", () => {
  it("사용자 예시 — 원생 1 + 아빠·엄마·삼촌·할머니·할아버지 = 아동1 성인5", () => {
    const h = computeHeadcount(
      [{ name: "홍길동", class_name: "햇살반" }],
      [
        ADULT("아빠"),
        ADULT("엄마"),
        ADULT("삼촌"),
        ADULT("할머니"),
        ADULT("할아버지"),
      ]
    );
    expect(h).toEqual({ childCount: 1, adultCount: 5, total: 6 });
  });

  it("아동 동반인은 아이 쪽으로 합산된다", () => {
    const h = computeHeadcount(
      [{ name: "홍유빈" }, { name: "홍서준" }],
      [ADULT("아빠"), ADULT("엄마"), CHILD("동생")]
    );
    expect(h).toEqual({ childCount: 3, adultCount: 2, total: 5 });
  });

  it("동반인이 없으면 아이 수가 곧 총 인원", () => {
    expect(computeHeadcount([{ name: "홍유빈" }], [])).toEqual({
      childCount: 1,
      adultCount: 0,
      total: 1,
    });
  });
});

describe("formatHeadcount", () => {
  it("아동·성인이 있으면 둘 다 적는다", () => {
    expect(
      formatHeadcount({ childCount: 2, adultCount: 3, total: 5 })
    ).toBe("👶 아동 2 · 🧑 성인 3 · 총 5명");
  });

  it("0인 항목은 생략한다", () => {
    expect(formatHeadcount({ childCount: 1, adultCount: 0, total: 1 })).toBe(
      "👶 아동 1 · 총 1명"
    );
  });
});

describe("parseApplicationCompanions", () => {
  it("jsonb 배열을 읽고 kind 를 보정한다", () => {
    expect(
      parseApplicationCompanions([
        { label: " 아빠 ", kind: "ADULT" },
        { label: "동생", kind: "CHILD" },
        { label: "삼촌", kind: "WEIRD" },
      ])
    ).toEqual([
      { label: "아빠", kind: "ADULT" },
      { label: "동생", kind: "CHILD" },
      { label: "삼촌", kind: "ADULT" },
    ]);
  });

  it("컬럼이 없던 시절(null)이나 깨진 값은 빈 배열", () => {
    expect(parseApplicationCompanions(null)).toEqual([]);
    expect(parseApplicationCompanions("nope")).toEqual([]);
    expect(parseApplicationCompanions([1, null, { label: "" }])).toEqual([]);
  });
});

describe("COMPANION_PRESETS", () => {
  it("형제·자매만 기본 아동이고 나머지는 성인", () => {
    const child = COMPANION_PRESETS.filter((p) => p.kind === "CHILD");
    expect(child.map((p) => p.label)).toEqual(["형제·자매"]);
    expect(COMPANION_PRESETS).toHaveLength(8);
  });
});

describe("computeEffectiveCloseAt", () => {
  it("지정 마감이 있으면 그것을 그대로 쓴다", () => {
    const r = computeEffectiveCloseAt(
      "2026-09-10T18:00:00+09:00",
      "2026-09-12T09:40:00+09:00"
    );
    expect(r).toEqual({ at: "2026-09-10T18:00:00+09:00", implicit: false });
  });

  it("마감을 안 정했으면 행사 시작 1시간 전", () => {
    const r = computeEffectiveCloseAt(null, "2026-09-12T09:40:00+09:00");
    expect(r.implicit).toBe(true);
    // 09:40 KST − 1시간 = 08:40 KST
    expect(new Date(r.at!).toISOString()).toBe(
      new Date("2026-09-12T08:40:00+09:00").toISOString()
    );
  });

  it("마감도 시작 시각도 없으면 무기한", () => {
    expect(computeEffectiveCloseAt(null, null)).toEqual({
      at: null,
      implicit: false,
    });
  });

  it("지정 마감이 깨진 값이면 시작 1시간 전으로 폴백", () => {
    const r = computeEffectiveCloseAt("garbage", "2026-09-12T09:40:00+09:00");
    expect(r.implicit).toBe(true);
    expect(r.at).not.toBeNull();
  });
});

describe("resolveApplicationGate", () => {
  it("접수 OFF 면 DISABLED", () => {
    const g = resolveApplicationGate({
      enabled: false,
      closeAt: null,
      capacity: null,
      approvedPeople: 0,
      nowMs: KST_NOON,
    });
    expect(g.kind).toBe("DISABLED");
  });

  it("마감이 지났으면 CLOSED", () => {
    const g = resolveApplicationGate({
      enabled: true,
      closeAt: "2026-09-01T11:00:00+09:00",
      capacity: null,
      approvedPeople: 0,
      nowMs: KST_NOON,
    });
    expect(g.kind).toBe("CLOSED");
  });

  it("마감 전이면 OPEN", () => {
    const g = resolveApplicationGate({
      enabled: true,
      closeAt: "2026-09-01T18:00:00+09:00",
      capacity: null,
      approvedPeople: 0,
      nowMs: KST_NOON,
    });
    expect(g.kind).toBe("OPEN");
  });

  it("정원이 차도 OPEN 이되 atCapacity 로 표시한다 (차단하지 않음)", () => {
    const g = resolveApplicationGate({
      enabled: true,
      closeAt: null,
      capacity: 10,
      approvedPeople: 10,
      nowMs: KST_NOON,
    });
    expect(g).toMatchObject({ kind: "OPEN", atCapacity: true, capacity: 10 });
  });

  it("정원 미달이면 atCapacity=false", () => {
    const g = resolveApplicationGate({
      enabled: true,
      closeAt: null,
      capacity: 10,
      approvedPeople: 9,
      nowMs: KST_NOON,
    });
    expect(g).toMatchObject({ kind: "OPEN", atCapacity: false });
  });

  it("정원 0/음수는 무제한으로 취급", () => {
    const g = resolveApplicationGate({
      enabled: true,
      closeAt: null,
      capacity: 0,
      approvedPeople: 100,
      nowMs: KST_NOON,
    });
    expect(g).toMatchObject({ kind: "OPEN", atCapacity: false, capacity: null });
  });

  it("마감 값이 깨져 있고 시작 시각도 없으면 마감으로 보지 않는다", () => {
    const g = resolveApplicationGate({
      enabled: true,
      closeAt: "not-a-date",
      capacity: null,
      approvedPeople: 0,
      nowMs: KST_NOON,
    });
    expect(g.kind).toBe("OPEN");
  });

  /* 마감 미지정 → 행사 시작 1시간 전이 자동 마감 */

  it("마감 미지정 + 행사가 2시간 뒤면 아직 OPEN (자동 마감 1시간 전)", () => {
    const g = resolveApplicationGate({
      enabled: true,
      closeAt: null,
      startsAt: "2026-09-01T14:00:00+09:00", // now = 12:00 → 마감 13:00
      capacity: null,
      approvedPeople: 0,
      nowMs: KST_NOON,
    });
    expect(g).toMatchObject({ kind: "OPEN", closeIsImplicit: true });
  });

  it("마감 미지정 + 행사 시작 40분 전이면 CLOSED", () => {
    const g = resolveApplicationGate({
      enabled: true,
      closeAt: null,
      startsAt: "2026-09-01T12:40:00+09:00", // now = 12:00 → 마감은 11:40, 이미 지남
      capacity: null,
      approvedPeople: 0,
      nowMs: KST_NOON,
    });
    expect(g).toMatchObject({ kind: "CLOSED", implicit: true });
  });

  it("마감 미지정 + 행사가 이미 끝났으면 CLOSED", () => {
    const g = resolveApplicationGate({
      enabled: true,
      closeAt: null,
      startsAt: "2026-08-30T10:00:00+09:00",
      capacity: null,
      approvedPeople: 0,
      nowMs: KST_NOON,
    });
    expect(g.kind).toBe("CLOSED");
  });

  it("지정 마감이 있으면 행사 시작 1시간 전보다 우선한다", () => {
    const g = resolveApplicationGate({
      enabled: true,
      closeAt: "2026-09-01T18:00:00+09:00", // 자동값(13:00)보다 늦게 잡은 마감
      startsAt: "2026-09-01T14:00:00+09:00",
      capacity: null,
      approvedPeople: 0,
      nowMs: KST_NOON,
    });
    expect(g).toMatchObject({ kind: "OPEN", closeIsImplicit: false });
    if (g.kind !== "OPEN") return;
    expect(g.closeAt).toBe("2026-09-01T18:00:00+09:00");
  });

  it("마감·시작 둘 다 없으면 무기한 OPEN", () => {
    const g = resolveApplicationGate({
      enabled: true,
      closeAt: null,
      startsAt: null,
      capacity: null,
      approvedPeople: 0,
      nowMs: KST_NOON,
    });
    expect(g).toMatchObject({ kind: "OPEN", closeAt: null });
  });
});

describe("parseApplicationChildren", () => {
  it("jsonb 배열을 읽는다", () => {
    expect(
      parseApplicationChildren([
        { name: "홍유빈", class_name: "햇살반" },
        { name: "홍서준", class_name: "" },
      ])
    ).toEqual([
      { name: "홍유빈", class_name: "햇살반" },
      { name: "홍서준", class_name: null },
    ]);
  });

  it("형태가 깨져 있어도 빈 배열로 견딘다", () => {
    expect(parseApplicationChildren(null)).toEqual([]);
    expect(parseApplicationChildren("nope")).toEqual([]);
    expect(parseApplicationChildren([1, null, { name: "" }])).toEqual([]);
  });
});

describe("deriveParentName", () => {
  it("첫 아이 이름으로 보호자 이름을 만든다", () => {
    expect(
      deriveParentName([{ name: "홍유빈", class_name: null }])
    ).toBe("홍유빈 학부모");
  });

  it("아이가 없으면 빈 문자열 (호출측 폴백에 맡긴다)", () => {
    expect(deriveParentName([])).toBe("");
  });
});

describe("maskName", () => {
  it("가운데를 가린다", () => {
    expect(maskName("홍유빈")).toBe("홍*빈");
    expect(maskName("남궁유빈")).toBe("남**빈");
    expect(maskName("홍유")).toBe("홍*");
    expect(maskName("홍")).toBe("홍");
  });
});

describe("formatPhoneDisplay", () => {
  it("10/11자리를 하이픈으로 끊는다", () => {
    expect(formatPhoneDisplay("01012345678")).toBe("010-1234-5678");
    expect(formatPhoneDisplay("0311234567")).toBe("031-123-4567");
  });
});
