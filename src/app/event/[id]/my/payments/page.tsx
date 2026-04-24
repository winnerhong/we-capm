import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getParticipant } from "@/lib/participant-session";
import { createClient } from "@/lib/supabase/server";
import { AcornIcon } from "@/components/acorn-icon";

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

type InvoiceRow = {
  id: string;
  invoice_number: string;
  category: InvoiceCategory;
  description: string | null;
  total_amount: number;
  status: InvoiceStatus;
  issued_at: string;
  paid_at: string | null;
};

type TabKey = "ALL" | "SUBSCRIPTION" | "EVENT" | "OTHER";

const TABS: { key: TabKey; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "SUBSCRIPTION", label: "구독" },
  { key: "EVENT", label: "행사" },
  { key: "OTHER", label: "기타" },
];

const CATEGORY_META: Record<
  InvoiceCategory,
  { emoji: ReactNode; label: string; chip: string }
> = {
  SUBSCRIPTION: {
    emoji: "🌿",
    label: "구독",
    chip: "bg-[#D4E4BC] text-[#2D5A3D]",
  },
  EVENT_FEE: {
    emoji: "🎫",
    label: "행사",
    chip: "bg-[#E6D3B8] text-[#8B6F47]",
  },
  ACORN_RECHARGE: {
    emoji: <AcornIcon />,
    label: "도토리 충전",
    chip: "bg-[#F5E4CB] text-[#8B6F47]",
  },
  AD_CAMPAIGN: {
    emoji: "📣",
    label: "광고",
    chip: "bg-sky-100 text-sky-800",
  },
  COUPON_FEE: {
    emoji: "🎟️",
    label: "쿠폰",
    chip: "bg-pink-100 text-pink-700",
  },
  B2B_CONTRACT: {
    emoji: "🤝",
    label: "B2B",
    chip: "bg-indigo-100 text-indigo-700",
  },
  SETTLEMENT: {
    emoji: "💼",
    label: "정산",
    chip: "bg-slate-100 text-slate-700",
  },
  REFUND: {
    emoji: "↩️",
    label: "환불",
    chip: "bg-amber-100 text-amber-700",
  },
  OTHER: {
    emoji: "🎁",
    label: "기타",
    chip: "bg-neutral-100 text-neutral-700",
  },
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

function categoryToTab(c: InvoiceCategory): TabKey {
  if (c === "SUBSCRIPTION") return "SUBSCRIPTION";
  if (c === "EVENT_FEE") return "EVENT";
  return "OTHER";
}

function formatWon(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function MyPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id: eventId } = await params;
  const { tab } = await searchParams;

  const session = await getParticipant(eventId);
  if (!session) redirect("/join");

  const activeTab: TabKey =
    tab === "SUBSCRIPTION" || tab === "EVENT" || tab === "OTHER" ? tab : "ALL";

  const supabase = await createClient();

  // 참가자 기준 인보이스 조회 (전화번호 매칭)
  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, category, description, total_amount, status, issued_at, paid_at"
    )
    .eq("target_type", "PARTICIPANT")
    .eq("target_phone", session.phone)
    .order("issued_at", { ascending: false });

  if (activeTab === "SUBSCRIPTION") {
    query = query.eq("category", "SUBSCRIPTION");
  } else if (activeTab === "EVENT") {
    query = query.eq("category", "EVENT_FEE");
  } else if (activeTab === "OTHER") {
    query = query.not(
      "category",
      "in",
      "(SUBSCRIPTION,EVENT_FEE)"
    );
  }

  const { data: rawInvoices } = await query;
  const invoices: InvoiceRow[] = (rawInvoices ?? []) as InvoiceRow[];

  // 환불 가능 여부 판단용 (PENDING 환불 존재 여부)
  const invoiceIds = invoices.map((i) => i.id);
  let pendingRefundIds = new Set<string>();
  if (invoiceIds.length > 0) {
    const { data: refundRows } = await supabase
      .from("refunds")
      .select("invoice_id, status")
      .in("invoice_id", invoiceIds)
      .in("status", ["PENDING", "APPROVED"]);
    pendingRefundIds = new Set(
      (refundRows ?? []).map((r: { invoice_id: string | null }) => r.invoice_id ?? "")
    );
  }

  const totalSpent = invoices
    .filter((i) => i.status === "PAID" || i.status === "CONFIRMED")
    .reduce((sum, i) => sum + (i.total_amount ?? 0), 0);

  return (
    <main className="min-h-dvh bg-neutral-50 p-4 pb-28">
      <div className="mx-auto max-w-lg space-y-4">
        {/* Header */}
        <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="text-3xl">💳</div>
            <div>
              <h1 className="text-xl font-bold">결제 이력</h1>
              <p className="mt-0.5 text-xs opacity-90">
                구독·행사·기타 결제를 한 곳에서 확인해요
              </p>
            </div>
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold">
            <AcornIcon />
            <span>누적 결제액 {formatWon(totalSpent)}</span>
          </div>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="결제 분류"
          className="flex gap-2 overflow-x-auto rounded-2xl border border-[#D4E4BC] bg-white p-2 shadow-sm"
        >
          {TABS.map((t) => {
            const active = t.key === activeTab;
            return (
              <Link
                key={t.key}
                role="tab"
                aria-selected={active}
                href={
                  t.key === "ALL"
                    ? `/event/${eventId}/my/payments`
                    : `/event/${eventId}/my/payments?tab=${t.key}`
                }
                className={[
                  "flex-1 min-w-[64px] rounded-xl px-3 py-2 text-center text-sm font-semibold transition",
                  active
                    ? "bg-[#2D5A3D] text-white shadow"
                    : "bg-[#FFF8F0] text-[#2D5A3D] hover:bg-[#E8F0E4]",
                ].join(" ")}
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        {/* List */}
        <section aria-labelledby="payments-heading" className="space-y-3">
          <h2 id="payments-heading" className="sr-only">
            결제 목록
          </h2>

          {invoices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center shadow-sm">
              <div className="text-4xl">🌱</div>
              <p className="mt-2 text-sm font-semibold text-[#2D5A3D]">
                아직 결제 이력이 없어요
              </p>
              <p className="mt-1 text-xs text-[#6B6560]">
                구독이나 행사 결제를 하시면 여기에 표시됩니다.
              </p>
            </div>
          ) : (
            invoices.map((inv) => {
              const cat = CATEGORY_META[inv.category];
              const st = STATUS_META[inv.status];
              const canRefund =
                (inv.status === "PAID" || inv.status === "CONFIRMED") &&
                !pendingRefundIds.has(inv.id);

              return (
                <article
                  key={inv.id}
                  className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm"
                >
                  <header className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cat.chip}`}
                        >
                          <span>{cat.emoji}</span>
                          <span>{cat.label}</span>
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.chip}`}
                        >
                          {st.label}
                        </span>
                      </div>
                      <h3 className="mt-1.5 truncate text-sm font-bold text-[#2C2C2C]">
                        {inv.description ?? inv.invoice_number}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-[#8B7F75]">
                        {formatDate(inv.paid_at ?? inv.issued_at)} ·{" "}
                        {inv.invoice_number}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-bold text-[#2D5A3D]">
                        {formatWon(inv.total_amount)}
                      </p>
                    </div>
                  </header>

                  <footer className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/event/${eventId}/my/payments/${inv.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/40"
                      aria-label={`${inv.invoice_number} 상세 보기`}
                    >
                      📄 상세
                    </Link>
                    <Link
                      href={`/invoice/${inv.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#F5EDE0] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/40"
                    >
                      🧾 영수증
                    </Link>
                    {canRefund && (
                      <Link
                        href={`/event/${eventId}/my/payments/request-refund/${inv.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      >
                        ↩️ 환불 요청
                      </Link>
                    )}
                    {pendingRefundIds.has(inv.id) && (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800">
                        ⏳ 환불 검토 중
                      </span>
                    )}
                  </footer>

                  <p className="mt-1 text-[11px] text-[#8B7F75]">
                    카테고리: {cat.label}
                  </p>
                </article>
              );
            })
          )}
        </section>

        {/* Back link */}
        <div className="pt-2">
          <Link
            href={`/event/${eventId}/my`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#2D5A3D] hover:underline"
          >
            ← 나의 숲 기록으로
          </Link>
        </div>
      </div>
    </main>
  );
}
