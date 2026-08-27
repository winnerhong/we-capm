// 사업자 정보 — 전자상거래법 제10조에 따라 화면에 표시하는 값.
//
// 한 곳에 모아두는 이유:
//   같은 정보가 푸터와 /business 두 곳에 각각 박혀 있었다. 한쪽만 고치면
//   푸터는 실제 사업자번호를, 상세 페이지는 000-00-00000 을 보여주는 상태가
//   된다. 법으로 표시하게 되어 있는 값이 서로 어긋나는 건 안 고친 것만 못하다.
//
// 값이 바뀌면 여기만 고치면 된다.

export const BUSINESS = {
  /** 서비스 브랜드 — 사업자명과 다르다. */
  serviceName: "토리로 (TORIRO)",
  /** 법인 상호 */
  companyName: "(주)위너그룹",
  representative: "홍보광",
  registrationNumber: "330-86-01864",
  address: "대구시 북구 침산로 168 엠브로타워 6층 위너키즈스포츠",
  supportPhone: "1800-7581",
  supportHours: "평일 10:00 ~ 17:00",
  email: "hello@toriro.com",
  /**
   * 개인정보 보호책임자 (개인정보보호법 제31조).
   * 별도 지정 전까지는 대표자가 겸한다 — 소규모 사업자의 통상적인 형태.
   */
  privacyOfficer: "홍보광",
  privacyEmail: "privacy@toriro.com",
  hosting: "Vercel Inc. / Amazon Web Services",
} as const;

/** "1800-7581 (평일 10:00 ~ 17:00)" */
export const SUPPORT_LINE = `${BUSINESS.supportPhone} (${BUSINESS.supportHours})`;

/** "홍보광 (privacy@toriro.com)" */
export const PRIVACY_OFFICER_LINE = `${BUSINESS.privacyOfficer} (${BUSINESS.privacyEmail})`;
