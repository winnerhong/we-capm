import { describe, expect, it } from "vitest";
import {
  CONSENT_ORG_TOKEN,
  DEFAULT_CONSENT_BODY,
  DEFAULT_CONSENT_OPTIONAL_BODY,
  MAX_CONSENT_BODY_LENGTH,
  checkConsentAgreed,
  consentFingerprint,
  parseConsentSnapshot,
  renderConsentBody,
  resolveOrgConsent,
  validateConsentBodies,
} from "./consent-core";

const ORG = "도원센트럴어린이집";

describe("renderConsentBody", () => {
  it("{기관명} 을 실제 기관명으로 바꾼다", () => {
    expect(renderConsentBody(`${CONSENT_ORG_TOKEN}은 …`, ORG)).toBe(
      `${ORG}은 …`
    );
  });

  it("여러 번 나와도 전부 바꾼다", () => {
    const t = `${CONSENT_ORG_TOKEN} / ${CONSENT_ORG_TOKEN}`;
    expect(renderConsentBody(t, ORG)).toBe(`${ORG} / ${ORG}`);
  });

  it("기관명이 비면 빈칸을 남기지 않는다", () => {
    expect(renderConsentBody(CONSENT_ORG_TOKEN, "")).toBe("소속 기관");
    expect(renderConsentBody(CONSENT_ORG_TOKEN, "   ")).toBe("소속 기관");
  });

  it("토큰이 없으면 그대로 둔다", () => {
    expect(renderConsentBody("토큰 없는 문구", ORG)).toBe("토큰 없는 문구");
  });
});

describe("resolveOrgConsent", () => {
  it("기관이 문구를 안 정했으면 기본 문구", () => {
    const c = resolveOrgConsent(null, ORG);
    expect(c.required).toBe(renderConsentBody(DEFAULT_CONSENT_BODY, ORG));
    expect(c.optional).toContain("(주)위너그룹");
  });

  it("컬럼 미적용(undefined) 이어도 화면이 비지 않는다", () => {
    // 코드가 먼저 배포되고 SQL 이 나중에 도는 창
    const c = resolveOrgConsent({}, ORG);
    expect(c.required).toBe(renderConsentBody(DEFAULT_CONSENT_BODY, ORG));
    expect(c.optional).not.toBeNull();
  });

  it("기본 문구의 {기관명} 이 양쪽 다 치환돼 나온다", () => {
    const c = resolveOrgConsent(null, ORG);
    expect(c.required).toContain(ORG);
    expect(c.required).not.toContain(CONSENT_ORG_TOKEN);
    expect(c.optional).toContain(ORG);
    expect(c.optional).not.toContain(CONSENT_ORG_TOKEN);
    // 기본 상수 자체는 토큰을 그대로 들고 있어야 한다(다른 기관에도 쓰이므로)
    expect(DEFAULT_CONSENT_BODY).toContain(CONSENT_ORG_TOKEN);
    expect(DEFAULT_CONSENT_OPTIONAL_BODY).toContain(CONSENT_ORG_TOKEN);
  });

  it("기관이 고친 문구가 기본값을 이긴다", () => {
    const c = resolveOrgConsent(
      { application_consent_body: `${CONSENT_ORG_TOKEN} 전용 문구` },
      ORG
    );
    expect(c.required).toBe(`${ORG} 전용 문구`);
  });

  it("공백만 저장돼 있으면 기본 문구로 되돌아간다", () => {
    const c = resolveOrgConsent({ application_consent_body: "   " }, ORG);
    expect(c.required).toBe(renderConsentBody(DEFAULT_CONSENT_BODY, ORG));
  });

  it("선택 동의를 끄면 optional 이 null — 신청서에 줄이 안 뜬다", () => {
    const c = resolveOrgConsent(
      { application_consent_optional_enabled: false },
      ORG
    );
    expect(c.optional).toBeNull();
    // 필수는 끌 수 없다
    expect(c.required).toBe(renderConsentBody(DEFAULT_CONSENT_BODY, ORG));
  });

  it("선택 동의를 끈 기관은 문구가 남아 있어도 안 보인다", () => {
    const c = resolveOrgConsent(
      {
        application_consent_optional_enabled: false,
        application_consent_optional_body: "예전에 쓰던 계열사 문구",
      },
      ORG
    );
    expect(c.optional).toBeNull();
  });

  it("enabled 가 null/undefined 면 켜진 것으로 본다 (기본 동작 유지)", () => {
    expect(
      resolveOrgConsent({ application_consent_optional_enabled: null }, ORG)
        .optional
    ).not.toBeNull();
    expect(resolveOrgConsent({}, ORG).optional).not.toBeNull();
  });
});

