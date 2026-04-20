import Link from "next/link";
import { redirect } from "next/navigation";
import { getPartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  category: string;
  amount: number;
  total_amount: number;
  status: string;
  expires_at: string;
  issued_at: string;
  description: string | null;
};

type SettlementRow = {
  id: string;
  period_start: string;
  period_end: string;
  net_amount: number;
  status: string;
};

type PartnerRow = {
  id: string;
  acorn_balance: number | null;
};

function wonKR(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function thisMonthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

async function loadDashboard(partnerId: string) {
  const supabase = await createClient();

  // 🌰 잔액
  let acornBalance = 0;
  try {
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<{ data: PartnerRow | null }>;
            };
          };
        };
      }
    )
      .from("partners")
      .select("id, acorn_balance")
      .eq("id", partnerId)
      .maybeSingle();
    acornBalance = data?.acorn_balance ?? 0;
  } catch {
    acornBalance = 0;
  }

  // 대기 중 청구서
  let pendingInvoices: InvoiceRow[] = [];
  let pendingTotal = 0;
  try {
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: string) => {
                eq: (k: string, v: string) => {
                  order: (
                    col: string,
                    opts: { ascending: boolean },
                  ) => {
                    limit: (n: number) => Promise<{ data: InvoiceRow[] | null }>;
                  };
                };
              };
            };
          };
        };
      }
    )
      .from("invoices")
      .select(
        "id, invoice_number, category, amount, total_amount, status, expires_at, issued_at, description",
      )
      .eq("target_type", "PARTNER")
      .eq("target_id", partnerId)
      .eq("status", "PENDING")
      .order("issued_at", { ascending: false })
      .limit(5);
    pendingInvoices = data ?? [];
    pendingTotal = pendingInvoices.reduce((s, i) => s + (i.total_amount ?? 0), 0);
  } catch {
    pendingInvoices = [];
  }

  // 이번달 결제 합
  let thisMonthPaid = 0;
  try {
    const monthStart = thisMonthStart();
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: string) => {
                in: (k: string, v: string[]) => {
                  gte: (k: string, v: string) => Promise<{
                    data: { total_amount: number }[] | null;
                  }>;
                };
              };
            };
          };
        };
      }
    )
      .from("invoices")
      .select("total_amount")
      .eq("target_type", "PARTNER")
      .eq("target_id", partnerId)
      .in("status", ["PAID", "CONFIRMED"])
      .gte("issued_at", monthStart);
    thisMonthPaid = (data ?? []).reduce(
      (s, r) => s + (r.total_amount ?? 0),
      0,
    );
  } catch {
    thisMonthPaid = 0;
  }

  // 다가오는 정산
  let upcomingSettlement: SettlementRow | null = null;
  try {
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => {
                limit: (n: number) => Promise<{ data: SettlementRow[] | null }>;
              };
            };
          };
        };
      }
    )
      .from("settlements")
      .select("id, period_start, period_end, net_amount, status")
      .eq("partner_id", partnerId)
      .order("period_start", { ascending: false })
      .limit(1);
    upcomingSettlement = data?.[0] ?? null;
  } catch {
    upcomingSettlement = null;
  }

  return { acornBalance, pendingInvoices, pendingTotal, thisMonthPaid, upcomingSettlement };
}

const TABS = [
  { href: "/partner/billing/invoices", icon: "🧾", label: "청구서", desc: "결제 대기" },
  { href: "/partner/billing/settlements", icon: "💸", label: "정산", desc: "월별 정산 내역" },
  { href: "/partner/billing/receipts", icon: "📄", label: "영수증", desc: "세금계산서" },
  { href: "/partner/billing/acorns", icon: "🌰", label: "도토리", desc: "자체 충전" },
] as const;

