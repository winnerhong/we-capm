import type { ProfileSchema } from "../types";

/**
 * 기관(org) 프로필 완성도 스키마 — Phase 2
 *
 * 총 12 필드:
 *   기본정보 4 + 사업자·기관정보 3 + 필수서류 5
 *
 * 편집 진입점(href)은 각 기관 포털 동적 경로를 따라야 하므로 호출부에서
 * `buildOrgSchema(orgId)` 로 orgId를 주입하도록 설계했습니다.
 */
export function buildOrgProfileSchema(orgId: string): ProfileSchema {
  const base = `/org/${orgId}`;
  return {
    accountType: "org",
    groups: [
      {
        id: "basic",
        label: "기본 정보",
        icon: "🌿",
        fields: [
          {
            id: "org_name",
            label: "기관명",
            icon: "🏫",
            href: `${base}/settings`,
            check: { kind: "db_field", column: "org_name" },
          },
          {
            id: "representative_name",
            label: "대표자",
            icon: "🙋",
            href: `${base}/settings`,
            check: { kind: "db_field", column: "representative_name" },
          },
          {
            id: "representative_phone",
            label: "담당자 연락처",
            icon: "📞",
            href: `${base}/settings`,
            check: { kind: "db_field", column: "representative_phone" },
          },
          {
            id: "email",
            label: "이메일",
            icon: "📧",
            href: `${base}/settings`,
            check: { kind: "db_field", column: "email" },
          },
        ],
      },
      {
        id: "business",
        label: "기관 정보",
        icon: "📑",
        fields: [
          {
            id: "address",
            label: "주소",
            icon: "📍",
            href: `${base}/settings`,
            check: { kind: "db_field", column: "address" },
          },
          {
            id: "business_number",
            label: "사업자등록번호",
            icon: "📑",
            href: `${base}/settings`,
            check: { kind: "db_field", column: "business_number" },
          },
          {
            id: "org_type",
            label: "기관 유형 (어린이집/유치원 등)",
            icon: "🏫",
            href: `${base}/settings`,
            check: { kind: "db_field", column: "org_type" },
          },
        ],
      },
      {
        id: "docs",
        label: "필수 서류",
        icon: "📄",
        fields: [
          {
            id: "doc_business_reg",
            label: "사업자등록증 승인",
            icon: "📑",
            href: `${base}/documents/upload?type=BUSINESS_REG`,
            check: { kind: "doc_approved", docType: "BUSINESS_REG" },
          },
          {
            id: "doc_bankbook",
            label: "통장 사본 승인",
            icon: "🏦",
            href: `${base}/documents/upload?type=BANKBOOK`,
            check: { kind: "doc_approved", docType: "BANKBOOK" },
          },
          {
            id: "doc_tax_contract",
            label: "위탁계약서 승인",
            icon: "✍️",
            href: `${base}/documents/upload?type=TAX_CONTRACT`,
            downloadHref: `${base}/documents/template/TAX_CONTRACT`,
            downloadLabel: "📥 양식",
            check: { kind: "doc_approved", docType: "TAX_CONTRACT" },
          },
          {
            id: "doc_facility_consent",
            label: "시설 이용 동의서 승인",
            icon: "📝",
            href: `${base}/documents/upload?type=FACILITY_CONSENT`,
            downloadHref: `${base}/documents/template/FACILITY_CONSENT`,
            downloadLabel: "📥 양식",
            check: { kind: "doc_approved", docType: "FACILITY_CONSENT" },
          },
          {
            id: "doc_privacy_consent",
            label: "개인정보 처리 동의서 승인",
            icon: "📋",
            href: `${base}/documents/upload?type=PRIVACY_CONSENT`,
            downloadHref: `${base}/documents/template/PRIVACY_CONSENT`,
            downloadLabel: "📥 양식",
            check: { kind: "doc_approved", docType: "PRIVACY_CONSENT" },
          },
        ],
      },
    ],
  };
}
