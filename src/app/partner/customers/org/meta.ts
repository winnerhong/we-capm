import type { OrgStatus, OrgType } from "./actions";

export const ORG_TYPE_META: Record<
  OrgType,
  { label: string; icon: string; chip: string }
> = {
  DAYCARE: {
    label: "어린이집",
    icon: "🧸",
    chip: "bg-rose-50 text-rose-700 border-rose-200",
  },
  KINDERGARTEN: {
    label: "유치원",
    icon: "🎈",
    chip: "bg-amber-50 text-amber-800 border-amber-200",
  },
  ELEMENTARY: {
    label: "초등학교",
    icon: "🏫",
    chip: "bg-sky-50 text-sky-700 border-sky-200",
  },
  MIDDLE: {
    label: "중학교",
    icon: "📘",
    chip: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  HIGH: {
    label: "고등학교",
    icon: "🎓",
    chip: "bg-violet-50 text-violet-700 border-violet-200",
  },
  EDUCATION_OFFICE: {
    label: "교육청",
    icon: "🏛️",
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  OTHER: {
    label: "기타",
    icon: "🏢",
    chip: "bg-zinc-50 text-zinc-700 border-zinc-200",
  },
};

export const ORG_TYPE_OPTIONS: Array<{ value: OrgType; label: string; icon: string }> =
  [
    { value: "DAYCARE", label: "어린이집", icon: "🧸" },
    { value: "KINDERGARTEN", label: "유치원", icon: "🎈" },
    { value: "ELEMENTARY", label: "초등학교", icon: "🏫" },
    { value: "MIDDLE", label: "중학교", icon: "📘" },
    { value: "HIGH", label: "고등학교", icon: "🎓" },
    { value: "EDUCATION_OFFICE", label: "교육청", icon: "🏛️" },
    { value: "OTHER", label: "기타", icon: "🏢" },
  ];

export const ORG_STATUS_META: Record<
  OrgStatus,
  { label: string; chip: string; dot: string }
> = {
  ACTIVE: {
    label: "활성",
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  INACTIVE: {
    label: "휴면",
    chip: "bg-zinc-50 text-zinc-700 border-zinc-200",
    dot: "bg-zinc-400",
  },
  SUSPENDED: {
    label: "일시중지",
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  CLOSED: {
    label: "해지",
    chip: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
  },
};

export const ORG_STATUS_OPTIONS: Array<{ value: OrgStatus; label: string }> = [
  { value: "ACTIVE", label: "활성" },
  { value: "INACTIVE", label: "휴면" },
  { value: "SUSPENDED", label: "일시중지" },
  { value: "CLOSED", label: "해지" },
];

export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "-";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11)
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10)
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return raw;
}

export function formatDate(raw: string | null | undefined): string {
  if (!raw) return "-";
  try {
    return new Date(raw).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return raw;
  }
}

export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const end = new Date(date).getTime();
  if (!Number.isFinite(end)) return null;
  const now = Date.now();
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
}

export interface OrgRow {
  id: string;
  partner_id: string;
  org_name: string;
  org_type: OrgType;
  org_phone: string | null;
  representative_name: string | null;
  representative_phone: string | null;
  email: string | null;
  address: string | null;
  children_count: number;
  class_count: number;
  teacher_count: number;
  business_number: string | null;
  tax_email: string | null;
  commission_rate: number;
  discount_rate: number;
  contract_start: string | null;
  contract_end: string | null;
  tags: string[] | null;
  internal_memo: string | null;
  auto_username: string | null;
  status: OrgStatus;
  created_at: string;
}
