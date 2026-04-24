"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { PaymentModal } from "@/components/payment-modal";
import { PaymentMethods, type PaymentMethodId } from "@/components/billing/payment-methods";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge";
import type { PaymentResult, PaymentMethod as LegacyMethod } from "@/lib/payments";
import { AcornIcon } from "@/components/acorn-icon";

/**
 * 공개 청구서 결제 뷰 — 포레스트 테마.
 * - 만료까지 남은 시간 카운트다운
 * - 결제 수단 선택 → PaymentModal → 성공 시 confirm API 호출
 * - 세금계산서 요청 버튼
 */

interface InvoiceData {
  id: string;
  invoice_number: string;
  target_name: string | null;
  target_type: string;
  category: string;
  amount: number;
  vat: number;
  total_amount: number;
  acorns_credited: number | null;
  bonus_rate: number | null;
  description: string | null;
  bank_account: string | null;
  payment_methods: string[] | null;
  status: string;
  issued_at: string | null;
  expires_at: string | null;
  paid_at: string | null;
}

const CATEGORY_ICON: Record<string, ReactNode> = {
  ACORN_RECHARGE: <AcornIcon size={28} />,
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

/** PaymentModal의 legacy `BANK`와 billing의 `BANK_TRANSFER`를 매핑 */
function toLegacyMethod(id: PaymentMethodId): LegacyMethod {
  return id === "BANK_TRANSFER" ? "BANK" : (id as LegacyMethod);
}

function useCountdown(target: string | null): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
} {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);

  if (!target) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: false };
  }
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  const days = Math.floor(diff / (24 * 3600 * 1000));
  const hours = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000));
  const minutes = Math.floor((diff % (3600 * 1000)) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { days, hours, minutes, seconds, expired: false };
}

