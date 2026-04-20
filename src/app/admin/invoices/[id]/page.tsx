import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoiceActions } from "./invoice-actions";

export const dynamic = "force-dynamic";

type InvoiceStatus =
  | "DRAFT"
  | "PENDING"
  | "PAID"
  | "CONFIRMED"
  | "EXPIRED"
  | "CANCELED"
  | "REFUNDED";

type TargetType =
  | "PARTNER"
  | "MANAGER"
  | "PARTICIPANT"
  | "ADVERTISER"
  | "AFFILIATE"
  | "ORG"
  | "B2B_CLIENT";

type Category =
  | "ACORN_RECHARGE"
  | "SUBSCRIPTION"
  | "EVENT_FEE"
  | "AD_CAMPAIGN"
  | "COUPON_FEE"
  | "B2B_CONTRACT"
  | "SETTLEMENT"
  | "REFUND"
  | "OTHER";

type InvoiceDetail = {
  id: string;
  invoice_number: string;
  issued_by_type: string;
  issued_by_id: string;
  target_type: TargetType;
  target_id: string;
  target_name: string | null;
  target_email: string | null;
  target_phone: string | null;
  category: Category;
  amount: number;
  bonus_rate: number | null;
  bonus_amount: number | null;
  vat: number;
  total_amount: number;
  acorns_credited: number | null;
  payment_methods: string[];
  description: string | null;
  memo: string | null;
  status: InvoiceStatus;
  issued_at: string;
  expires_at: string;
  paid_at: string | null;
  confirmed_at: string | null;
  canceled_at: string | null;
  tax_invoice_issued: boolean;
  email_sent_at: string | null;
  reminder_count: number;
};

const STATUS_LABEL: Record<
  InvoiceStatus,
  { label: string; dot: string; text: string; bg: string }
> = {
  DRAFT: { label: "초안", dot: "bg-gray-400", text: "text-gray-700", bg: "bg-gray-100" },
  PENDING: { label: "대기", dot: "bg-amber-500", text: "text-amber-800", bg: "bg-amber-100" },
  PAID: { label: "입금됨", dot: "bg-blue-500", text: "text-blue-800", bg: "bg-blue-100" },
  CONFIRMED: {
    label: "확인완료",
    dot: "bg-green-500",
    text: "text-green-800",
    bg: "bg-green-100",
  },
  EXPIRED: { label: "만료", dot: "bg-gray-400", text: "text-gray-600", bg: "bg-gray-100" },
  CANCELED: { label: "취소", dot: "bg-red-400", text: "text-red-700", bg: "bg-red-50" },
  REFUNDED: { label: "환불", dot: "bg-purple-500", text: "text-purple-800", bg: "bg-purple-100" },
};

const CATEGORY_LABEL: Record<Category, { label: string; emoji: string }> = {
  ACORN_RECHARGE: { label: "도토리 충전", emoji: "🌰" },
  SUBSCRIPTION: { label: "구독료", emoji: "🔁" },
  EVENT_FEE: { label: "행사 참가비", emoji: "🎫" },
  AD_CAMPAIGN: { label: "광고비", emoji: "📣" },
  COUPON_FEE: { label: "쿠폰 수수료", emoji: "🎟️" },
  B2B_CONTRACT: { label: "B2B 계약", emoji: "💼" },
  SETTLEMENT: { label: "정산", emoji: "💸" },
  REFUND: { label: "환불", emoji: "↩️" },
  OTHER: { label: "기타", emoji: "📄" },
};

const METHOD_LABEL: Record<string, string> = {
  CARD: "카드",
  KAKAOPAY: "카카오페이",
  NAVERPAY: "네이버페이",
  TOSSPAY: "토스페이",
  BANK_TRANSFER: "계좌이체",
  VIRTUAL_ACCOUNT: "가상계좌",
  ESCROW: "에스크로",
};

