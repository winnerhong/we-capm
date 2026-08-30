import { describe, expect, it } from "vitest";
import {
  DEFAULT_INVITATION_MESSAGE,
  FALLBACK_EVENT_TITLE,
  isPreviewBlockVisible,
  resolveInvitationMessage,
  resolveInvitationTitle,
} from "./invitation-copy";

describe("resolveInvitationMessage", () => {
  it("쓴 인사말이 있으면 그대로", () => {
    expect(resolveInvitationMessage("숲에서 만나요")).toBe("숲에서 만나요");
  });

  it("앞뒤 공백은 턴다", () => {
    expect(resolveInvitationMessage("  숲에서 만나요  ")).toBe("숲에서 만나요");
  });

  it("비었으면 기본 문구 — 초대장 화면이 쓰는 값과 같아야 한다", () => {
    for (const v of ["", "   ", null, undefined]) {
      expect(resolveInvitationMessage(v)).toBe(DEFAULT_INVITATION_MESSAGE);
    }
  });
});

describe("resolveInvitationTitle", () => {
  it("이름이 비면 자리 표시", () => {
    expect(resolveInvitationTitle("  ")).toBe(FALLBACK_EVENT_TITLE);
    expect(resolveInvitationTitle("봄 숲 캠프")).toBe("봄 숲 캠프");
  });
});

describe("isPreviewBlockVisible", () => {
  const F = {
    name: "봄 숲 캠프",
    message: "함께 즐거운 시간을",
    body: "",
    dress: "   ",
    location: "봉무공원",
    address: "",
  };

  it("한 칸짜리 — 차 있으면 보이고 비면 숨는다", () => {
    expect(isPreviewBlockVisible("location", F)).toBe(true);
    expect(isPreviewBlockVisible("body", F)).toBe(false);
  });

  it("공백만 있는 값은 빈 것으로 본다 — 빈 카드가 남으면 그게 거짓말", () => {
    expect(isPreviewBlockVisible("dress", F)).toBe(false);
  });

  it("| 는 하나만 차 있어도 보인다", () => {
    expect(isPreviewBlockVisible("location|address", F)).toBe(true);
    expect(isPreviewBlockVisible("body|dress", F)).toBe(false);
  });

  it("& 는 둘 다 차 있어야 보인다 — 장소와 주소 사이의 ':' 구분자", () => {
    expect(isPreviewBlockVisible("location&address", F)).toBe(false);
    expect(
      isPreviewBlockVisible("location&address", { ...F, address: "대구 북구" })
    ).toBe(true);
  });

  it("모르는 칸 이름은 빈 것으로 본다(숨김) — 표시가 잘못 붙어도 없는 걸 보여주진 않는다", () => {
    expect(isPreviewBlockVisible("nope", F)).toBe(false);
    expect(isPreviewBlockVisible("", F)).toBe(false);
  });

  it("문자열이 아닌 값은 무시한다", () => {
    expect(isPreviewBlockVisible("body", { body: 123 })).toBe(false);
    expect(isPreviewBlockVisible("body", { body: null })).toBe(false);
  });
});