export function InvoiceView({ invoice }: { invoice: InvoiceData }) {
  const icon = CATEGORY_ICON[invoice.category] ?? "📄";
  const catLabel = CATEGORY_LABEL[invoice.category] ?? invoice.category;
  const isPaid =
    invoice.status === "PAID" ||
    invoice.status === "CONFIRMED" ||
    invoice.status === "REFUNDED";
  const isClosed =
    isPaid || invoice.status === "CANCELED" || invoice.status === "EXPIRED";

  // 허용 결제수단 (없으면 전체)
  const rawAllowed = (invoice.payment_methods ?? []).filter(Boolean);
  const allowedMethods = rawAllowed
    .map((m) => (m === "BANK_TRANSFER" || m === "BANK" ? "BANK_TRANSFER" : m))
    .filter((m): m is PaymentMethodId =>
      ["CARD", "KAKAOPAY", "TOSSPAY", "NAVERPAY", "BANK_TRANSFER"].includes(m)
    );
  const defaultMethod: PaymentMethodId = allowedMethods[0] ?? "CARD";

  const [method, setMethod] = useState<PaymentMethodId>(defaultMethod);
  const [modalOpen, setModalOpen] = useState(false);
  const [paymentDone, setPaymentDone] = useState<PaymentResult | null>(null);
  const [taxRequested, setTaxRequested] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const countdown = useCountdown(invoice.expires_at);

  const handleConfirm = async (result: PaymentResult) => {
    setPaymentDone(result);
    setModalOpen(false);
    setConfirmError(null);

    // 서버에 확정 요청
    startTransition(async () => {
      try {
        const res = await fetch(`/api/invoices/${invoice.id}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method: toLegacyMethod(method),
            pg_transaction_id: result.transactionId,
          }),
        });
        if (!res.ok) {
          const t = await res.text();
          setConfirmError(t || "결제 확정에 실패했습니다");
        }
      } catch (e) {
        setConfirmError(
          e instanceof Error ? e.message : "네트워크 오류가 발생했습니다"
        );
      }
    });
  };

  const handleTaxRequest = async () => {
    setTaxRequested(true);
    try {
      await fetch(`/api/invoices/${invoice.id}/tax-invoice`, { method: "POST" });
    } catch {
      // best effort — UI에만 반영
    }
  };

  const fmt = (n: number) => n.toLocaleString("ko-KR");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* 헤더 카드 */}
      <section className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-lg">
        <div className="flex items-start gap-3">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl backdrop-blur-sm"
            aria-hidden="true"
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] tracking-[0.3em] opacity-70">TORIRO INVOICE</p>
            <h1 className="mt-0.5 text-xl font-extrabold truncate">
              {invoice.description ?? catLabel}
            </h1>
            <p className="mt-1 text-xs opacity-80 font-mono">
              {invoice.invoice_number}
            </p>
          </div>
          <InvoiceStatusBadge status={invoice.status} size="sm" />
        </div>
      </section>

      {/* 카운트다운 (결제 대기 중 + 만료일 있을 때) */}
      {!isClosed && invoice.expires_at && (
        <section
          className={`rounded-2xl border p-4 ${
            countdown.expired
              ? "border-red-200 bg-red-50"
              : countdown.days <= 1
                ? "border-amber-200 bg-amber-50"
                : "border-[#D4E4BC] bg-white"
          }`}
          aria-live="polite"
        >
          <p className="text-[11px] font-semibold text-[#8B6F47]">
            ⏱️ 결제 마감까지
          </p>
          {countdown.expired ? (
            <p className="mt-1 text-lg font-bold text-red-600">
              만료되었습니다
            </p>
          ) : (
            <div className="mt-2 grid grid-cols-4 gap-2 text-center">
              <TimeBox label="일" value={countdown.days} />
              <TimeBox label="시간" value={countdown.hours} />
              <TimeBox label="분" value={countdown.minutes} />
              <TimeBox label="초" value={countdown.seconds} />
            </div>
          )}
          <p className="mt-2 text-[11px] text-[#6B6560]">
            만료일:{" "}
            {new Date(invoice.expires_at).toLocaleString("ko-KR", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </section>
      )}

      {/* 상세 정보 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <h2 className="text-sm font-bold text-[#2D5A3D] mb-3">📋 결제 내역</h2>
        <dl className="space-y-2 text-sm">
          <Row label="받는 분">
            <span className="font-semibold">
              {invoice.target_name ?? "—"}
            </span>
            <span className="ml-1 text-[11px] text-[#8B6F47]">
              ({invoice.target_type})
            </span>
          </Row>
          <Row label="항목">{catLabel}</Row>
          {invoice.description && <Row label="설명">{invoice.description}</Row>}
          {invoice.category === "ACORN_RECHARGE" &&
            invoice.acorns_credited != null && (
              <Row label="지급 도토리">
                <span className="inline-flex items-center gap-1 font-bold text-[#2D5A3D]">
                  <AcornIcon /> {fmt(invoice.acorns_credited)}개
                </span>
                {invoice.bonus_rate && invoice.bonus_rate > 0 ? (
                  <span className="ml-1.5 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">
                    +{Math.round(invoice.bonus_rate * 100)}% 보너스
                  </span>
                ) : null}
              </Row>
            )}
        </dl>

        <div className="mt-4 rounded-xl bg-[#FFF8F0] border border-[#E5D3B8] p-4 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-[#8B6F47]">공급가액</span>
            <span className="tabular-nums">{fmt(invoice.amount)}원</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-[#8B6F47]">부가세 (VAT 10%)</span>
            <span className="tabular-nums">{fmt(invoice.vat)}원</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between border-t border-[#E5D3B8] pt-3">
            <span className="font-bold text-[#6B4423]">총 결제금액</span>
            <span className="text-2xl font-extrabold text-[#2D5A3D] tabular-nums">
              {fmt(invoice.total_amount)}
              <span className="ml-0.5 text-sm">원</span>
            </span>
          </div>
        </div>
      </section>

      {/* 결제 영역 */}
      {paymentDone ? (
        <section className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6 text-center">
          <div className="text-5xl" aria-hidden="true">
            ✅
          </div>
          <h2 className="mt-3 text-xl font-extrabold text-emerald-800">
            결제가 완료되었습니다!
          </h2>
          <p className="mt-2 text-sm text-emerald-700">
            거래번호:{" "}
            <span className="font-mono text-xs">
              {paymentDone.transactionId}
            </span>
          </p>
          {isPending && (
            <p className="mt-2 text-xs text-emerald-600">
              결제 확정 처리 중...
            </p>
          )}
          {confirmError && (
            <p
              role="alert"
              className="mt-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700"
            >
              ⚠️ {confirmError}
            </p>
          )}
          <p className="mt-4 text-xs text-emerald-700">
            자세한 내역은 이메일로 발송해드렸습니다 🌳
          </p>
        </section>
      ) : isPaid ? (
        <section className="rounded-2xl bg-blue-50 border border-blue-200 p-5 text-center">
          <p className="text-2xl" aria-hidden="true">💙</p>
          <p className="mt-1 text-sm font-semibold text-blue-900">
            이미 결제가 완료된 청구서입니다
          </p>
          {invoice.paid_at && (
            <p className="mt-1 text-xs text-blue-700">
              결제일시:{" "}
              {new Date(invoice.paid_at).toLocaleString("ko-KR")}
            </p>
          )}
        </section>
      ) : isClosed ? (
        <section className="rounded-2xl bg-neutral-100 border border-neutral-300 p-5 text-center">
          <p className="text-sm font-semibold text-neutral-700">
            {invoice.status === "EXPIRED"
              ? "만료된 청구서입니다"
              : "취소된 청구서입니다"}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            새로운 청구서를 발급받으려면 담당자에게 문의해주세요
          </p>
        </section>
      ) : countdown.expired ? (
        <section className="rounded-2xl bg-red-50 border border-red-200 p-5 text-center">
          <p className="text-sm font-semibold text-red-700">
            결제 기한이 만료되었습니다
          </p>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
            <h2 className="text-sm font-bold text-[#2D5A3D] mb-3">
              💳 결제 수단 선택
            </h2>
            <PaymentMethods
              value={method}
              onChange={setMethod}
              bankAccount={invoice.bank_account}
              allowed={allowedMethods.length > 0 ? allowedMethods : undefined}
            />
          </section>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="w-full rounded-2xl bg-[#2D5A3D] py-4 text-lg font-extrabold text-white shadow-lg hover:bg-[#1F4229] transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2D5A3D]/30"
          >
            💳 {fmt(invoice.total_amount)}원 결제하기
          </button>
        </>
      )}

      {/* 세금계산서 요청 */}
      {isPaid && (
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
          <button
            type="button"
            onClick={handleTaxRequest}
            disabled={taxRequested}
            className="w-full rounded-xl border-2 border-[#2D5A3D] bg-white py-3 text-sm font-bold text-[#2D5A3D] hover:bg-[#E8F0E4] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {taxRequested ? "✅ 세금계산서 요청 완료" : "📄 세금계산서 요청"}
          </button>
          <p className="mt-2 text-[11px] text-center text-[#8B6F47]">
            사업자등록증을 가진 분만 요청 가능합니다
          </p>
        </section>
      )}

      {/* 푸터 */}
      <footer className="text-center text-[11px] text-[#8B6F47] pt-4 pb-8">
        <p>🌳 토리로 TORIRO</p>
        <p className="mt-1">
          결제 문의: <span className="font-mono">support@toriro.com</span>
        </p>
      </footer>

      <PaymentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleConfirm}
        orderName={invoice.description ?? catLabel}
        amount={invoice.total_amount}
        orderPrefix="INV"
        metadata={{ invoice_id: invoice.id, invoice_number: invoice.invoice_number }}
      />
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="w-20 flex-shrink-0 text-xs text-[#8B6F47]">{label}</dt>
      <dd className="text-right text-sm text-[#2C2C2C]">{children}</dd>
    </div>
  );
}

function TimeBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white border border-[#D4E4BC] py-2">
      <div className="text-xl font-extrabold text-[#2D5A3D] tabular-nums">
        {String(value).padStart(2, "0")}
      </div>
      <div className="text-[10px] text-[#8B6F47] font-medium">{label}</div>
    </div>
  );
}
