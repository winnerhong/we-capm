import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getParticipant } from "@/lib/participant-session";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type InvoiceCategory =
  | "ACORN_RECHARGE"
  | "SUBSCRIPTION"
  | "EVENT_FEE"
  | "AD_CAMPAIGN"
  | "COUPON_FEE"
  | "B2B_CONTRACT"
  | "SETTLEMENT"
  | "REFUND"
  | "OTHER";

type InvoiceStatus =
  | "DRAFT"
  | "PENDING"
  | "PAID"
  | "CONFIRMED"
  | "EXPIRED"
  | "CANCELED"
  | "REFUNDED";

const CATEGORY_LABEL: Record<InvoiceCategory, { emoji: string; label: string }> = {
  ACORN_RECHARGE: { emoji: "🌰", label: "도토리 충전" },
  SUBSCRIPTION: { emoji: "🌿", label: "구독" },
  EVENT_FEE: { emoji: "🎫", label: "행사" },
  AD_CAMPAIGN: { emoji: "📣", label: "광고" },
  COUPON_FEE: { emoji: "🎟️", label: "쿠폰" },
  B2B_CONTRACT: { emoji: "🤝", label: "B2B 계약" },
  SETTLEMENT: { emoji: "💼", label: "정산" },
  REFUND: { emoji: "↩️", label: "환불" },
  OTHER: { emoji: "🎁", label: "기타" },
};

const STATUS_META: Record<InvoiceStatus, { label: string; chip: string }> = {
  DRAFT: { label: "초안", chip: "bg-neutral-100 text-neutral-600" },
  PENDING: { label: "결제 대기", chip: "bg-amber-100 text-amber-800" },
  PAID: { label: "결제 완료", chip: "bg-emerald-100 text-emerald-800" },
  CONFIRMED: { label: "확정", chip: "bg-emerald-100 text-emerald-800" },
  EXPIRED: { label: "만료", chip: "bg-neutral-200 text-neutral-600" },
  CANCELED: { label: "취소", chip: "bg-rose-100 text-rose-700" },
  REFUNDED: { label: "환불 완료", chip: "bg-sky-100 text-sky-800" },
};

const REFUND_STATUS_LABEL: Record<string, string> = {
  PENDING: "검토 중",
  APPROVED: "승인",
  REJECTED: "반려",
  COMPLETED: "환불 완료",
  CANCELED: "취소",
};

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
 * Route: /event/[id]/my/payments/[id]
 *
 * 주의: 상위·하위 동일 동적 세그먼트 이름 [id] 사용.
 * Next.js 16에서는 하위 세그먼트 값이 params.id로 덮어써짐(= invoiceId).
 * eventId는 요청 경로에서 추출.
 */
