import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type InvoiceStatus =
  | "DRAFT"
  | "PENDING"
  | "PAID"
  | "CONFIRMED"
  | "EXPIRED"
  | "CANCELED"
  | "REFUNDED";

type PaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELED"
  | "REFUNDED";

type InvoiceLite = {
  id: string;
  invoice_number: string;
  target_name: string | null;
  target_type: string;
  category: string;
  total_amount: number;
  status: InvoiceStatus;
  issued_at: string;
  paid_at: string | null;
  confirmed_at: string | null;
};

type PaymentLite = {
  id: string;
  invoice_id: string;
  method: string;
  amount: number;
  status: PaymentStatus;
  attempted_at: string;
  completed_at: string | null;
};

type RefundLite = {
  id: string;
  invoice_id: string | null;
  requested_amount: number;
  approved_amount: number | null;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED" | "CANCELED";
  created_at: string;
};

type SettlementLite = {
  id: string;
  partner_id: string | null;
  period_start: string;
  period_end: string;
  net_amount: number;
  status: "DRAFT" | "REVIEW" | "APPROVED" | "PAID" | "DISPUTED";
};

function fmtKRW(n: number): string {
  return n.toLocaleString("ko-KR");
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "-";
  }
}

const PAYMENT_STATUS_LABEL: Record<
  PaymentStatus,
  { label: string; cls: string }
> = {
  PENDING: { label: "대기", cls: "bg-gray-100 text-gray-700" },
  PROCESSING: { label: "처리중", cls: "bg-blue-100 text-blue-700" },
  SUCCESS: { label: "성공", cls: "bg-green-100 text-green-700" },
  FAILED: { label: "실패", cls: "bg-red-100 text-red-700" },
  CANCELED: { label: "취소", cls: "bg-gray-100 text-gray-700" },
  REFUNDED: { label: "환불", cls: "bg-purple-100 text-purple-700" },
};

async function fetchInvoices(): Promise<
  { rows: InvoiceLite[]; tableMissing: boolean }
> {
  const supabase = await createClient();
  try {
    const { data, error } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              limit: (n: number) => Promise<{
                data: InvoiceLite[] | null;
                error: { message: string; code?: string } | null;
              }>;
            };
          };
        };
      }
    )
      .from("invoices")
      .select(
        "id, invoice_number, target_name, target_type, category, total_amount, status, issued_at, paid_at, confirmed_at",
      )
      .order("issued_at", { ascending: false })
      .limit(100);

    if (error) {
      if (error.code === "42P01" || /relation .* does not exist/i.test(error.message)) {
        return { rows: [], tableMissing: true };
      }
    }
    return { rows: data ?? [], tableMissing: false };
  } catch {
    return { rows: [], tableMissing: true };
  }
}

async function fetchPayments(): Promise<PaymentLite[]> {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              limit: (n: number) => Promise<{
                data: PaymentLite[] | null;
                error: unknown;
              }>;
            };
          };
        };
      }
    )
      .from("payment_transactions")
      .select("id, invoice_id, method, amount, status, attempted_at, completed_at")
      .order("attempted_at", { ascending: false })
      .limit(20);
    return data ?? [];
  } catch {
    return [];
  }
}

async function fetchRefunds(): Promise<RefundLite[]> {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => Promise<{ data: RefundLite[] | null; error: unknown }>;
            };
          };
        };
      }
    )
      .from("refunds")
      .select(
        "id, invoice_id, requested_amount, approved_amount, reason, status, created_at",
      )
      .eq("status", "PENDING")
      .order("created_at", { ascending: false });
    return data ?? [];
  } catch {
    return [];
  }
}

