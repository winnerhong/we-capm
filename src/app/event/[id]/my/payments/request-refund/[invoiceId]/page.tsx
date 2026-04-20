import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getParticipant } from "@/lib/participant-session";
import { createClient } from "@/lib/supabase/server";
import { RefundRequestForm } from "./refund-request-form";

export const dynamic = "force-dynamic";

type InvoiceStatus =
  | "DRAFT"
  | "PENDING"
  | "PAID"
  | "CONFIRMED"
  | "EXPIRED"
  | "CANCELED"
  | "REFUNDED";

function formatWon(amount: number | null | undefined): string {
  return `${(amount ?? 0).toLocaleString("ko-KR")}원`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

/**
 * 환불 정책 계산 (UI 표시용, 최종 승인은 관리자 재량).
 * - 결제 후 7일 이내: 100%
 * - 8~14일: 80%
 * - 15~29일: 50%
 * - 30일 이상: 환불 불가 (요청만 가능, 관리자 심사)
 */
function calcRefundPolicy(paidAt: string | null, total: number) {
  if (!paidAt) {
    return {
      label: "기간 정보 없음",
      percent: 100,
      expected: total,
      note: "관리자가 심사 후 확정합니다.",
    };
  }
  const days = Math.floor(
    (Date.now() - new Date(paidAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days <= 7) {
    return {
      label: `결제 후 ${days}일 (7일 이내)`,
      percent: 100,
      expected: total,
      note: "전액 환불 가능한 기간입니다.",
    };
  }
  if (days <= 14) {
    return {
      label: `결제 후 ${days}일 (8~14일)`,
      percent: 80,
      expected: Math.floor(total * 0.8),
      note: "80% 환불됩니다.",
    };
  }
  if (days <= 29) {
    return {
      label: `결제 후 ${days}일 (15~29일)`,
      percent: 50,
      expected: Math.floor(total * 0.5),
      note: "50% 환불됩니다.",
    };
  }
  return {
    label: `결제 후 ${days}일 (30일 이상)`,
    percent: 0,
    expected: 0,
    note: "원칙적으로 환불이 어렵지만, 관리자 심사 후 결정됩니다.",
  };
}

export default async function RefundRequestPage({
  params,
}: {
  params: Promise<{ id: string; invoiceId: string }>;
}) {
  const awaitedParams = await params;
  const invoiceId = awaitedParams.invoiceId;
  const eventId = awaitedParams.id;

  if (!eventId) redirect("/join");

  const session = await getParticipant(eventId);
  if (!session) redirect("/join");

  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, description, total_amount, status, paid_at, target_phone, category"
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) notFound();

  if (invoice.target_phone !== session.phone) {
    redirect(`/event/${eventId}/my/payments`);
  }

  const refundable =
    invoice.status === "PAID" || invoice.status === "CONFIRMED";

  // 이미 진행 중인 환불 존재 체크
  const { data: existing } = await supabase
    .from("refunds")
    .select("id, status")
    .eq("invoice_id", invoiceId)
    .in("status", ["PENDING", "APPROVED"])
    .maybeSingle();

  if (!refundable || existing) {
    redirect(`/event/${eventId}/my/payments/${invoiceId}`);
  }

  const policy = calcRefundPolicy(invoice.paid_at, invoice.total_amount);

  return (
    <main className="min-h-dvh bg-neutral-50 p-4 pb-28">
      <div className="mx-auto max-w-lg space-y-4">
        {/* Header */}
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 p-5 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="text-3xl">↩️</div>
            <div>
              <h1 className="text-xl font-bold">환불 요청</h1>
              <p className="mt-0.5 text-xs opacity-90">
                제출 후 관리자가 영업일 기준 3일 이내에 확인해요
              </p>
            </div>
          </div>
        </div>

        {/* 결제 요약 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-bold text-[#2D5A3D]">
            🧾 환불 대상 결제
          </h2>
          <p className="text-sm font-semibold text-[#2C2C2C]">
            {invoice.description ?? invoice.invoice_number}
          </p>
          <p className="mt-1 text-[11px] text-[#8B7F75]">
            결제일 {formatDateTime(invoice.paid_at)} · {invoice.invoice_number}
          </p>
          <p className="mt-2 text-lg font-bold text-[#2D5A3D]">
            결제액 {formatWon(invoice.total_amount)}
          </p>
        </section>

        {/* 환불 정책 안내 */}
        <section
          aria-labelledby="policy-heading"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-5"
        >
          <h2
            id="policy-heading"
            className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-900"
          >
            <span>📜</span>
            <span>환불 정책</span>
          </h2>
          <ul className="space-y-1 text-xs text-amber-900">
            <li>• 결제 후 7일 이내: 100% 환불</li>
            <li>• 결제 후 8~14일: 80% 환불</li>
            <li>• 결제 후 15~29일: 50% 환불</li>
            <li>• 결제 후 30일 이상: 관리자 심사 후 결정</li>
          </ul>
          <div className="mt-3 rounded-xl border border-amber-300 bg-white/70 p-3">
            <p className="text-xs font-semibold text-amber-900">
              현재 적용 정책
            </p>
            <p className="mt-1 text-xs text-amber-800">{policy.label}</p>
            <p className="mt-2 text-sm font-bold text-amber-900">
              예상 환불액: {formatWon(policy.expected)}{" "}
              <span className="text-xs font-normal">({policy.percent}%)</span>
            </p>
            <p className="mt-1 text-[11px] text-amber-700">{policy.note}</p>
          </div>
        </section>

        {/* Form */}
        <RefundRequestForm
          eventId={eventId}
          invoiceId={invoiceId}
          defaultAmount={policy.expected}
          maxAmount={invoice.total_amount}
        />

        <div className="pt-2">
          <Link
            href={`/event/${eventId}/my/payments/${invoiceId}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#2D5A3D] hover:underline"
          >
            ← 결제 상세로
          </Link>
        </div>
      </div>
    </main>
  );
}
