export type OrgDocType =
  | "BUSINESS_REG"
  | "BANKBOOK"
  | "TAX_CONTRACT"
  | "INSURANCE"
  | "FACILITY_CONSENT"
  | "PRIVACY_CONSENT";

export type OrgDocStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export type UploadedBy = "ORG" | "PARTNER";

export type OrgDocPhase = "TAX" | "OPERATION" | "OPTIONAL";

export const ORG_DOC_META = {
  BUSINESS_REG: {
    label: "사업자등록증",
    icon: "📑",
    required: true,
    hasExpiry: false,
    phase: "TAX" as OrgDocPhase,
    desc: "세금계산서 발행 필수",
    hasTemplate: false,
  },
  BANKBOOK: {
    label: "통장 사본",
    icon: "🏦",
    required: true,
    hasExpiry: false,
    phase: "TAX" as OrgDocPhase,
    desc: "정산·환불 계좌",
    hasTemplate: false,
  },
  TAX_CONTRACT: {
    label: "위탁계약서",
    icon: "✍️",
    required: true,
    hasExpiry: false,
    phase: "TAX" as OrgDocPhase,
    desc: "프로그램 위탁 근거",
    hasTemplate: true,
  },
  FACILITY_CONSENT: {
    label: "시설 이용 동의서",
    icon: "📝",
    required: true,
    hasExpiry: true,
    phase: "OPERATION" as OrgDocPhase,
    desc: "외부 시설 방문 시",
    hasTemplate: true,
  },
  PRIVACY_CONSENT: {
    label: "개인정보 처리 동의서",
    icon: "📋",
    required: true,
    hasExpiry: false,
    phase: "OPERATION" as OrgDocPhase,
    desc: "아동 정보 수집 근거",
    hasTemplate: true,
  },
  INSURANCE: {
    label: "배상책임보험",
    icon: "🛡",
    required: false,
    hasExpiry: true,
    phase: "OPTIONAL" as OrgDocPhase,
    desc: "기관 자체 보험 (있는 경우)",
    hasTemplate: false,
  },
} as const satisfies Record<
  OrgDocType,
  {
    label: string;
    icon: string;
    required: boolean;
    hasExpiry: boolean;
    phase: OrgDocPhase;
    desc: string;
    hasTemplate: boolean;
  }
>;

export const ORG_DOC_STATUS_META = {
  PENDING: {
    label: "검토중",
    icon: "⏳",
    color: "bg-amber-50 text-amber-800 border-amber-200",
  },
  APPROVED: {
    label: "승인됨",
    icon: "✅",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  REJECTED: {
    label: "반려됨",
    icon: "❌",
    color: "bg-rose-50 text-rose-800 border-rose-200",
  },
  EXPIRED: {
    label: "만료됨",
    icon: "⚰️",
    color: "bg-zinc-100 text-zinc-600 border-zinc-300",
  },
} as const satisfies Record<
  OrgDocStatus,
  { label: string; icon: string; color: string }
>;

export const UPLOADER_META = {
  ORG: {
    label: "🏫 기관 직접 제출",
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  PARTNER: {
    label: "🏡 지사 대행 제출",
    chip: "bg-sky-50 text-sky-800 border-sky-200",
  },
} as const satisfies Record<UploadedBy, { label: string; chip: string }>;

export const ORG_DOC_TYPE_KEYS: OrgDocType[] = [
  "BUSINESS_REG",
  "BANKBOOK",
  "TAX_CONTRACT",
  "FACILITY_CONSENT",
  "PRIVACY_CONSENT",
  "INSURANCE",
];

export interface OrgDocumentRow {
  id: string;
  org_id: string;
  partner_id: string | null;
  doc_type: OrgDocType;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  status: OrgDocStatus;
  uploaded_by: UploadedBy;
  uploaded_by_id: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reject_reason: string | null;
  expires_at: string | null;
  version: number;
  notes: string | null;
  created_at: string;
}
