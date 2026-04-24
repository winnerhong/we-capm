import type { ProfileSchema } from "../types";

/**
 * 지사(partner) 프로필 완성도 스키마 — Phase 1
 *
 * 총 15 필드 (가중치 동일 1.0):
 *   기본정보 6 + 정산계좌 3 + 필수서류 6
 */
export const PARTNER_PROFILE_SCHEMA: ProfileSchema = {
  accountType: "partner",
  groups: [
    {
      id: "basic",
      label: "기본 정보",
      icon: "🌿",
      fields: [
        {
          id: "business_name",
          label: "상호(사업자명)",
          icon: "🏡",
          href: "/partner/my/edit",
          check: { kind: "db_field", column: "business_name" },
        },
        {
          id: "representative_name",
          label: "대표자",
          icon: "🙋",
          href: "/partner/my/edit",
          check: { kind: "db_field", column: "representative_name" },
        },
        {
          id: "business_number",
          label: "사업자등록번호",
          icon: "📑",
          href: "/partner/my/edit",
          check: { kind: "db_field", column: "business_number" },
        },
        {
          id: "phone",
          label: "대표 연락처",
          icon: "📞",
          href: "/partner/my/edit",
          check: { kind: "db_field", column: "phone" },
        },
        {
          id: "email",
          label: "이메일",
          icon: "📧",
          href: "/partner/my/edit",
          check: { kind: "db_field", column: "email" },
        },
        {
          id: "address",
          label: "주소",
          icon: "📍",
          href: "/partner/my/edit",
          check: { kind: "db_field", column: "address" },
        },
      ],
    },
    {
      id: "bank",
      label: "정산 계좌",
      icon: "🏦",
      fields: [
        {
          id: "bank_name",
          label: "은행",
          icon: "🏦",
          href: "/partner/my/edit#bank",
          check: { kind: "db_field", column: "bank_name" },
        },
        {
          id: "account_number",
          label: "계좌번호",
          icon: "🔢",
          href: "/partner/my/edit#bank",
          check: { kind: "db_field", column: "account_number" },
        },
        {
          id: "account_holder",
          label: "예금주",
          icon: "🧾",
          href: "/partner/my/edit#bank",
          check: { kind: "db_field", column: "account_holder" },
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
          href: "/partner/settings/documents/upload?type=BUSINESS_REG",
          check: { kind: "doc_approved", docType: "BUSINESS_REG" },
        },
        {
          id: "doc_bankbook",
          label: "통장 사본 승인",
          icon: "🏦",
          href: "/partner/settings/documents/upload?type=BANKBOOK",
          check: { kind: "doc_approved", docType: "BANKBOOK" },
        },
        {
          id: "doc_ceo_id",
          label: "대표자 신분증 승인",
          icon: "🪪",
          href: "/partner/settings/documents/upload?type=CEO_ID",
          check: { kind: "doc_approved", docType: "CEO_ID" },
        },
        {
          id: "doc_contract",
          label: "플랫폼 계약서 승인",
          icon: "✍️",
          href: "/partner/settings/documents/upload?type=CONTRACT",
          check: { kind: "doc_approved", docType: "CONTRACT" },
        },
        {
          id: "doc_insurance",
          label: "배상책임보험증 승인",
          icon: "🛡",
          href: "/partner/settings/documents/upload?type=INSURANCE",
          check: { kind: "doc_approved", docType: "INSURANCE" },
        },
        {
          id: "doc_refund_policy",
          label: "환불/취소 규정 승인",
          icon: "🔄",
          href: "/partner/settings/documents/upload?type=REFUND_POLICY",
          check: { kind: "doc_approved", docType: "REFUND_POLICY" },
        },
      ],
    },
  ],
};
