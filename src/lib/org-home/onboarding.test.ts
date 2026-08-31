import { describe, expect, it } from "vitest";
import { buildOrgProfileSchema } from "@/lib/profile-completeness/schemas/org";
import { calcCompleteness } from "@/lib/profile-completeness/calculator";
import type { ProfileSnapshot } from "@/lib/profile-completeness/types";
import {
  buildOnboardingSteps,
  currentStepIndex,
  isOnboarding,
  summarize,
  type ProfileGroupSummary,
} from "./onboarding";

const ORG = "org-1";

/** 실제 스키마를 돌려서 그룹 요약을 만든다 — 손으로 베끼면 대조가 무의미해진다. */
function groupsFrom(snap: ProfileSnapshot): ProfileGroupSummary[] {
  return calcCompleteness(buildOrgProfileSchema(ORG), snap).groups;
}

const EMPTY: ProfileSnapshot = { db: {}, docs: {} };

const INFO_DONE: ProfileSnapshot = {
  db: {
    org_name: "도원센트럴어린이집",
    representative_name: "홍길동",
    representative_phone: "010-0000-0000",
    email: "a@b.kr",
    address: "서울시 어딘가",
    business_number: "000-00-00000",
    org_type: "어린이집",
  },
  docs: {},
};

const ALL_DONE: ProfileSnapshot = {
  db: INFO_DONE.db,
  docs: {
    BUSINESS_REG: "APPROVED",
    BANKBOOK: "APPROVED",
    TAX_CONTRACT: "APPROVED",
    FACILITY_CONSENT: "APPROVED",
    PRIVACY_CONSENT: "APPROVED",
  },
};

describe("isOnboarding", () => {
  it("행사가 하나도 없으면 준비 모드", () => {
    expect(isOnboarding(0)).toBe(true);
  });

  it("행사가 생기면 운영 모드", () => {
    expect(isOnboarding(1)).toBe(false);
    expect(isOnboarding(12)).toBe(false);
  });
});

describe("buildOnboardingSteps", () => {
  it("스키마 12항목이 7 + 5 로 접힌다", () => {
    const [info, docs, event] = buildOnboardingSteps(ORG, groupsFrom(EMPTY), 0);
    expect(info.total).toBe(7); // basic 4 + business 3
    expect(docs.total).toBe(5);
    expect(event.total).toBe(1);
    expect(info.total + docs.total).toBe(12);
  });

  it("아무것도 안 채웠으면 세 걸음 다 미완료", () => {
    const steps = buildOnboardingSteps(ORG, groupsFrom(EMPTY), 0);
    expect(steps.map((s) => s.done)).toEqual([false, false, false]);
    expect(steps[0].missing).toHaveLength(7);
    expect(steps[1].missing).toHaveLength(5);
  });

  it("설정만 다 채우면 ① 만 끝난다 — 여기가 58% 로 멈추던 자리", () => {
    const steps = buildOnboardingSteps(ORG, groupsFrom(INFO_DONE), 0);
    expect(steps[0].done).toBe(true);
    expect(steps[1].done).toBe(false);
    expect(steps[1].missing).toHaveLength(5);
    expect(currentStepIndex(steps)).toBe(1);
  });

  it("서류 줄은 업로드 주소를 각자 들고 있다", () => {
    const [, docs] = buildOnboardingSteps(ORG, groupsFrom(EMPTY), 0);
    const hrefs = docs.missing.map((f) => f.href);
    expect(new Set(hrefs).size).toBe(5); // 다섯 개가 서로 다른 주소
    expect(hrefs.every((h) => h?.includes("/documents/upload?type="))).toBe(
      true
    );
  });

  it("양식을 내려받을 수 있는 서류는 그 링크도 함께 온다", () => {
    const [, docs] = buildOnboardingSteps(ORG, groupsFrom(EMPTY), 0);
    expect(docs.missing.filter((f) => f.downloadHref)).toHaveLength(3);
  });

  it("첫 행사 걸음은 채울 항목이 아니라 버튼 하나다", () => {
    const [, , event] = buildOnboardingSteps(ORG, groupsFrom(EMPTY), 0);
    expect(event.missing).toEqual([]);
    expect(event.cta?.href).toBe(`/org/${ORG}/events/new`);
  });

  it("행사가 있으면 ③ 이 끝난다", () => {
    const steps = buildOnboardingSteps(ORG, groupsFrom(EMPTY), 3);
    expect(steps[2].done).toBe(true);
    expect(currentStepIndex(steps)).toBe(0); // 앞 걸음이 여전히 열려 있다
  });

  it("전부 끝나면 열린 걸음이 없다", () => {
    const steps = buildOnboardingSteps(ORG, groupsFrom(ALL_DONE), 1);
    expect(steps.every((s) => s.done)).toBe(true);
    expect(currentStepIndex(steps)).toBe(-1);
  });

  it("그룹이 비어 와도 터지지 않는다(완성도 조회 실패 시)", () => {
    const steps = buildOnboardingSteps(ORG, [], 0);
    expect(steps).toHaveLength(3);
    expect(steps[0].total).toBe(0);
    expect(steps[0].done).toBe(false); // 0/0 을 '완료' 로 보지 않는다
  });
});

describe("summarize", () => {
  it("12칸 중 몇 칸인지와 지금 걸음을 함께 준다", () => {
    const s = summarize(buildOnboardingSteps(ORG, groupsFrom(INFO_DONE), 0));
    expect(s.completed).toBe(7);
    expect(s.total).toBe(13); // 프로필 12 + 첫 행사 1
    expect(s.nextLabel).toBe("필수 서류");
    expect(s.nextRemaining).toBe(5);
  });

  it("다 끝나면 다음 걸음이 없다", () => {
    const s = summarize(buildOnboardingSteps(ORG, groupsFrom(ALL_DONE), 2));
    expect(s.nextLabel).toBeNull();
    expect(s.nextRemaining).toBe(0);
  });
});
