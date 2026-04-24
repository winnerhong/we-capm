import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { getPartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { PayButton } from "./pay-button";
import { CopyButton } from "./copy-button";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  category: string;
  amount: number;
  vat: number;
  total_amount: number;
  acorns_credited: number | null;
  bonus_rate: number | null;
  bonus_amount: number | null;
  status: string;
  expires_at: string;
  issued_at: string;
  paid_at: string | null;
  confirmed_at: string | null;
  bank_account: string | null;
  payment_methods: string[];
  description: string | null;
  memo: string | null;
  target_type: string;
  target_id: string;
  target_name: string | null;
  tax_invoice_issued: boolean | null;
};

const CATEGORY_LABEL: Record<string, ReactNode> = {
  ACORN_RECHARGE: (
    <>
      <AcornIcon /> 도토리 충전
    </>
  ),
  SUBSCRIPTION: "📅 구독료",
  EVENT_FEE: "🎪 행사 비용",
  AD_CAMPAIGN: "📢 광고 캠페인",
  COUPON_FEE: "🎁 쿠폰 수수료",
  B2B_CONTRACT: "🏢 B2B 계약",
  SETTLEMENT: "💸 정산",
  REFUND: "↩️ 환불",
  OTHER: "📄 기타",
};

const METHOD_LABEL: Record<string, string> = {
  CARD: "신용/체크카드",
  KAKAOPAY: "카카오페이",
  NAVERPAY: "네이버페이",
  TOSSPAY: "토스페이",
  BANK_TRANSFER: "계좌이체",
  VIRTUAL_ACCOUNT: "가상계좌",
  ESCROW: "에스크로",
};

function wonKR(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function statusMeta(status: string): {
  label: string;
  bg: string;
  text: string;
} {
  switch (status) {
    case "PENDING":
      return { label: "결제 대기", bg: "bg-amber-100", text: "text-amber-800" };
    case "PAID":
      return { label: "결제 완료", bg: "bg-emerald-100", text: "text-emerald-800" };
    case "CONFIRMED":
      return { label: "확정", bg: "bg-emerald-100", text: "text-emerald-800" };
    case "EXPIRED":
      return { label: "만료", bg: "bg-gray-100", text: "text-gray-700" };
    case "CANCELED":
      return { label: "취소", bg: "bg-rose-100", text: "text-rose-700" };
    case "REFUNDED":
      return { label: "환불", bg: "bg-sky-100", text: "text-sky-700" };
    default:
      return { label: status, bg: "bg-gray-100", text: "text-gray-700" };
  }
}

async function loadInvoice(id: string): Promise<InvoiceRow | null> {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<{ data: InvoiceRow | null }>;
            };
          };
        };
      }
    )
      .from("invoices")
      .select(
        "id, invoice_number, category, amount, vat, total_amount, acorns_credited, bonus_rate, bonus_amount, status, expires_at, issued_at, paid_at, confirmed_at, bank_account, payment_methods, description, memo, target_type, target_id, target_name, tax_invoice_issued",
      )
      .eq("id", id)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

