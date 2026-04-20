"use client";

import { useEffect, useState } from "react";
import {
  mockPaymentRequest,
  generateOrderId,
  type PaymentMethod,
  type PaymentResult,
} from "@/lib/payments";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (result: PaymentResult) => void;
  orderName: string;
  amount: number;
  /** 주문 ID prefix — 기본값 "TORIRO" */
  orderPrefix?: string;
  /** 메타데이터 (서버 로깅용) */
  metadata?: Record<string, unknown>;
}

/**
 * 결제 모달 (portone/toss 스타일).
 * - 결제 수단 선택 → 결제 버튼 → 1.5s 진행 시뮬레이션
 * - 모바일은 바텀시트, 데스크톱은 센터 모달
 * - Esc 키로 닫기, 바깥 클릭으로 닫기 (처리 중엔 잠금)
 *
 * NOTE: Inner component is mounted/unmounted with `open`, which gives us
 * a natural state reset without needing a setState-in-effect.
 */
export function PaymentModal(props: Props) {
  if (!props.open) return null;
  return <PaymentModalInner {...props} />;
}

function PaymentModalInner({
  onClose,
  onSuccess,
  orderName,
  amount,
  orderPrefix,
  metadata,
}: Props) {
  const [method, setMethod] = useState<PaymentMethod>("CARD");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Esc 키로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !processing) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [processing, onClose]);

  const handlePay = async () => {
    setProcessing(true);
    setError(null);
    const result = await mockPaymentRequest({
      orderName,
      amount,
      orderId: generateOrderId(orderPrefix),
      method,
      metadata,
    });
    setProcessing(false);

    if (result.ok) {
      onSuccess(result);
    } else {
      setError(result.error ?? "결제 실패");
    }
  };

  const methods: { id: PaymentMethod; label: string; icon: string; color: string }[] = [
    { id: "CARD", label: "신용/체크카드", icon: "💳", color: "bg-neutral-100" },
    { id: "KAKAOPAY", label: "카카오페이", icon: "💛", color: "bg-yellow-100" },
    { id: "TOSSPAY", label: "토스페이", icon: "💙", color: "bg-blue-100" },
    { id: "NAVERPAY", label: "네이버페이", icon: "💚", color: "bg-green-100" },
    { id: "BANK", label: "계좌이체", icon: "🏦", color: "bg-neutral-100" },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => {
        if (!processing) onClose();
      }}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 id="payment-modal-title" className="text-lg font-bold text-[#2D5A3D]">
              결제하기
            </h2>
            <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold">
              테스트 모드
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#6B6560] text-xl hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {/* 주문 정보 */}
        <div className="rounded-xl bg-[#FFF8F0] border border-[#D4E4BC] p-4 mb-4">
          <p className="text-xs text-[#6B6560]">{orderName}</p>
          <p className="text-2xl font-bold text-[#2D5A3D] mt-1">
            ₩ {amount.toLocaleString("ko-KR")}
          </p>
        </div>

        {/* 결제 수단 */}
        <div className="space-y-2 mb-4">
          <p className="text-sm font-semibold text-[#2C2C2C]">결제 수단</p>
          {methods.map((m) => {
            const active = method === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                disabled={processing}
                aria-pressed={active}
                className={`w-full rounded-xl border px-4 py-3 flex items-center gap-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D] disabled:opacity-60 ${
                  active
                    ? "border-[#2D5A3D] bg-[#E8F0E4] ring-2 ring-[#2D5A3D]"
                    : "border-[#D4E4BC] bg-white hover:bg-[#FFF8F0]"
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl ${m.color}`}
                  aria-hidden="true"
                >
                  {m.icon}
                </span>
                <span className="font-medium text-[#2C2C2C]">{m.label}</span>
                {active && (
                  <span className="ml-auto text-[#2D5A3D] font-bold" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 오류 메시지 */}
        {error && (
          <p
            role="alert"
            className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-3"
          >
            {error}
          </p>
        )}

        {/* 결제 버튼 */}
        <button
          type="button"
          onClick={handlePay}
          disabled={processing}
          className="w-full rounded-2xl bg-[#2D5A3D] py-4 font-bold text-white hover:bg-[#1F4229] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2D5A3D]/30"
        >
          {processing ? (
            <span className="inline-flex items-center gap-2">
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-hidden="true"
              />
              결제 진행 중...
            </span>
          ) : (
            `₩ ${amount.toLocaleString("ko-KR")} 결제하기`
          )}
        </button>

        <p className="text-[10px] text-center text-[#6B6560] mt-3">
          🔒 결제는 암호화되어 안전하게 처리됩니다 (테스트 모드)
        </p>
      </div>
    </div>
  );
}
