"use client";

import { useState } from "react";
import { PaymentModal } from "@/components/payment-modal";
import type { PaymentResult } from "@/lib/payments";
import { useRouter } from "next/navigation";

interface Props {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  orderName: string;
}

/**
 * 공개 청구서 페이지의 결제 버튼 + 결제 모달 래퍼.
 * 결제 성공 시 /api/invoice/:id/paid 를 호출하여 서버에서 confirmInvoicePayment 를 돈다.
 * (실제 PG 연동 전에는 mockPaymentRequest 결과로 처리)
 */
export function InvoicePayClient({
  invoiceId,
  invoiceNumber,
  amount,
  orderName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSuccess = async (result: PaymentResult) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoice/${invoiceId}/paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pg_transaction_id: result.transactionId,
          method: result.method,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "결제 확정에 실패했습니다");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={submitting}
        className="w-full rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {submitting ? "결제 확정 중..." : "결제하기"}
      </button>
      {error && (
        <p className="mt-2 text-center text-sm text-red-600">{error}</p>
      )}
      <PaymentModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={handleSuccess}
        orderName={orderName}
        amount={amount}
        orderPrefix="INV"
        metadata={{ invoiceId, invoiceNumber }}
      />
    </>
  );
}