export default async function PartnerInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const partner = await getPartner();
  if (!partner) redirect("/partner");

  const { id } = await params;
  const inv = await loadInvoice(id);

  if (!inv) notFound();

  // 권한 확인: 본인 청구서만
  if (inv.target_type !== "PARTNER" || inv.target_id !== partner.id) {
    redirect("/partner/billing/invoices");
  }

  const meta = statusMeta(inv.status);
  const canPay = inv.status === "PENDING";
  const isConfirmed = inv.status === "CONFIRMED" || inv.status === "PAID";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/partner/billing/invoices"
          className="text-sm font-medium text-[#2D5A3D] hover:underline"
        >
          ← 청구서 목록
        </Link>
      </div>

      {/* 티켓 메인 카드 */}
      <section className="overflow-hidden rounded-2xl border-2 border-dashed border-[#C4956A]/60 bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${meta.bg} ${meta.text}`}
              >
                {meta.label}
              </span>
              <span className="text-[11px] font-semibold text-[#8B6F47]">
                {CATEGORY_LABEL[inv.category] ?? inv.category}
              </span>
            </div>
            <h1 className="mt-2 text-lg font-bold text-[#6B4423] md:text-xl">
              {inv.description ?? "청구서"}
            </h1>
            <p className="mt-1 font-mono text-xs text-[#8B6F47]">
              {inv.invoice_number}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase text-[#8B6F47]">
              Total
            </p>
            <p className="mt-0.5 text-3xl font-extrabold text-[#6B4423] md:text-4xl">
              {wonKR(inv.total_amount)}
            </p>
          </div>
        </div>

        <div
          aria-hidden
          className="my-5 border-t-2 border-dashed border-[#C4956A]/40"
        />

        <dl className="grid grid-cols-2 gap-3 text-xs text-[#8B6F47] md:grid-cols-4">
          <div>
            <dt className="font-semibold text-[#6B4423]">공급가액</dt>
            <dd className="mt-0.5">{wonKR(inv.amount)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-[#6B4423]">부가세 (10%)</dt>
            <dd className="mt-0.5">{wonKR(inv.vat)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-[#6B4423]">발행일</dt>
            <dd className="mt-0.5">
              {new Date(inv.issued_at).toLocaleDateString("ko-KR")}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[#6B4423]">만기일</dt>
            <dd className="mt-0.5">
              {new Date(inv.expires_at).toLocaleDateString("ko-KR")}
            </dd>
          </div>
        </dl>

        {inv.category === "ACORN_RECHARGE" &&
          (inv.acorns_credited ?? 0) > 0 && (
            <div className="mt-4 rounded-xl border border-[#C4956A]/30 bg-white/60 p-3">
              <p className="text-[11px] font-semibold text-[#6B4423]">
                <AcornIcon /> 결제 시 지급되는 도토리
              </p>
              <p className="mt-1 text-base font-extrabold text-[#6B4423]">
                {(inv.acorns_credited ?? 0).toLocaleString("ko-KR")}<AcornIcon />
                {(inv.bonus_amount ?? 0) > 0 && (
                  <span className="ml-2 rounded-full bg-[#2D5A3D] px-2 py-0.5 text-[10px] font-bold text-white">
                    보너스 +{Math.round((inv.bonus_rate ?? 0) * 100)}%
                  </span>
                )}
              </p>
            </div>
          )}
      </section>

      {/* 결제 섹션 */}
      {canPay && (
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>💳</span>
            <span>결제하기</span>
          </h2>

          <div className="mb-3">
            <p className="text-xs font-semibold text-[#6B6560]">결제 수단</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {inv.payment_methods.map((m) => (
                <span
                  key={m}
                  className="rounded-full border border-[#D4E4BC] bg-[#FFF8F0] px-2.5 py-0.5 text-[11px] font-semibold text-[#2D5A3D]"
                >
                  {METHOD_LABEL[m] ?? m}
                </span>
              ))}
            </div>
          </div>

          <PayButton
            invoiceId={inv.id}
            invoiceNumber={inv.invoice_number}
            orderName={inv.description ?? inv.invoice_number}
            amount={inv.total_amount}
          />

          {inv.bank_account && (
            <div className="mt-5 rounded-xl border border-[#E5D3B8] bg-[#FFF8F0] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#8B6F47]">
                    🏦 계좌이체로 입금하기
                  </p>
                  <p className="mt-1 truncate text-sm font-bold text-[#6B4423]">
                    {inv.bank_account}
                  </p>
                </div>
                <CopyButton text={inv.bank_account} label="계좌 복사" />
              </div>
              <p className="mt-2 text-[11px] text-[#8B6F47]">
                입금자명은 반드시 <b>{inv.target_name ?? partner.name}</b> 으로
                부탁드려요.
              </p>
            </div>
          )}
        </section>
      )}

      {/* 완료 안내 */}
      {isConfirmed && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-bold text-emerald-900">
            <span>✅</span>
            <span>결제 완료</span>
          </h2>
          <p className="mt-1 text-xs text-emerald-800">
            {inv.confirmed_at
              ? `${new Date(inv.confirmed_at).toLocaleString("ko-KR")}에 확정되었어요.`
              : "결제가 완료되었어요."}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {!inv.tax_invoice_issued && (
              <Link
                href={`/api/partner/invoices/${inv.id}/tax-invoice`}
                className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                🧾 세금계산서 받기
              </Link>
            )}
            <Link
              href="/partner/billing/receipts"
              className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              📄 영수증 목록
            </Link>
          </div>
        </section>
      )}

      {/* 만료/취소 */}
      {(inv.status === "EXPIRED" || inv.status === "CANCELED") && (
        <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-700">
            <span>⛔</span>
            <span>
              이 청구서는 {inv.status === "EXPIRED" ? "만료" : "취소"}되었어요
            </span>
          </h2>
          {inv.memo && (
            <p className="mt-1 text-xs text-gray-600">사유: {inv.memo}</p>
          )}
        </section>
      )}
    </div>
  );
}
