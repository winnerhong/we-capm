import Link from "next/link";
import { redirect } from "next/navigation";
import { getPartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type TaxInvoiceRow = {
  id: string;
  invoice_id: string | null;
  tax_invoice_number: string | null;
  type: string;
  supplier_name: string | null;
  buyer_name: string | null;
  item_name: string;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
  issue_date: string;
  hometax_status: string | null;
  pdf_url: string | null;
};

function wonKR(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

const TYPE_LABEL: Record<string, string> = {
  TAX: "세금계산서",
  CASH_RECEIPT: "현금영수증",
  SIMPLE_RECEIPT: "간이영수증",
};

function hometaxMeta(status: string | null): {
  label: string;
  bg: string;
  text: string;
} {
  switch (status) {
    case "APPROVED":
      return {
        label: "국세청 승인",
        bg: "bg-emerald-100",
        text: "text-emerald-800",
      };
    case "SUBMITTED":
      return { label: "제출", bg: "bg-sky-100", text: "text-sky-800" };
    case "REJECTED":
      return { label: "반려", bg: "bg-rose-100", text: "text-rose-700" };
    case "PENDING":
    default:
      return { label: "대기", bg: "bg-amber-100", text: "text-amber-800" };
  }
}

async function loadReceipts(partnerId: string): Promise<TaxInvoiceRow[]> {
  const supabase = await createClient();

  // 1) 이 파트너가 target인 invoice들의 id 조회
  let invoiceIds: string[] = [];
  try {
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: string) => Promise<{
                data: { id: string }[] | null;
              }>;
            };
          };
        };
      }
    )
      .from("invoices")
      .select("id")
      .eq("target_type", "PARTNER")
      .eq("target_id", partnerId);
    invoiceIds = (data ?? []).map((r) => r.id);
  } catch {
    return [];
  }

  if (invoiceIds.length === 0) return [];

  // 2) tax_invoices 조회
  try {
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            in: (k: string, v: string[]) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => Promise<{ data: TaxInvoiceRow[] | null }>;
            };
          };
        };
      }
    )
      .from("tax_invoices")
      .select(
        "id, invoice_id, tax_invoice_number, type, supplier_name, buyer_name, item_name, supply_amount, tax_amount, total_amount, issue_date, hometax_status, pdf_url",
      )
      .in("invoice_id", invoiceIds)
      .order("issue_date", { ascending: false });
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function PartnerReceiptsPage() {
  const partner = await getPartner();
  if (!partner) redirect("/partner");

  const receipts = await loadReceipts(partner.id);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/partner/billing"
          className="text-sm font-medium text-[#2D5A3D] hover:underline"
        >
          ← 결제 &amp; 정산
        </Link>
      </div>

      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[#2D5A3D]">
          <span>📄</span>
          <span>영수증 · 세금계산서</span>
        </h1>
        <p className="mt-1 text-sm text-[#6B6560]">
          결제 완료된 청구서에 대한 세금계산서와 영수증을 보관해요.
        </p>
      </header>

      {receipts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <span className="text-5xl" aria-hidden>
            📭
          </span>
          <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
            발급된 세금계산서가 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            결제가 확정되면 청구서 상세 페이지에서 &ldquo;세금계산서 받기&rdquo;를
            눌러 발급받을 수 있어요.
          </p>
          <Link
            href="/partner/billing/invoices?filter=confirmed"
            className="mt-4 inline-block rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3A7A52]"
          >
            완료된 청구서 보기 →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {receipts.map((r) => {
            const meta = hometaxMeta(r.hometax_status);
            return (
              <li
                key={r.id}
                className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#E8F0E4] px-2.5 py-0.5 text-[10px] font-bold text-[#2D5A3D]">
                        {TYPE_LABEL[r.type] ?? r.type}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${meta.bg} ${meta.text}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-base font-bold text-[#2D5A3D]">
                      {r.item_name}
                    </p>
                    {r.tax_invoice_number && (
                      <p className="mt-0.5 font-mono text-[11px] text-[#8B6F47]">
                        {r.tax_invoice_number}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-extrabold text-[#2D5A3D]">
                      {wonKR(r.total_amount)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[#8B6F47]">
                      공급가 {wonKR(r.supply_amount)} · 세액{" "}
                      {wonKR(r.tax_amount)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-[#D4E4BC] pt-3 text-[11px] text-[#8B6F47]">
                  <span>
                    발행{" "}
                    {new Date(r.issue_date).toLocaleDateString("ko-KR")}
                    {r.supplier_name && ` · 공급자 ${r.supplier_name}`}
                  </span>
                  {r.pdf_url ? (
                    <a
                      href={r.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
                    >
                      📥 PDF 다운로드
                    </a>
                  ) : (
                    <span className="text-[10px] text-[#B5AFA8]">
                      PDF 준비 중
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
