"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  createInvoice,
  type PaymentMethod,
} from "@/lib/billing/invoice";

/**
 * 파트너 자체 도토리 충전 - 청구서 생성.
 * 결제 플로우:
 *   1) 이 액션이 invoice(status=PENDING) 생성
 *   2) /partner/billing/invoices/[id] 로 이동 → PaymentModal
 *   3) 결제 확정 시 /api/partner/invoices/[id]/confirm → confirmInvoicePayment()
 *      → acorn_balance 증액 + acorn_recharges 기록
 */
export async function selfChargeAcornsAction(formData: FormData) {
  const partner = await requirePartner();

  const amount = Number(formData.get("amount") ?? 0);
  const methods = formData.getAll("method") as string[];

  if (!Number.isFinite(amount) || amount < 10_000) {
    throw new Error("최소 충전 금액은 10,000원이에요");
  }
  if (methods.length === 0) {
    throw new Error("결제 수단을 한 개 이상 선택해주세요");
  }

  const supabase = await createClient();
  const invoice = await createInvoice(supabase, {
    issued_by_type: "PARTNER",
    issued_by_id: partner.id,
    target_type: "PARTNER",
    target_id: partner.id,
    target_name: partner.name,
    category: "ACORN_RECHARGE",
    amount,
    payment_methods: methods as PaymentMethod[],
    description: `도토리 자체 충전 ${amount.toLocaleString("ko-KR")}원`,
    expires_in_days: 7,
  });

  if (!invoice) {
    throw new Error("청구서 생성에 실패했어요. 잠시 후 다시 시도해주세요");
  }

  revalidatePath("/partner/billing");
  revalidatePath("/partner/billing/invoices");
  redirect(`/partner/billing/invoices/${invoice.id}`);
}
