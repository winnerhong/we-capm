/**
 * Mock payment service — mimics portone/toss structure.
 *
 * 현재는 테스트(MOCK)로 동작하며, 추후 실제 PG(포트원/토스페이먼츠)
 * 연동으로 교체될 수 있도록 요청/응답 인터페이스를 맞춰두었습니다.
 *
 * Future: swap implementation to real PG
 *   - portone: `@portone/browser-sdk` → `PortOne.requestPayment(...)`
 *   - toss:    `loadTossPayments(clientKey).requestPayment(...)`
 * 이 파일의 `mockPaymentRequest` 하나만 교체하면 됩니다.
 */

export type PaymentMethod = "CARD" | "KAKAOPAY" | "NAVERPAY" | "TOSSPAY" | "BANK";

export interface PaymentRequest {
  orderName: string;
  amount: number;
  orderId: string;
  method?: PaymentMethod;
  metadata?: Record<string, unknown>;
}

export interface PaymentResult {
  ok: boolean;
  transactionId?: string;
  receiptUrl?: string;
  error?: string;
  method?: PaymentMethod;
  amount?: number;
  paidAt?: string;
}

/**
 * 결제 요청 (mock).
 * - 1.5초 지연으로 실제 PG 호출을 흉내냅니다.
 * - 95% 확률로 성공, 5% 확률로 실패합니다.
 */
export async function mockPaymentRequest(req: PaymentRequest): Promise<PaymentResult> {
  // Simulate 1.5s processing (PG 결제창 왕복 시간)
  await new Promise((r) => setTimeout(r, 1500));

  // 95% success rate
  if (Math.random() < 0.95) {
    return {
      ok: true,
      transactionId: `TXN_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      method: req.method ?? "CARD",
      amount: req.amount,
      paidAt: new Date().toISOString(),
      receiptUrl: `#receipt-${Date.now()}`,
    };
  }

  return {
    ok: false,
    error: "결제 실패 - 다시 시도해주세요",
  };
}

/**
 * 주문번호 생성기.
 * 예: `TORIRO_1713561000000_AB12CD`
 */
export function generateOrderId(prefix = "TORIRO"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/**
 * 결제 수단 라벨 (UI 공용).
 */
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CARD: "신용/체크카드",
  KAKAOPAY: "카카오페이",
  NAVERPAY: "네이버페이",
  TOSSPAY: "토스페이",
  BANK: "계좌이체",
};