async function fetchSettlementsThisMonth(): Promise<SettlementLite[]> {
  const supabase = await createClient();
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            gte: (k: string, v: string) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => Promise<{ data: SettlementLite[] | null; error: unknown }>;
            };
          };
        };
      }
    )
      .from("settlements")
      .select("id, partner_id, period_start, period_end, net_amount, status")
      .gte("period_start", monthStart)
      .order("period_start", { ascending: false });
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function AdminFinancePage() {
  const [{ rows: invoices, tableMissing }, payments, refunds, settlements] =
    await Promise.all([
      fetchInvoices(),
      fetchPayments(),
      fetchRefunds(),
      fetchSettlementsThisMonth(),
    ]);

  // ---- Stats ----
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const todaySales = invoices
    .filter(
      (i) =>
        (i.status === "CONFIRMED" || i.status === "PAID") &&
        i.paid_at &&
        new Date(i.paid_at) >= todayStart,
    )
    .reduce((acc, i) => acc + i.total_amount, 0);

  const pendingSum = invoices
    .filter((i) => i.status === "PENDING")
    .reduce((acc, i) => acc + i.total_amount, 0);

  const refundPending = refunds.length;

  const monthSettlementSum = settlements
    .filter((s) => s.status !== "DRAFT")
    .reduce((acc, s) => acc + s.net_amount, 0);

  const recentPayments = payments.slice(0, 10);

  // ---- Build a quick invoice map for join on UI ----
  const invoiceMap = new Map<string, InvoiceLite>();
  invoices.forEach((i) => invoiceMap.set(i.id, i));

  const thisMonthInvoices = invoices.filter(
    (i) => new Date(i.issued_at) >= thisMonthStart,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin" className="text-sm font-medium text-[#2D5A3D] hover:underline">
          ← 대시보드
        </Link>
        {tableMissing && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
            invoices 테이블 미존재
          </span>
        )}
      </div>

      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[#2D5A3D]">
            <span>💰</span>
            <span>재무 대시보드</span>
          </h1>
          <p className="mt-1 text-sm text-[#6B6560]">
            매출·청구·정산·환불을 한눈에 살펴봅니다
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/invoices/new"
            className="whitespace-nowrap rounded-xl bg-[#2D5A3D] px-3 py-2 text-xs font-semibold text-white hover:bg-[#3A7A52]"
          >
            + 청구서 생성
          </Link>
          <Link
            href="/admin/settlements"
            className="whitespace-nowrap rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            💸 일괄 정산
          </Link>
          <Link
            href="/admin/invoices?status=CONFIRMED"
            className="whitespace-nowrap rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#6B4423] hover:bg-[#FFF8F0]"
          >
            🧾 세금계산서
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] to-white p-5">
          <div className="text-xs font-medium text-[#8B6F47]">오늘 매출</div>
          <div className="mt-1 text-2xl font-extrabold text-[#2D5A3D]">
            {fmtKRW(todaySales)}
            <span className="ml-1 text-sm font-medium">원</span>
          </div>
          <div className="mt-1 text-[11px] text-[#8B6F47]">
            {thisMonthInvoices.length}건 이번달
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
          <div className="text-xs font-medium text-amber-800">대기 결제</div>
          <div className="mt-1 text-2xl font-extrabold text-amber-800">
            {fmtKRW(pendingSum)}
            <span className="ml-1 text-sm font-medium">원</span>
          </div>
          <div className="mt-1 text-[11px] text-amber-700">
            {invoices.filter((i) => i.status === "PENDING").length}건 대기
          </div>
        </div>
        <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-white p-5">
          <div className="text-xs font-medium text-red-700">환불 요청</div>
          <div className="mt-1 text-2xl font-extrabold text-red-700">
            {fmtKRW(refundPending)}
            <span className="ml-1 text-sm font-medium">건</span>
          </div>
          <div className="mt-1 text-[11px] text-red-600">
            {fmtKRW(
              refunds.reduce((acc, r) => acc + (r.requested_amount ?? 0), 0),
            )}
            원 상당
          </div>
        </div>
        <div className="rounded-2xl border border-[#E5D3B8] bg-gradient-to-br from-[#FFF8F0] to-white p-5">
          <div className="text-xs font-medium text-[#6B4423]">이번달 정산</div>
          <div className="mt-1 text-2xl font-extrabold text-[#6B4423]">
            {fmtKRW(monthSettlementSum)}
            <span className="ml-1 text-sm font-medium">원</span>
          </div>
          <div className="mt-1 text-[11px] text-[#8B6F47]">
            {settlements.length}개 정산서
          </div>
        </div>
      </div>

      {/* 최근 결제 내역 */}
      <section>
        <div className="mb-2 flex items-end justify-between">
          <h2 className="text-sm font-bold text-[#2D5A3D]">💳 최근 결제 내역</h2>
          <Link
            href="/admin/invoices"
            className="text-xs font-semibold text-[#2D5A3D] hover:underline"
          >
            전체 보기 →
          </Link>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-[#D4E4BC] bg-white">
          {recentPayments.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#6B6560]">
              <span className="text-3xl">💳</span>
              <p className="mt-2">아직 결제 내역이 없어요</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#F5E6D3]/40 text-left text-xs text-[#8B6F47]">
                <tr>
                  <th className="px-4 py-3 font-semibold">일시</th>
                  <th className="px-4 py-3 font-semibold">대상</th>
                  <th className="px-4 py-3 font-semibold">수단</th>
                  <th className="px-4 py-3 text-right font-semibold">금액</th>
                  <th className="px-4 py-3 font-semibold">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F0E4]">
                {recentPayments.map((p) => {
                  const inv = invoiceMap.get(p.invoice_id);
                  const sL = PAYMENT_STATUS_LABEL[p.status];
                  return (
                    <tr key={p.id} className="hover:bg-[#FFF8F0]/40">
                      <td className="px-4 py-2.5 text-xs text-[#6B6560]">
                        {fmtDateTime(p.completed_at ?? p.attempted_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        {inv ? (
                          <Link
                            href={`/admin/invoices/${inv.id}`}
                            className="font-semibold text-[#2D5A3D] hover:underline"
                          >
                            {inv.target_name ?? inv.invoice_number}
                          </Link>
                        ) : (
                          <span className="text-[#6B6560]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#6B4423]">
                        {p.method}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-[#2D5A3D]">
                        {fmtKRW(p.amount)}원
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${sL.cls}`}
                        >
                          {sL.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* 환불 요청 */}
      <section id="refunds">
        <div className="mb-2 flex items-end justify-between">
          <h2 className="text-sm font-bold text-[#2D5A3D]">↩️ 환불 대기</h2>
          <span className="text-xs text-[#8B6F47]">
            처리 대기 중인 요청만 표시
          </span>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-[#D4E4BC] bg-white">
          {refunds.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#6B6560]">
              <span className="text-3xl">✅</span>
              <p className="mt-2">대기 중인 환불 요청이 없어요</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#F5E6D3]/40 text-left text-xs text-[#8B6F47]">
                <tr>
                  <th className="px-4 py-3 font-semibold">요청일</th>
                  <th className="px-4 py-3 font-semibold">사유</th>
                  <th className="px-4 py-3 text-right font-semibold">요청액</th>
                  <th className="px-4 py-3 font-semibold">관련 청구서</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F0E4]">
                {refunds.slice(0, 10).map((r) => (
                  <tr key={r.id} className="hover:bg-[#FFF8F0]/40">
                    <td className="px-4 py-2.5 text-xs text-[#6B6560]">
                      {fmtDate(r.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#2C2C2C]">{r.reason}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-red-700">
                      {fmtKRW(r.requested_amount)}원
                    </td>
                    <td className="px-4 py-2.5">
                      {r.invoice_id ? (
                        <Link
                          href={`/admin/invoices/${r.invoice_id}`}
                          className="text-xs font-semibold text-[#2D5A3D] hover:underline"
                        >
                          상세 →
                        </Link>
                      ) : (
                        <span className="text-xs text-[#6B6560]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* 이번달 정산 요약 */}
      <section>
        <div className="mb-2 flex items-end justify-between">
          <h2 className="text-sm font-bold text-[#2D5A3D]">
            💸 이번달 정산 ({settlements.length}개)
          </h2>
          <Link
            href="/admin/settlements"
            className="text-xs font-semibold text-[#2D5A3D] hover:underline"
          >
            정산 관리 →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-2 rounded-2xl border border-[#D4E4BC] bg-white p-4 sm:grid-cols-2 md:grid-cols-4">
          {["DRAFT", "REVIEW", "APPROVED", "PAID"].map((status) => {
            const count = settlements.filter((s) => s.status === status).length;
            const sum = settlements
              .filter((s) => s.status === status)
              .reduce((acc, s) => acc + s.net_amount, 0);
            return (
              <div key={status} className="rounded-xl bg-[#FFF8F0] p-3">
                <div className="text-[11px] font-semibold text-[#8B6F47]">
                  {status === "DRAFT"
                    ? "초안"
                    : status === "REVIEW"
                      ? "검토"
                      : status === "APPROVED"
                        ? "승인"
                        : "지급완료"}
                </div>
                <div className="text-lg font-bold text-[#2D5A3D]">
                  {fmtKRW(count)}건
                </div>
                <div className="text-[11px] text-[#6B4423]">{fmtKRW(sum)}원</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
