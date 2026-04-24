import type { ReactNode } from "react";
import Link from "next/link";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { AcornIcon } from "@/components/acorn-icon";

/**
 * 재사용 가능한 청구서 카드. 관리자/파트너/B2B/기관/가족 포털 전부에서 사용.
 * 서버 컴포넌트 호환 (클라이언트 상태 없음).
 */

const CATEGORY_ICON: Record<string, ReactNode> = {
  ACORN_RECHARGE: <AcornIcon size={20} />,
  SUBSCRIPTION: "📅",
  EVENT_FEE: "🏕️",
  AD_CAMPAIGN: "📣",
  COUPON_FEE: "🎟️",
  B2B_CONTRACT: "💼",
  SETTLEMENT: "💰",
  REFUND: "↩️",
  OTHER: "📄",
};

const CATEGORY_LABEL: Record<string, string> = {
  ACORN_RECHARGE: "도토리 충전",
  SUBSCRIPTION: "구독 결제",
  EVENT_FEE: "행사 이용료",
  AD_CAMPAIGN: "광고 캠페인",
  COUPON_FEE: "쿠폰 수수료",
  B2B_CONTRACT: "B2B 계약",
  SETTLEMENT: "정산",
  REFUND: "환불",
  OTHER: "기타",
};

interface Props {
  invoice: {
    id: string;
    invoice_number: string;
    category: string;
    amount: number;
    total_amount: number;
    status: string;
    issued_at?: string;
    expires_at: string;
    description?: string | null;
    target_name?: string | null;
  };
  action?: "pay" | "view" | "confirm" | null;
  href?: string;
}

function daysUntil(isoDate: string): number {
  const diff = new Date(isoDate).getTime() - Date.now();
  return Math.ceil(diff / (24 * 3600 * 1000));
}

export function InvoiceCard({ invoice, action = "view", href }: Props) {
  const icon = CATEGORY_ICON[invoice.category] ?? "📄";
  const catLabel = CATEGORY_LABEL[invoice.category] ?? invoice.category;
  const days = daysUntil(invoice.expires_at);
  const isActive =
    invoice.status === "PENDING" || invoice.status === "DRAFT";
  const expiresSoon = isActive && days <= 3 && days >= 0;
  const overdue = isActive && days < 0;

  const actionLabel =
    action === "pay"
      ? "결제하기"
      : action === "confirm"
        ? "확정하기"
        : action === "view"
          ? "자세히 보기"
          : null;

  const cardHref =
    href ?? (action === "pay" ? `/invoice/${invoice.id}` : `/invoice/${invoice.id}`);

  return (
    <article
      className="rounded-2xl border border-[#E5D3B8] bg-gradient-to-br from-white to-[#FFF8F0] p-4 shadow-sm hover:shadow-md transition-shadow"
      aria-labelledby={`inv-${invoice.id}-title`}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#E8F0E4] text-2xl"
          aria-hidden="true"
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-[#8B6F47]">{catLabel}</p>
              <h3
                id={`inv-${invoice.id}-title`}
                className="truncate text-sm font-bold text-[#2D5A3D]"
                title={invoice.description ?? invoice.invoice_number}
              >
                {invoice.description ?? invoice.invoice_number}
              </h3>
              {invoice.target_name && (
                <p className="mt-0.5 truncate text-xs text-[#6B6560]">
                  {invoice.target_name}
                </p>
              )}
            </div>
            <InvoiceStatusBadge status={invoice.status} size="sm" />
          </div>
        </div>
      </div>

      {/* 금액 강조 */}
      <div className="mt-3 rounded-xl bg-white/70 border border-[#D4E4BC]/60 px-3 py-2.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium text-[#8B6F47]">
          총 결제금액
        </span>
        <span className="text-xl font-extrabold text-[#2D5A3D] tabular-nums">
          {invoice.total_amount.toLocaleString("ko-KR")}
          <span className="ml-0.5 text-xs font-semibold">원</span>
        </span>
      </div>

      {/* 메타: 번호 + 만료 */}
      <dl className="mt-2.5 grid grid-cols-2 gap-1 text-[11px]">
        <div className="flex flex-col">
          <dt className="text-[#8B6F47]">청구서번호</dt>
          <dd className="font-mono text-[#2C2C2C] truncate">
            {invoice.invoice_number}
          </dd>
        </div>
        <div className="flex flex-col text-right">
          <dt className="text-[#8B6F47]">만료일</dt>
          <dd
            className={
              overdue
                ? "font-semibold text-red-600"
                : expiresSoon
                  ? "font-semibold text-amber-600"
                  : "text-[#2C2C2C]"
            }
          >
            {overdue
              ? "만료됨"
              : days === 0
                ? "오늘 만료"
                : `${days}일 남음`}
          </dd>
        </div>
      </dl>

      {actionLabel && isActive && (
        <Link
          href={cardHref}
          className={`mt-3 block w-full rounded-xl py-2.5 text-center text-sm font-bold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2D5A3D]/30 ${
            action === "pay"
              ? "bg-[#2D5A3D] text-white hover:bg-[#1F4229]"
              : "bg-[#E8F0E4] text-[#2D5A3D] hover:bg-[#D4E4BC]"
          }`}
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && !isActive && action === "view" && (
        <Link
          href={cardHref}
          className="mt-3 block w-full rounded-xl bg-neutral-100 py-2.5 text-center text-sm font-semibold text-neutral-700 hover:bg-neutral-200 transition-colors"
        >
          {actionLabel}
        </Link>
      )}
    </article>
  );
}