export default async function PaymentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; invoiceId: string }>;
  searchParams: Promise<{ refund?: string }>;
}) {
  const awaitedParams = await params;
  const invoiceId = awaitedParams.invoiceId;
  const eventId = awaitedParams.id;
  const { refund } = await searchParams;

  if (!eventId) {
    // 경로 추출 실패 시 목록으로 되돌릴 수 없음 → /join
    redirect("/join");
  }

  const session = await getParticipant(eventId);
  if (!session) redirect("/join");

  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, category, description, memo, amount, vat, total_amount, status, issued_at, paid_at, expires_at, confirmed_at, canceled_at, target_type, target_phone, target_name, target_email, payment_methods, bank_account, tax_invoice_issued"
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) notFound();

  if (invoice.target_phone !== session.phone) {
    redirect(`/event/${eventId}/my/payments`);
  }

  const { data: txns } = await supabase
    .from("payment_transactions")
    .select(
      "id, method, amount, status, completed_at, pg_provider, pg_transaction_id"
    )
    .eq("invoice_id", invoiceId)
    .order("attempted_at", { ascending: false });

  const { data: taxInvoices } = await supabase
    .from("tax_invoices")
    .select("id, type, tax_invoice_number, pdf_url, issue_date, total_amount")
    .eq("invoice_id", invoiceId)
    .order("issue_date", { ascending: false });

  const { data: refunds } = await supabase
    .from("refunds")
    .select(
      "id, reason, reason_category, requested_amount, approved_amount, status, created_at, reviewed_at, admin_note"
    )
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false });

  const cat = CATEGORY_LABEL[invoice.category as InvoiceCategory];
  const st = STATUS_META[invoice.status as InvoiceStatus];

  const canRefund =
    (invoice.status === "PAID" || invoice.status === "CONFIRMED") &&
    !(refunds ?? []).some(
      (r) => r.status === "PENDING" || r.status === "APPROVED"
    );

  return (
    <main className="min-h-dvh bg-neutral-50 p-4 pb-28">
      <div className="mx-auto max-w-lg space-y-4">
        {/* Header */}
        <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 text-[11px] opacity-90">
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
            <span>·</span>
            <span>{invoice.invoice_number}</span>
          </div>
          <h1 className="mt-1 text-xl font-bold">
            {invoice.description ?? "결제 상세"}
          </h1>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold">
              {formatWon(invoice.total_amount)}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.chip}`}
            >
              {st.label}
            </span>
          </div>
        </div>

        {refund === "requested" && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            ✅ 환불 요청이 접수되었어요. 관리자가 확인 후 연락드릴게요.
          </div>
        )}

        {/* 인보이스 정보 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>🧾</span>
            <span>결제 정보</span>
          </h2>
          <dl className="space-y-2.5 text-sm">
            <InfoRow label="인보이스 번호" value={invoice.invoice_number} />
            <InfoRow label="구분" value={`${cat.emoji} ${cat.label}`} />
            <InfoRow label="공급가액" value={formatWon(invoice.amount)} />
            <InfoRow label="부가세" value={formatWon(invoice.vat)} />
            <InfoRow
              label="합계"
              value={formatWon(invoice.total_amount)}
              strong
            />
            <InfoRow label="발행일" value={formatDateTime(invoice.issued_at)} />
            <InfoRow label="결제일" value={formatDateTime(invoice.paid_at)} />
            <InfoRow
              label="수령인"
              value={`${invoice.target_name ?? "-"} (${invoice.target_phone ?? "-"})`}
            />
            {invoice.memo && <InfoRow label="메모" value={invoice.memo} />}
          </dl>
        </section>

        {/* 결제 수단 */}
        {txns && txns.length > 0 && (
          <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
              <span>💳</span>
              <span>결제 수단</span>
            </h2>
            <ul className="space-y-2">
              {txns.map((t) => (
                <li
                  key={t.id}
                  className="rounded-xl border border-[#E8E0D3] bg-[#FFF8F0] p-3"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-[#2D5A3D]">
                      {t.method}
                    </span>
                    <span className="font-bold">{formatWon(t.amount)}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-[#8B7F75]">
                    {t.pg_provider ?? "PG"} · {t.status} ·{" "}
                    {formatDateTime(t.completed_at)}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 현금영수증 / 세금계산서 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>📑</span>
            <span>현금영수증 · 세금계산서</span>
          </h2>
          {taxInvoices && taxInvoices.length > 0 ? (
            <ul className="space-y-2">
              {taxInvoices.map((ti) => (
                <li
                  key={ti.id}
                  className="flex items-center justify-between rounded-xl border border-[#E8E0D3] bg-[#FFF8F0] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#2D5A3D]">
                      {ti.type === "CASH_RECEIPT"
                        ? "💵 현금영수증"
                        : ti.type === "TAX"
                          ? "🧾 세금계산서"
                          : "🧾 간이영수증"}
                    </p>
                    <p className="truncate text-[11px] text-[#8B7F75]">
                      {ti.tax_invoice_number ?? "번호 대기"} ·{" "}
                      {formatDateTime(ti.issue_date)}
                    </p>
                  </div>
                  {ti.pdf_url ? (
                    <a
                      href={ti.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-[#2D5A3D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1F3F2A] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/40"
                    >
                      PDF 다운로드
                    </a>
                  ) : (
                    <span className="text-[11px] text-[#8B7F75]">
                      발급 준비중
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[#8B7F75]">
              발급된 영수증이 없어요. 필요하시면 관리자에게 요청해주세요.
            </p>
          )}
          <Link
            href={`/invoice/${invoice.id}`}
            className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-xl bg-[#2D5A3D] px-4 py-3 text-sm font-bold text-white hover:bg-[#1F3F2A] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/40"
          >
            🧾 공식 영수증 열기
          </Link>
        </section>

        {/* 환불 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>↩️</span>
            <span>환불</span>
          </h2>
          {refunds && refunds.length > 0 ? (
            <ul className="space-y-2">
              {refunds.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-amber-200 bg-amber-50 p-3"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-amber-900">
                      {REFUND_STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    <span className="font-bold text-amber-900">
                      {formatWon(r.approved_amount ?? r.requested_amount)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-amber-800">
                    요청일: {formatDateTime(r.created_at)}
                  </p>
                  <p className="mt-1 text-xs text-amber-900">사유: {r.reason}</p>
                  {r.admin_note && (
                    <p className="mt-1 text-[11px] text-amber-700">
                      관리자 메모: {r.admin_note}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[#8B7F75]">환불 요청 이력이 없어요.</p>
          )}

          {canRefund && (
            <Link
              href={`/event/${eventId}/my/payments/request-refund/${invoice.id}`}
              className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              ↩️ 환불 요청하기
            </Link>
          )}
        </section>

        <div className="pt-2">
          <Link
            href={`/event/${eventId}/my/payments`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#2D5A3D] hover:underline"
          >
            ← 결제 이력으로
          </Link>
        </div>
      </div>
    </main>
  );
}

function InfoRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#F0EBE3] pb-2 last:border-none last:pb-0">
      <dt className="text-xs font-semibold text-[#6B6560]">{label}</dt>
      <dd
        className={[
          "text-right text-sm",
          strong ? "font-bold text-[#2D5A3D]" : "font-medium text-[#2C2C2C]",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}
