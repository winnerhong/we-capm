/**
 * 청구서 상태 배지 — 7가지 상태를 색상/라벨로 구분.
 * 포레스트 테마에 맞춰 톤을 낮췄습니다. 재사용 전용 (서버/클라이언트 무관).
 */

export type InvoiceStatus =
  | "DRAFT"
  | "PENDING"
  | "PAID"
  | "CONFIRMED"
  | "EXPIRED"
  | "CANCELED"
  | "REFUNDED";

const STATUS_MAP: Record<
  InvoiceStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  DRAFT: {
    label: "작성중",
    bg: "bg-neutral-100",
    text: "text-neutral-600",
    border: "border-neutral-200",
  },
  PENDING: {
    label: "결제대기",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  PAID: {
    label: "결제완료",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  CONFIRMED: {
    label: "확정완료",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  EXPIRED: {
    label: "만료됨",
    bg: "bg-neutral-200",
    text: "text-neutral-700",
    border: "border-neutral-300",
  },
  CANCELED: {
    label: "취소됨",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
  },
  REFUNDED: {
    label: "환불완료",
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
  },
};

interface Props {
  status: string;
  /** 작은 배지 (테이블 내부용) */
  size?: "sm" | "md";
  className?: string;
}

export function InvoiceStatusBadge({ status, size = "md", className = "" }: Props) {
  const s =
    STATUS_MAP[(status as InvoiceStatus)] ?? {
      label: status,
      bg: "bg-neutral-100",
      text: "text-neutral-700",
      border: "border-neutral-200",
    };
  const padding = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${padding} ${s.bg} ${s.text} ${s.border} ${className}`}
      aria-label={`청구서 상태: ${s.label}`}
    >
      {s.label}
    </span>
  );
}
