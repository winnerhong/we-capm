"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmPaymentAction,
  cancelInvoiceAction,
  resendInvoiceAction,
  issueTaxInvoiceAction,
} from "../actions";

interface Props {
  invoiceId: string;
  canConfirm: boolean;
  canCancel: boolean;
  canRemind: boolean;
  canIssueTax: boolean;
  reminderCount: number;
  taxInvoiceIssued: boolean;
}

export function InvoiceActions({
  invoiceId,
  canConfirm,
  canCancel,
  canRemind,
  canIssueTax,
  reminderCount,
  taxInvoiceIssued,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const runAction = (
    fn: () => Promise<unknown>,
    successText: string,
  ) => {
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      try {
        await fn();
        setSuccessMsg(successText);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "작업 실패";
        if (msg === "NEXT_REDIRECT") throw e;
        setError(msg);
      }
    });
  };

  const handleCancel = () => {
    if (!cancelReason.trim()) {
      setError("취소 사유를 입력해주세요");
      return;
    }
    runAction(
      () => cancelInvoiceAction(invoiceId, cancelReason),
      "청구서를 취소했어요",
    );
    setShowCancel(false);
  };

  return (
    <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-bold text-[#2D5A3D]">⚡ 액션</h2>
      <div className="flex flex-wrap gap-2">
        {canConfirm && (
          <button
            type="button"
            onClick={() =>
              runAction(
                () => confirmPaymentAction(invoiceId),
                "입금을 확인했어요",
              )
            }
            disabled={isPending}
            className="rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3A7A52] disabled:opacity-50"
          >
            ✓ 입금 확인
          </button>
        )}

        {canRemind && (
          <button
            type="button"
            onClick={() =>
              runAction(
                () => resendInvoiceAction(invoiceId),
                "독촉 메일을 발송했어요",
              )
            }
            disabled={isPending}
            className="rounded-xl border border-amber-500 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            📨 독촉 발송{reminderCount > 0 ? ` (${reminderCount}회)` : ""}
          </button>
        )}

        {canIssueTax && (
          <button
            type="button"
            onClick={() =>
              runAction(
                () => issueTaxInvoiceAction(invoiceId),
                "세금계산서 발행 요청을 접수했어요",
              )
            }
            disabled={isPending}
            className="rounded-xl border border-[#6B4423] bg-[#FFF8F0] px-4 py-2 text-sm font-semibold text-[#6B4423] hover:bg-[#F5E6D3] disabled:opacity-50"
          >
            🧾 세금계산서 발행
          </button>
        )}

        {taxInvoiceIssued && (
          <span className="rounded-xl bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
            ✅ 세금계산서 발행됨
          </span>
        )}

        {canCancel && (
          <button
            type="button"
            onClick={() => setShowCancel(true)}
            disabled={isPending}
            className="rounded-xl border border-red-400 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            ✕ 청구서 취소
          </button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {successMsg && (
        <p className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {successMsg}
        </p>
      )}

      {showCancel && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-title"
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
          onClick={() => !isPending && setShowCancel(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="cancel-title" className="text-lg font-bold text-[#2D5A3D]">
              청구서 취소
            </h3>
            <p className="mt-1 text-xs text-[#6B6560]">
              취소 사유를 입력해주세요. 취소된 청구서는 복구할 수 없어요.
            </p>
            <label
              htmlFor="cancel-reason"
              className="mt-4 block text-sm font-semibold text-[#2D5A3D]"
            >
              취소 사유
            </label>
            <textarea
              id="cancel-reason"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="예) 담당자 요청으로 재발송 예정"
              className="mt-1 w-full resize-none rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowCancel(false)}
                disabled={isPending}
                className="flex-1 rounded-xl border border-[#D4E4BC] bg-white py-2.5 text-sm font-semibold text-[#6B4423] hover:bg-[#FFF8F0] disabled:opacity-50"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isPending}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "처리 중..." : "취소 확정"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
