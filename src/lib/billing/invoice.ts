import type { SupabaseClient } from "@supabase/supabase-js";

export type InvoiceCategory =
  | "ACORN_RECHARGE"
  | "SUBSCRIPTION"
  | "EVENT_FEE"
  | "AD_CAMPAIGN"
  | "COUPON_FEE"
  | "B2B_CONTRACT"
  | "SETTLEMENT"
  | "REFUND"
  | "OTHER";

export type InvoiceTargetType =
  | "PARTNER"
  | "MANAGER"
  | "PARTICIPANT"
  | "ADVERTISER"
  | "AFFILIATE"
  | "ORG"
  | "B2B_CLIENT";

export type PaymentMethod =
  | "CARD"
  | "KAKAOPAY"
  | "NAVERPAY"
  | "TOSSPAY"
  | "BANK_TRANSFER"
  | "VIRTUAL_ACCOUNT"
  | "ESCROW";

export type InvoiceStatus =
  | "DRAFT"
  | "PENDING"
  | "PAID"
  | "CONFIRMED"
  | "EXPIRED"
  | "CANCELED"
  | "REFUNDED";

/**
 * Invoice number format: INV-YYYYMMDD-XXXX
 */
export function generateInvoiceNumber(): string {
  const date = new Date();
  const yyyymmdd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}${String(date.getDate()).padStart(2, "0")}`;
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${yyyymmdd}-${random}`;
}

/**
 * Opaque payment link token embedded in the public pay URL.
 */