function fmtKRW(n: number): string {
  return n.toLocaleString("ko-KR");
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  let invoice: InvoiceDetail | null = null;
  try {
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<{
                data: InvoiceDetail | null;
                error: unknown;
              }>;
            };
          };
        };
      }
    )
      .from("invoices")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    invoice = data;
  } catch {
    invoice = null;
  }

  if (!invoice) {
    notFound();
  }

  const s = STATUS_LABEL[invoice.status];
  const c = CATEGORY_LABEL[invoice.category];

  const canConfirm = invoice.status === "PENDING" || invoice.status === "PAID";
  const canCancel = invoice.status === "PENDING" || invoice.status === "DRAFT";
  const canRemind = invoice.status === "PENDING";
  const canIssueTax =
    (invoice.status === "CONFIRMED" || invoice.status === "PAID") &&
    !invoice.tax_invoice_issued;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/invoices"
          className="text-sm font-medium text-[#2D5A3D] hover:underline"
        >
          ← 청구서 목록
        </Link>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${s.bg} ${s.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
          {s.label}
        </span>
      </div>

      {/* 요약 헤더 */}
      <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-white/70">청구번호</p>
            <p className="font-mono text-lg font-bold">{invoice.invoice_number}</p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-extrabold">
              <span>{c.emoji}</span>
              <span>{c.label}</span>
            </h1>
            <p className="mt-1 text-sm text-white/80">
              발송 {fmtDateTime(invoice.issued_at)} · 만료 {fmtDateTime(invoice.expires_at)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/70">총 청구액</p>
            <p className="text-3xl font-extrabold">{fmtKRW(invoice.total_amount)}</p>
            <p className="text-xs text-white/70">원</p>
          </div>
        </div>
      </div>

      {/* 액션 카드 */}
      <InvoiceActions
        invoiceId={invoice.id}
        canConfirm={canConfirm}
        canCancel={canCancel}
        canRemind={canRemind}
        canIssueTax={canIssueTax}
        reminderCount={invoice.reminder_count}
        taxInvoiceIssued={invoice.tax_invoice_issued}
      />

      {/* 대상 정보 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-[#2D5A3D]">🎯 대상</h2>
        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs text-[#8B6F47]">유형</dt>
            <dd className="font-semibold text-[#2C2C2C]">{invoice.target_type}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#8B6F47]">ID</dt>
            <dd className="font-mono text-xs text-[#6B6560]">{invoice.target_id}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#8B6F47]">이름</dt>
            <dd className="font-semibold text-[#2C2C2C]">
              {invoice.target_name ?? "-"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#8B6F47]">이메일</dt>
            <dd className="text-[#2C2C2C]">{invoice.target_email ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#8B6F47]">전화</dt>
            <dd className="text-[#2C2C2C]">{invoice.target_phone ?? "-"}</dd>
          </div>
        </dl>
      </section>

      {/* 금액 상세 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-[#2D5A3D]">💰 금액 상세</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-[#6B6560]">공급가액</dt>
            <dd className="font-semibold text-[#2C2C2C]">
              {fmtKRW(invoice.amount)}원
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#6B6560]">부가세</dt>
            <dd className="font-semibold text-[#2C2C2C]">{fmtKRW(invoice.vat)}원</dd>
          </div>
          {invoice.bonus_rate && invoice.bonus_rate > 0 && (
            <div className="flex justify-between text-[#C4956A]">
              <dt>보너스 비율</dt>
              <dd className="font-semibold">+{invoice.bonus_rate}%</dd>
            </div>
          )}
          {invoice.acorns_credited && (
            <div className="flex justify-between text-[#2D5A3D]">
              <dt>지급 도토리</dt>
              <dd className="font-semibold">
                🌰 {fmtKRW(invoice.acorns_credited)}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t border-[#D4E4BC] pt-2 text-base">
            <dt className="font-bold text-[#2D5A3D]">총 청구액</dt>
            <dd className="font-extrabold text-[#2D5A3D]">
              {fmtKRW(invoice.total_amount)}원
            </dd>
          </div>
        </dl>
      </section>

      {/* 결제 수단 & 타임라인 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-[#2D5A3D]">💳 결제 수단</h2>
          <div className="flex flex-wrap gap-2">
            {invoice.payment_methods.map((m) => (
              <span
                key={m}
                className="rounded-full bg-[#E8F0E4] px-3 py-1 text-xs font-semibold text-[#2D5A3D]"
              >
                {METHOD_LABEL[m] ?? m}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-[#2D5A3D]">📅 타임라인</h2>
          <ol className="space-y-2 text-xs">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-2 w-2 rounded-full bg-[#2D5A3D]" />
              <div>
                <div className="font-semibold text-[#2C2C2C]">청구서 발송</div>
                <div className="text-[#8B6F47]">{fmtDateTime(invoice.issued_at)}</div>
              </div>
            </li>
            {invoice.email_sent_at && invoice.reminder_count > 0 && (
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-amber-500" />
                <div>
                  <div className="font-semibold text-[#2C2C2C]">
                    독촉 발송 ({invoice.reminder_count}회)
                  </div>
                  <div className="text-[#8B6F47]">
                    최근 {fmtDateTime(invoice.email_sent_at)}
                  </div>
                </div>
              </li>
            )}
            {invoice.paid_at && (
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-blue-500" />
                <div>
                  <div className="font-semibold text-[#2C2C2C]">입금 확인</div>
                  <div className="text-[#8B6F47]">{fmtDateTime(invoice.paid_at)}</div>
                </div>
              </li>
            )}
            {invoice.confirmed_at && (
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-green-500" />
                <div>
                  <div className="font-semibold text-[#2C2C2C]">관리자 확인</div>
                  <div className="text-[#8B6F47]">
                    {fmtDateTime(invoice.confirmed_at)}
                  </div>
                </div>
              </li>
            )}
            {invoice.canceled_at && (
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-red-500" />
                <div>
                  <div className="font-semibold text-[#2C2C2C]">취소</div>
                  <div className="text-[#8B6F47]">{fmtDateTime(invoice.canceled_at)}</div>
                </div>
              </li>
            )}
          </ol>
        </section>
      </div>

      {/* 설명/메모 */}
      {(invoice.description || invoice.memo) && (
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          {invoice.description && (
            <>
              <h3 className="mb-1 text-sm font-bold text-[#2D5A3D]">📝 설명</h3>
              <p className="text-sm text-[#2C2C2C]">{invoice.description}</p>
            </>
          )}
          {invoice.memo && (
            <>
              <h3 className="mb-1 mt-3 text-sm font-bold text-[#2D5A3D]">
                🗒️ 내부 메모
              </h3>
              <p className="text-sm text-[#6B6560]">{invoice.memo}</p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
