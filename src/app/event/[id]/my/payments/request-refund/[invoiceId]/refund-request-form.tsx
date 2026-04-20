"use client";

import { useState, useTransition } from "react";
import { requestRefundAction } from "../../actions";

const REASON_CATEGORIES = [
  { value: "SCHEDULE_CONFLICT", label: "일정 변경·충돌" },
  { value: "HEALTH", label: "건강상 사유" },
  { value: "SERVICE_ISSUE", label: "서비스 문제" },
  { value: "DUPLICATE", label: "중복 결제" },
  { value: "OTHER", label: "기타" },
] as const;

type ReasonCategory = (typeof REASON_CATEGORIES)[number]["value"];

export function RefundRequestForm({
  eventId,
  invoiceId,
  defaultAmount,
  maxAmount,
}: {
  eventId: string;
  invoiceId: string;
  defaultAmount: number;
  maxAmount: number;
}) {
  const [category, setCategory] = useState<ReasonCategory>("SCHEDULE_CONFLICT");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (reason.trim().length < 5) {
      setError("환불 사유를 5자 이상 자세히 작성해주세요.");
      return;
    }
    if (amount < 0 || amount > maxAmount) {
      setError(`환불 요청액은 0 ~ ${maxAmount.toLocaleString("ko-KR")}원 사이여야 해요.`);
      return;
    }

    const fd = new FormData();
    fd.set("reason_category", category);
    fd.set("reason", reason.trim());
    fd.set("expected_amount", String(amount));

    startTransition(async () => {
      try {
        await requestRefundAction(eventId, invoiceId, fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "요청 실패");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm"
      noValidate
    >
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
        <span>✍️</span>
        <span>환불 요청 작성</span>
      </h2>

      {/* 사유 카테고리 */}
      <div className="mb-4">
        <label
          htmlFor="reason_category"
          className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
        >
          사유 분류 <span className="text-rose-500">*</span>
        </label>
        <select
          id="reason_category"
          name="reason_category"
          value={category}
          onChange={(e) => setCategory(e.target.value as ReasonCategory)}
          required
          className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
        >
          {REASON_CATEGORIES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* 상세 사유 */}
      <div className="mb-4">
        <label
          htmlFor="reason"
          className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
        >
          상세 사유 <span className="text-rose-500">*</span>{" "}
          <span className="text-[10px] font-normal text-[#8B7F75]">
            (5자 이상, 200자 이내)
          </span>
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={5}
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="환불이 필요한 구체적인 상황을 알려주세요."
          required
          aria-describedby="reason-help"
          className="w-full resize-none rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B8A898] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
        />
        <p
          id="reason-help"
          className="mt-1 text-right text-[11px] text-[#8B7F75]"
        >
          {reason.length} / 200
        </p>
      </div>

      {/* 요청 금액 */}
      <div className="mb-4">
        <label
          htmlFor="expected_amount"
          className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
        >
          요청 금액 (원) <span className="text-rose-500">*</span>
        </label>
        <input
          id="expected_amount"
          name="expected_amount"
          type="number"
          inputMode="numeric"
          min={0}
          max={maxAmount}
          step={100}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value) || 0)}
          required
          aria-describedby="amount-help"
          className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-right text-sm font-semibold text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
        />
        <p id="amount-help" className="mt-1 text-[11px] text-[#8B7F75]">
          기본값은 정책상 예상 환불액이며, 최대{" "}
          {maxAmount.toLocaleString("ko-KR")}원까지 요청 가능해요. 최종
          환불액은 관리자가 결정합니다.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
        >
          ⚠️ {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D5A3D] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#1F3F2A] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "요청 중..." : "환불 요청 제출"}
      </button>

      <p className="mt-3 text-[11px] leading-relaxed text-[#8B7F75]">
        제출 후 관리자가 확인하며, 승인/반려 결과는 결제 상세 화면에서 확인할
        수 있어요.
      </p>
    </form>
  );
}