export function generatePaymentToken(): string {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

/**
 * 도토리 충전 보너스 계산 (amount 기준, 공급가 기준).
 *   1000원 = 1 도토리
 *   300k 이상: +10% / 1M 이상: +15% / 3M 이상: +20%
 */
export function calculateAcornBonus(amountKrw: number): {
  acorns: number;
  bonusRate: number;
  bonusAcorns: number;
} {
  const baseAcorns = Math.floor(amountKrw / 1000);
  let bonusRate = 0;
  if (amountKrw >= 3_000_000) bonusRate = 0.2;
  else if (amountKrw >= 1_000_000) bonusRate = 0.15;
  else if (amountKrw >= 300_000) bonusRate = 0.1;

  const bonusAcorns = Math.floor(baseAcorns * bonusRate);
  return { acorns: baseAcorns, bonusRate, bonusAcorns };
}

/**
 * VAT 10% calculation. `supply`는 공급가액.
 */
export function calculateVat(supply: number): {
  supply: number;
  vat: number;
  total: number;
} {
  const vat = Math.floor(supply * 0.1);
  return { supply, vat, total: supply + vat };
}

export interface CreateInvoiceParams {
  issued_by_type: "ADMIN" | "SYSTEM" | "PARTNER" | "PLATFORM";
  issued_by_id: string;
  target_type: InvoiceTargetType;
  target_id: string;
  target_name?: string;
  target_email?: string;
  target_phone?: string;
  category: InvoiceCategory;
  /** 공급가액 (VAT 제외, KRW) */
  amount: number;
  payment_methods: PaymentMethod[];
  description?: string;
  memo?: string;
  /** 기본 7일 */
  expires_in_days?: number;
  metadata?: Record<string, unknown>;
}

/**
 * 청구서 생성. VAT/보너스/만료일 자동 계산.
 * 실패 시 null 리턴 (throw하지 않음).
 */
export async function createInvoice(
  supabase: SupabaseClient,
  params: CreateInvoiceParams
): Promise<{
  id: string;
  invoice_number: string;
  payment_link_token: string;
} | null> {
  const { amount, category } = params;
  const { vat, total } = calculateVat(amount);
  const bonus =
    category === "ACORN_RECHARGE"
      ? calculateAcornBonus(amount)
      : { acorns: 0, bonusRate: 0, bonusAcorns: 0 };

  const invoice_number = generateInvoiceNumber();
  const payment_link_token = generatePaymentToken();
  const expires_at = new Date();
  expires_at.setDate(expires_at.getDate() + (params.expires_in_days ?? 7));

  const row = {
    invoice_number,
    issued_by_type: params.issued_by_type,
    issued_by_id: params.issued_by_id,
    target_type: params.target_type,
    target_id: params.target_id,
    target_name: params.target_name,
    target_email: params.target_email,
    target_phone: params.target_phone,
    category: params.category,
    amount,
    bonus_rate: bonus.bonusRate,
    bonus_amount: bonus.bonusAcorns,
    vat,
    total_amount: total,
    acorns_credited: bonus.acorns + bonus.bonusAcorns,
    payment_methods: params.payment_methods,
    bank_account: "우리은행 1002-456-789012 (주)토리로",
    payment_link_token,
    description: params.description,
    memo: params.memo,
    metadata: params.metadata ?? {},
    status: "PENDING",
    expires_at: expires_at.toISOString(),
  };

  const sb = supabase as unknown as {
    from: (t: string) => {
      insert: (d: unknown) => {
        select: (c: string) => {
          single: () => Promise<{
            data: {
              id: string;
              invoice_number: string;
              payment_link_token: string;
            } | null;
            error: unknown;
          }>;
        };
      };
    };
  };

  const { data, error } = await sb
    .from("invoices")
    .insert(row)
    .select("id, invoice_number, payment_link_token")
    .single();

  if (error) {
    console.error("[invoice] create failed:", error);
    return null;
  }
  return data;
}

/**
 * 청구서 결제 확정.
 *  1. invoices.status = CONFIRMED + paid/confirmed 타임스탬프
 *  2. payment_transactions 기록
 *  3. ACORN_RECHARGE + PARTNER 타겟이면 partners.acorn_balance 증액 + acorn_recharges 로그
 */
export async function confirmInvoicePayment(
  supabase: SupabaseClient,
  invoiceId: string,
  params: {
    confirmed_by: string;
    method: PaymentMethod;
    pg_transaction_id?: string;
  }
) {
  const sbUpdate = supabase as unknown as {
    from: (t: string) => {
      update: (d: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: unknown }>;
      };
    };
  };

  // 1) Invoice → CONFIRMED
  await sbUpdate
    .from("invoices")
    .update({
      status: "CONFIRMED",
      paid_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      confirmed_by: params.confirmed_by,
    })
    .eq("id", invoiceId);

  // 2) Fetch invoice row for downstream writes
  const sbSelect = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          single: () => Promise<{
            data: {
              amount: number;
              total_amount: number;
              target_type: string;
              target_id: string;
              category: string;
              acorns_credited: number;
            } | null;
          }>;
        };
      };
    };
  };
  const { data: inv } = await sbSelect
    .from("invoices")
    .select(
      "amount, total_amount, target_type, target_id, category, acorns_credited"
    )
    .eq("id", invoiceId)
    .single();

  if (!inv) return;

  // 3) payment_transactions insert
  const txInsert = supabase as unknown as {
    from: (t: string) => { insert: (d: unknown) => Promise<unknown> };
  };
  await txInsert.from("payment_transactions").insert({
    invoice_id: invoiceId,
    method: params.method,
    amount: inv.total_amount,
    net_amount: inv.total_amount,
    pg_transaction_id: params.pg_transaction_id,
    status: "SUCCESS",
    completed_at: new Date().toISOString(),
  });

  // 4) ACORN_RECHARGE + PARTNER: credit balance + log to acorn_recharges
  if (inv.category === "ACORN_RECHARGE" && inv.target_type === "PARTNER") {
    const partnerIO = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            single: () => Promise<{
              data: { acorn_balance: number } | null;
            }>;
          };
        };
        update: (d: unknown) => {
          eq: (k: string, v: string) => Promise<unknown>;
        };
      };
    };
    const { data: p } = await partnerIO
      .from("partners")
      .select("acorn_balance")
      .eq("id", inv.target_id)
      .single();
    if (p) {
      await partnerIO
        .from("partners")
        .update({ acorn_balance: p.acorn_balance + inv.acorns_credited })
        .eq("id", inv.target_id);
    }

    await txInsert.from("acorn_recharges").insert({
      partner_id: inv.target_id,
      amount: inv.amount,
      bonus: Math.floor(inv.amount * 0.1),
      total_credited: inv.acorns_credited,
      payment_method: params.method,
      payment_transaction_id: params.pg_transaction_id,
      status: "COMPLETED",
      completed_at: new Date().toISOString(),
    });
  }
}

/**
 * 청구서 취소 (status=CANCELED). 이미 확정된 건은 refund 플로우를 써야 함.
 */
export async function cancelInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  reason?: string
) {
  const sb = supabase as unknown as {
    from: (t: string) => {
      update: (d: unknown) => {
        eq: (k: string, v: string) => Promise<unknown>;
      };
    };
  };
  await sb
    .from("invoices")
    .update({
      status: "CANCELED",
      canceled_at: new Date().toISOString(),
      memo: reason,
    })
    .eq("id", invoiceId);
}
