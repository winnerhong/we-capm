import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { InvoiceView } from "./InvoiceView";

/**
 * 공개 청구서 페이지 — /invoice/:id
 * 링크만 있으면 누구나 볼 수 있고 결제 가능 (토큰 기반 공개 URL).
 * 서버 컴포넌트에서 청구서를 조회하고, 결제 플로우는 InvoiceView 클라이언트에 위임.
 */
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          single: () => Promise<{
            data: {
              id: string;
              invoice_number: string;
              target_name: string | null;
              target_type: string;
              category: string;
              amount: number;
              vat: number;
              total_amount: number;
              acorns_credited: number | null;
              bonus_rate: number | null;
              description: string | null;
              bank_account: string | null;
              payment_methods: string[] | null;
              status: string;
              issued_at: string | null;
              expires_at: string | null;
              paid_at: string | null;
            } | null;
          }>;
        };
      };
    };
  };

  const { data: invoice } = await sb
    .from("invoices")
    .select(
      "id, invoice_number, target_name, target_type, category, amount, vat, total_amount, acorns_credited, bonus_rate, description, bank_account, payment_methods, status, issued_at, expires_at, paid_at"
    )
    .eq("id", id)
    .single();

  if (!invoice) notFound();

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#FFF8F0] to-[#E8F0E4] py-8 px-4">
      <InvoiceView invoice={invoice} />
    </main>
  );
}
