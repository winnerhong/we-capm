import { createClient } from "@/lib/supabase/server";
import {
  confirmInvoicePayment,
  type PaymentMethod,
} from "@/lib/billing/invoice";
import { NextResponse } from "next/server";

/**
 * POST /api/invoice/:id/paid
 *
 * Called by the public invoice page after the client-side PG returns success.
 * This route trusts the invoice's payment_link_token lookup at render time;
 * because the session (or lack thereof) matches what produced the page, RLS
 * governs whether the update actually succeeds.
 *
 * Body: { method?: PaymentMethod; pg_transaction_id?: string }
 */
const ALLOWED_METHODS: PaymentMethod[] = [
  "CARD",
  "KAKAOPAY",
  "NAVERPAY",
  "TOSSPAY",
  "BANK_TRANSFER",
  "VIRTUAL_ACCOUNT",
  "ESCROW",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    method?: string;
    pg_transaction_id?: string;
  };

  const method = (
    ALLOWED_METHODS.includes(body.method as PaymentMethod)
      ? body.method
      : "CARD"
  ) as PaymentMethod;

  const supabase = await createClient();
  try {
    await confirmInvoicePayment(supabase, id, {
      confirmed_by: "self",
      method,
      pg_transaction_id: body.pg_transaction_id,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "결제 확정에 실패했습니다" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