export default async function PartnerBillingPage() {
  const partner = await getPartner();
  if (!partner) redirect("/partner");

  const { acornBalance, pendingInvoices, pendingTotal, thisMonthPaid, upcomingSettlement } =
    await loadDashboard(partner.id);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <Link
          href="/partner/dashboard"
          className="text-sm font-medium text-[#2D5A3D] hover:underline"
        >
          ← 대시보드
        </Link>
      </div>

      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#D4E4BC]">
          Billing Center
        </p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold md:text-3xl">
          <span>💳</span>
          <span>결제 &amp; 정산</span>
        </h1>
        <p className="mt-1 text-sm text-[#E8F0E4]">
          {partner.name} 숲지기님의 청구서, 정산, 도토리 충전을 한 곳에서 관리해요.
        </p>
      </section>

      {/* 요약 카드 3개 */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[#E5D3B8] bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#8B6F47]">
            <span className="text-lg">🌰</span>
            <span>보유 도토리</span>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#6B4423]">
            {acornBalance.toLocaleString("ko-KR")}
            <span className="ml-1 text-sm font-semibold">🌰</span>
          </div>
          <Link
            href="/partner/billing/acorns"
            className="mt-2 inline-block text-[11px] font-semibold text-[#8B6F47] hover:text-[#6B4423] hover:underline"
          >
            충전하기 →
          </Link>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
            <span className="text-lg">⏳</span>
            <span>결제 대기 청구서</span>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-900">
            {pendingInvoices.length}
            <span className="ml-1 text-sm font-semibold">건</span>
          </div>
          <div className="mt-0.5 text-[11px] text-amber-800">
            합계 {wonKR(pendingTotal)}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
            <span className="text-lg">💰</span>
            <span>이번달 결제</span>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-900">
            {wonKR(thisMonthPaid)}
          </div>
          <div className="mt-0.5 text-[11px] text-emerald-800">
            확정 완료 기준
          </div>
        </div>
      </section>

      {/* 탭 그리드 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm md:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>🧭</span>
          <span>빠른 이동</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {TABS.map((t) => (
            <Link
              key={t.label}
              href={t.href}
              className="group flex flex-col items-center justify-center rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-4 text-center transition hover:border-[#3A7A52] hover:bg-[#E8F0E4] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]"
            >
              <div className="text-3xl">{t.icon}</div>
              <div className="mt-2 text-sm font-semibold text-[#2D5A3D]">
                {t.label}
              </div>
              <div className="mt-0.5 text-[11px] text-[#6B6560]">{t.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* 대기 중 청구서 미리보기 */}
      {pendingInvoices.length > 0 && (
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm md:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
              <span>📋</span>
              <span>대기 중 청구서</span>
            </h2>
            <Link
              href="/partner/billing/invoices"
              className="text-xs font-semibold text-[#3A7A52] hover:text-[#2D5A3D] hover:underline"
            >
              전체 보기 →
            </Link>
          </div>
          <ul className="space-y-2">
            {pendingInvoices.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`/partner/billing/invoices/${inv.id}`}
                  className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 transition hover:bg-amber-100"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#2D5A3D]">
                      {inv.description ?? inv.invoice_number}
                    </p>
                    <p className="mt-0.5 text-[11px] text-amber-800">
                      {inv.invoice_number} · 만기{" "}
                      {new Date(inv.expires_at).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <p className="text-sm font-extrabold text-amber-900">
                      {wonKR(inv.total_amount)}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-amber-700">
                      결제 대기
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 다가오는 정산 */}
      {upcomingSettlement && (
        <section className="rounded-2xl border border-[#D4E4BC] bg-gradient-to-br from-white to-[#E8F0E4] p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
              <span>💸</span>
              <span>다가오는 정산</span>
            </h2>
            <Link
              href="/partner/billing/settlements"
              className="text-xs font-semibold text-[#3A7A52] hover:text-[#2D5A3D] hover:underline"
            >
              전체 정산 →
            </Link>
          </div>
          <p className="text-xs text-[#6B6560]">
            {new Date(upcomingSettlement.period_start).toLocaleDateString("ko-KR")} ~{" "}
            {new Date(upcomingSettlement.period_end).toLocaleDateString("ko-KR")}
          </p>
          <p className="mt-1 text-xl font-extrabold text-[#2D5A3D]">
            {wonKR(upcomingSettlement.net_amount)}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-[#3A7A52]">
            상태: {upcomingSettlement.status}
          </p>
        </section>
      )}
    </div>
  );
}
