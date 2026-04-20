"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PaymentModal } from "@/components/payment-modal";
import type { PaymentResult } from "@/lib/payments";

interface Props {
  invoiceId: string;
  invoiceNumber: string;
  orderName: string;
  amount: number;
  disabled?: boolean;
}

/**
 * 청구서 결제 버튼.
 * - PaymentModal 띄워서 mock 결제 처리
 * - 성공 시 서버에 confirm 요청 (API route) 후 페이지 리로드
 */
export function PayButton({
  invoiceId,
  invoiceNumber,
  orderName,
  amount,
  disabled,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = async (result: PaymentResult) => {
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/partner/invoices/${invoiceId}/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method: result.method ?? "CARD",
            transactionId: result.transactionId,
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "결제 확정에 실패했어요");
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "결제 확정에 실패했어요");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled || confirming}
        className="inline-flex w-full items-center justify-center rounded-xl bg-[#2D5A3D] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {confirming ? "확정 중…" : `💳 ${amount.toLocaleString("ko-KR")}원 결제하기`}
      </button>
      {error && (
        <p
          role="alert"
          className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
        >
          {error}
        </p>
      )}
      <PaymentModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={handleSuccess}
        orderName={orderName}
        amount={amount}
        metadata={{ invoiceId, invoiceNumber }}
      />
    </>
  );
}
