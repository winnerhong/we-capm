export type DocType =
  | "BUSINESS_REG"
  | "BANKBOOK"
  | "CEO_ID"
  | "CONTRACT"
  | "INSURANCE"
  | "REFUND_POLICY"
  | "FOREST_CERT"
  | "CPR_CERT"
  | "SAFETY_INSPECT";

export type DocStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export type DocPhase = "CONTRACT" | "OPERATION" | "PROGRAM";

export const DOC_TYPE_META = {
  BUSINESS_REG: {
    label: "사업자등록증",
    icon: "📑",
    required: true,
    hasExpiry: false,
    phase: "CONTRACT",
    desc: "세무·법인 확인",
  },
  BANKBOOK: {
    label: "통장 사본",
    icon: "🏦",
    required: true,
    hasExpiry: false,
    phase: "CONTRACT",
    desc: "정산 계좌 검증",
  },
  CEO_ID: {
    label: "대표자 신분증",
    icon: "🪪",
    required: true,
    hasExpiry: false,
    phase: "CONTRACT",
    desc: "본인 확인",
  },
  CONTRACT: {
    label: "플랫폼 계약서",
    icon: "✍️",
    required: true,
    hasExpiry: false,
    phase: "CONTRACT",
    desc: "서명된 이용약관",
  },
  INSURANCE: {
    label: "배상책임보험증",
    icon: "🛡",
    required: true,
    hasExpiry: true,
    phase: "OPERATION",
    desc: "안전사고 대비",
  },
  REFUND_POLICY: {
    label: "환불/취소 규정",
    icon: "🔄",
    required: true,
    hasExpiry: false,
    phase: "OPERATION",
    desc: "KFTC 소비자보호",
  },
  FOREST_CERT: {
    label: "숲해설사 자격증",
    icon: "🌲",
    required: false,
    hasExpiry: true,
    phase: "PROGRAM",
    desc: "프로그램 전문성",
  },
  CPR_CERT: {
    label: "응급처치/CPR 이수증",
    icon: "🚑",
    required: false,
    hasExpiry: true,
    phase: "PROGRAM",
    desc: "안전 교육",
  },
  SAFETY_INSPECT: {
    label: "시설 안전점검서",
    icon: "🏕",
    required: false,
    hasExpiry: true,
    phase: "PROGRAM",
    desc: "물리 시설 운영",
  },
} as const satisfies Record<
  DocType,
  {
    label: string;
    icon: string;
    required: boolean;
    hasExpiry: boolean;
    phase: DocPhase;
    desc: string;
  }
>;

export const STATUS_META = {
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
  DocStatus,
  { label: string; icon: string; color: string }
>;

export const DOC_TYPE_KEYS: DocType[] = [
  "BUSINESS_REG",
  "BANKBOOK",
  "CEO_ID",
  "CONTRACT",
  "INSURANCE",
  "REFUND_POLICY",
  "FOREST_CERT",
  "CPR_CERT",
  "SAFETY_INSPECT",
];

export interface DocumentRow {
  id: string;
  partner_id: string;
  doc_type: DocType;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  status: DocStatus;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reject_reason: string | null;
  expires_at: string | null;
  version: number;
  notes: string | null;
  created_at: string;
}
