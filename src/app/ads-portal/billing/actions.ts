"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createInvoice } from "@/lib/billing/invoice";

/**
 * 광고주 선결제 보증금(선수금) 충전.
 *
 * 현재 Stage 1: 쿠키에서 advertiser_id를 꺼낼 수 없으므로 ADMIN 폴백 사용.
 * Future: 광고주 세션 구현 후 쿠키 기반으로 교체.
 */
export async function prepayDepositAction(formData: FormData) {
  const amount = Number(formData.get("amount") ?? 0);
  const paymentMethodRaw = String(formData.get("payment_method") ?? "BANK_TRANSFER");
  const company = String(formData.get("company") ?? "").trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("충전 금액이 올바르지 않습니다");
  }

  const supabase = await createClient();

  const paymentMethod =
    paymentMethodRaw === "CARD" || paymentMethodRaw === "BANK_TRANSFER"
      ? paymentMethodRaw
      : "BANK_TRANSFER";

  const invoice = await createInvoice(supabase, {
    issued_by_type: "SYSTEM",
    issued_by_id: "ads-portal",
    target_type: "ADVERTISER",
    // Stage 1 fallback — 실제 광고주 세션 연동 전까지는 placeholder
    target_id: "advertiser-self",
    target_name: company || "광고주",
    category: "AD_CAMPAIGN",
    amount,
    payment_methods: [paymentMethod],
    description: "광고 선수금 충전",
    memo: "prepay deposit",
    metadata: {
      source: "ads-portal/billing/prepay",
      prepay: true,
    },
  });

  if (!invoice) {
    // createInvoice는 실패 시 null을 리턴 (스키마 미반영 환경 대비).
    // UI에는 에러 토스트 대신 청구서 목록으로 복귀.
    redirect("/ads-portal/billing?error=invoice_failed");
  }

  revalidatePath("/ads-portal/billing");
  redirect(`/ads-portal/billing/invoices/${invoice.id}?created=1`);
}

/**
 * 세금계산서 발행 요청. 실제 발행은 운영팀에서 수동 처리(Stage 1).
 */
export async function requestTaxInvoiceAction(
  invoiceId: string,
  formData: FormData
) {
  if (!invoiceId) throw new Error("청구서 ID가 필요합니다");

  const business_number = String(formData.get("business_number") ?? "").trim();
  const company_name = String(formData.get("company_name") ?? "").trim();
  const ceo_name = String(formData.get("ceo_name") ?? "").trim();
  const business_type = String(formData.get("business_type") ?? "").trim();
  const business_item = String(formData.get("business_item") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();

  if (!business_number || !company_name || !email) {
    throw new Error("사업자등록번호·상호·이메일은 필수입니다");
  }

  const supabase = await createClient();

  const sb = supabase as unknown as {
    from: (t: string) => {
      update: (d: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };

  const { error } = await sb
    .from("invoices")
    .update({
      tax_invoice_requested: true,
      tax_invoice_requested_at: new Date().toISOString(),
      metadata: {
        tax_invoice: {
          business_number,
          company_name,
          ceo_name,
          business_type,
          business_item,
          email,
          address,
          requested_at: new Date().toISOString(),
        },
      },
    })
    .eq("id", invoiceId);

  // 스키마에 tax_invoice_* 컬럼이 없을 수 있음 — 실패해도 UI 흐름은 유지.
  if (error) {
    console.warn("[tax-invoice] update failed:", error.message);
  }

  revalidatePath(`/ads-portal/billing/invoices/${invoiceId}`);
  redirect(`/ads-portal/billing/invoices/${invoiceId}?tax=1`);
}
