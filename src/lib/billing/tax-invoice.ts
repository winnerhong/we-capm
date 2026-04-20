import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 세금계산서 번호: YYMM-XXXXX (국세청 포맷 흉내낸 mock).
 * 실제 발행은 바이브릿지/홈택스 API를 통해 내려받는 승인번호를 써야 함.
 */
export function generateTaxInvoiceNumber(): string {
  const date = new Date();
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const random = Math.floor(10000 + Math.random() * 90000);
  return `${yy}${mm}-${random}`;
}

export interface BuyerInfo {
  business_number?: string;
  name: string;
  representative?: string;
  address?: string;
  email?: string;
}

/**
 * 세금계산서 발행 (현재는 mock: hometax_status=SUBMITTED로 바로 기록).
 * 실제 연동 시 SUBMITTED → 홈택스 콜백으로 APPROVED 전환 필요.
 */
export async function issueTaxInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  buyerInfo: BuyerInfo
) {
  // Load source invoice
  const sbSelect = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          single: () => Promise<{
            data: {
              amount: number;
              vat: number;
              total_amount: number;
              description: string | null;
              category: string;
            } | null;
          }>;
        };
      };
    };
  };
  const { data: inv } = await sbSelect
    .from("invoices")
    .select("amount, vat, total_amount, description, category")
    .eq("id", invoiceId)
    .single();
  if (!inv) return null;

  const sb = supabase as unknown as {
    from: (t: string) => {
      insert: (d: unknown) => {
        select: (c: string) => {
          single: () => Promise<{
            data: { id: string; tax_invoice_number: string } | null;
          }>;
        };
      };
      update: (d: unknown) => {
        eq: (k: string, v: string) => Promise<unknown>;
      };
    };
  };

  const { data: tax } = await sb
    .from("tax_invoices")
    .insert({
      invoice_id: invoiceId,
      tax_invoice_number: generateTaxInvoiceNumber(),
      type: "TAX",
      supplier_business_number: "000-00-00000",
      supplier_name: "(주)토리로",
      supplier_representative: "홍길동",
      supplier_address: "서울특별시 강남구",
      buyer_business_number: buyerInfo.business_number,
      buyer_name: buyerInfo.name,
      buyer_representative: buyerInfo.representative,
      buyer_address: buyerInfo.address,
      buyer_email: buyerInfo.email,
      item_name: inv.description ?? `${inv.category} 결제`,
      supply_amount: inv.amount,
      tax_amount: inv.vat,
      total_amount: inv.total_amount,
      hometax_status: "SUBMITTED",
    })
    .select("id, tax_invoice_number")
    .single();

  if (tax) {
    await sb
      .from("invoices")
      .update({ tax_invoice_issued: true })
      .eq("id", invoiceId);
  }

  return tax;
}