describe("validateConsentBodies", () => {
  const okInput = {
    body: "필수 문구",
    optionalBody: "선택 문구",
    optionalEnabled: true,
  };

  it("정상 입력은 통과", () => {
    expect(validateConsentBodies(okInput).ok).toBe(true);
  });

  it("필수 문구는 비울 수 없다", () => {
    const r = validateConsentBodies({ ...okInput, body: "  " });
    expect(r.ok).toBe(false);
  });

  it("선택 동의를 켜둔 채 문구를 비우면 막는다", () => {
    const r = validateConsentBodies({ ...okInput, optionalBody: "" });
    expect(r.ok).toBe(false);
  });

  it("선택 동의를 껐으면 그 문구는 비어도 된다", () => {
    const r = validateConsentBodies({
      body: "필수 문구",
      optionalBody: "",
      optionalEnabled: false,
    });
    expect(r.ok).toBe(true);
  });

  it("길이 상한을 넘으면 막는다", () => {
    const long = "가".repeat(MAX_CONSENT_BODY_LENGTH + 1);
    expect(validateConsentBodies({ ...okInput, body: long }).ok).toBe(false);
    expect(
      validateConsentBodies({ ...okInput, optionalBody: long }).ok
    ).toBe(false);
  });

  it("상한과 정확히 같으면 통과", () => {
    const exact = "가".repeat(MAX_CONSENT_BODY_LENGTH);
    expect(validateConsentBodies({ ...okInput, body: exact }).ok).toBe(true);
  });

  it("기본 문구는 상한 안에 들어간다", () => {
    expect(DEFAULT_CONSENT_BODY.length).toBeLessThan(MAX_CONSENT_BODY_LENGTH);
    expect(DEFAULT_CONSENT_OPTIONAL_BODY.length).toBeLessThan(
      MAX_CONSENT_BODY_LENGTH
    );
  });
});

describe("checkConsentAgreed", () => {
  it("동의했으면 통과", () => {
    expect(checkConsentAgreed(true).ok).toBe(true);
  });

  it("미동의는 막는다", () => {
    const r = checkConsentAgreed(false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("필수");
  });
});

describe("consentFingerprint", () => {
  const base = { required: "필수 문구", optional: "선택 문구" };

  it("같은 문구는 같은 지문", () => {
    expect(consentFingerprint(base)).toBe(consentFingerprint({ ...base }));
  });

  it("필수 문구가 바뀌면 지문이 바뀐다", () => {
    expect(consentFingerprint({ ...base, required: "고친 문구" })).not.toBe(
      consentFingerprint(base)
    );
  });

  it("선택 문구가 바뀌어도 지문이 바뀐다", () => {
    expect(consentFingerprint({ ...base, optional: "고친 선택" })).not.toBe(
      consentFingerprint(base)
    );
  });

  it("선택 동의를 끄는 것도 변경으로 잡힌다", () => {
    expect(consentFingerprint({ ...base, optional: null })).not.toBe(
      consentFingerprint(base)
    );
  });

  it("한 글자만 달라도 잡는다", () => {
    expect(consentFingerprint({ required: "가", optional: null })).not.toBe(
      consentFingerprint({ required: "각", optional: null })
    );
  });

  it("8자리 16진 문자열", () => {
    expect(consentFingerprint(base)).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("parseConsentSnapshot", () => {
  it("정상 jsonb 를 읽는다", () => {
    expect(
      parseConsentSnapshot({ required: "필수", optional: "선택" })
    ).toEqual({ required: "필수", optional: "선택" });
  });

  it("선택 미동의(null) 도 그대로", () => {
    expect(parseConsentSnapshot({ required: "필수", optional: null })).toEqual({
      required: "필수",
      optional: null,
    });
  });

  it("도입 전 신청서(null) 는 기록 없음", () => {
    expect(parseConsentSnapshot(null)).toBeNull();
    expect(parseConsentSnapshot(undefined)).toBeNull();
  });

  it("깨진 값은 기록 없음으로 — 화면이 터지지 않게", () => {
    expect(parseConsentSnapshot("문자열")).toBeNull();
    expect(parseConsentSnapshot([])).toBeNull();
    expect(parseConsentSnapshot({})).toBeNull();
    expect(parseConsentSnapshot({ required: "" })).toBeNull();
    expect(parseConsentSnapshot({ required: 123 })).toBeNull();
  });
});
