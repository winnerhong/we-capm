import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  category: string;
  amount: number;
  vat: number;
  total_amount: number;
  status: "DRAFT" | "PENDING" | "PAID" | "CONFIRMED" | "EXPIRED" | "CANCELED" | "REFUNDED";
  issued_at: string;
  paid_at: string | null;
  tax_invoice_issued: boolean;
  description: string | null;
};

type BillingTab = "fees" | "settlement" | "tax" | "receipts";

function formatKrw(n: number) {
  return `₩${n.toLocaleString("ko-KR")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function statusBadge(status: InvoiceRow["status"]) {
  const map: Record<InvoiceRow["status"], { label: string; cls: string }> = {
    DRAFT: { label: "준비중", cls: "bg-[#F1EDE7] text-[#6B6560]" },
    PENDING: { label: "결제 대기", cls: "bg-[#FAE7D0] text-[#8B5E3C]" },
    PAID: { label: "결제 완료", cls: "bg-[#E8F0E4] text-[#2D5A3D]" },
    CONFIRMED: { label: "정산 확정", cls: "bg-[#E8F0E4] text-[#2D5A3D]" },
    EXPIRED: { label: "만료", cls: "bg-[#F1EDE7] text-[#8B7F75]" },
    CANCELED: { label: "취소", cls: "bg-[#FCE7E7] text-[#B04A4A]" },
    REFUNDED: { label: "환불", cls: "bg-[#FFF4E0] text-[#A67A52]" },
  };
  const v = map[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${v.cls}`}>
      {v.label}
    </span>
  );
}

function tabClass(active: boolean) {
  return `whitespace-nowrap rounded-t-xl border-b-2 px-4 py-2 text-sm font-semibold transition ${
    active
      ? "border-[#2D5A3D] text-[#2D5A3D]"
      : "border-transparent text-[#8B7F75] hover:text-[#2D5A3D]"
  }`;
}

type PageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

export default async function StoreBillingPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const tab: BillingTab =
    sp.tab === "settlement" || sp.tab === "tax" || sp.tab === "receipts"
      ? (sp.tab as BillingTab)
      : "fees";

  const supabase = await createClient();

  // Query coupon fee invoices for this affiliate.
  // TODO: target_id should be the logged-in affiliate ID; here we show all AFFILIATE/COUPON_FEE.
  type SelectChain = {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            order: (c: string, o: { ascending: boolean }) => {
              limit: (n: number) => Promise<{
                data: InvoiceRow[] | null;
                error: unknown;
              }>;
            };
          };
        };
      };
    };
  };
  const sb = supabase as unknown as SelectChain;

  const { data: invoices } = await sb
    .from("invoices")
    .select(
      "id,invoice_number,category,amount,vat,total_amount,status,issued_at,paid_at,tax_invoice_issued,description"
    )
    .eq("target_type", "AFFILIATE")
    .eq("category", "COUPON_FEE")
    .order("issued_at", { ascending: false })
    .limit(24);

  const rows: InvoiceRow[] = invoices ?? [];

  // Count used coupons (this month) from coupons.used_count.
  type CouponSel = {
    from: (t: string) => {
      select: (c: string) => Promise<{
        data: { used_count: number; max_uses: number | null }[] | null;
      }>;
    };
  };
  const sb2 = supabase as unknown as CouponSel;
  const { data: couponRows } = await sb2.from("coupons").select("used_count,max_uses");
  const totalIssued = (couponRows ?? []).reduce(
    (acc, c) => acc + (c.max_uses ?? 0),
    0
  );
  const totalUsed = (couponRows ?? []).reduce((acc, c) => acc + (c.used_count ?? 0), 0);
  // Fee structure: 쿠폰당 500원
  const perCouponFee = 500;
  const pendingFee = totalUsed * perCouponFee;
  const pendingVat = Math.floor(pendingFee * 0.1);
  const pendingTotal = pendingFee + pendingVat;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="rounded-3xl bg-gradient-to-br from-[#C4956A] via-[#D9AB82] to-[#E8C9A0] p-6 text-white shadow-md md:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
          숲길 친구 정산
        </p>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">💰 결제 &amp; 정산</h1>
        <p className="mt-2 text-sm text-white/90">
          쿠폰이 실제로 사용된 만큼만 수수료가 발생해요. 매달 10일 정산됩니다.
        </p>
      </header>

      {/* Tabs */}
      <nav className="flex gap-1 overflow-x-auto border-b border-[#E8C9A0]" aria-label="결제 정산 탭">
        <Link href="/store/billing?tab=fees" className={tabClass(tab === "fees")}>
          쿠폰 수수료
        </Link>
        <Link href="/store/billing?tab=settlement" className={tabClass(tab === "settlement")}>
          정산
        </Link>
        <Link href="/store/billing?tab=tax" className={tabClass(tab === "tax")}>
          세금계산서
        </Link>
        <Link href="/store/billing?tab=receipts" className={tabClass(tab === "receipts")}>
          영수증
        </Link>
      </nav>

      {tab === "fees" && (
        <>
          {/* 이번달 정산 예정 */}
          <section
            aria-labelledby="pending-heading"
            className="rounded-3xl border border-[#E8C9A0] bg-white p-5 shadow-sm md:p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 id="pending-heading" className="text-base font-bold text-[#2D5A3D] md:text-lg">
                  📅 이번달 정산 예정
                </h2>
                <p className="mt-1 text-xs text-[#6B6560]">
                  매달 10일 지정 계좌로 자동 정산돼요
                </p>
              </div>
              <Link
                href="/store/billing/settlements"
                className="self-start rounded-xl border border-[#C4956A] bg-white px-3 py-2 text-xs font-semibold text-[#8B5E3C] transition hover:bg-[#FFF8F0]"
              >
                정산 내역 전체보기 →
              </Link>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-[#F1D9B8] bg-[#FFF8F0] p-4">
                <dt className="text-xs text-[#6B6560]">발행 쿠폰</dt>
                <dd className="mt-1 text-xl font-bold text-[#2D5A3D]">
                  {totalIssued.toLocaleString("ko-KR")}장
                </dd>
                <p className="mt-1 text-[11px] text-[#8B7F75]">누적 발급 한도</p>
              </div>
              <div className="rounded-2xl border border-[#F1D9B8] bg-[#FFF8F0] p-4">
                <dt className="text-xs text-[#6B6560]">사용된 쿠폰</dt>
                <dd className="mt-1 text-xl font-bold text-[#2D5A3D]">
                  {totalUsed.toLocaleString("ko-KR")}장
                </dd>
                <p className="mt-1 text-[11px] text-[#8B5E3C]">수수료 발생 건수</p>
              </div>
              <div className="rounded-2xl border border-[#2D5A3D] bg-[#E8F0E4] p-4">
                <dt className="text-xs text-[#2D5A3D]">예정 정산액 (VAT 포함)</dt>
                <dd className="mt-1 text-xl font-bold text-[#2D5A3D]">
                  {formatKrw(pendingTotal)}
                </dd>
                <p className="mt-1 text-[11px] text-[#2D5A3D]">
                  {formatKrw(pendingFee)} + VAT {formatKrw(pendingVat)}
                </p>
              </div>
            </dl>

            {/* Fee breakdown bar */}
            <div className="mt-5 rounded-2xl bg-[#FFF8F0] p-4">
              <div className="flex items-center justify-between text-xs text-[#6B6560]">
                <span>쿠폰 사용률</span>
                <span className="font-semibold text-[#2D5A3D]">
                  {totalIssued > 0 ? Math.round((totalUsed / totalIssued) * 100) : 0}%
                </span>
              </div>
              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-[#F1D9B8]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52]"
                  style={{
                    width: `${
                      totalIssued > 0
                        ? Math.min(100, Math.round((totalUsed / totalIssued) * 100))
                        : 0
                    }%`,
                  }}
                  aria-hidden
                />
              </div>
              <p className="mt-2 text-[11px] text-[#8B7F75]">
                수수료 구조: 사용 쿠폰 1장당 <strong className="text-[#8B5E3C]">500원</strong>
                {" "}또는 할인 금액의 <strong className="text-[#8B5E3C]">5%</strong> 중 낮은 금액
              </p>
            </div>
          </section>

          {/* 쿠폰 수수료 청구서 목록 */}
          <section
            aria-labelledby="invoices-heading"
            className="rounded-3xl border border-[#E8C9A0] bg-white p-5 shadow-sm md:p-6"
          >
            <h2 id="invoices-heading" className="mb-4 text-base font-bold text-[#2D5A3D] md:text-lg">
              🧾 쿠폰 수수료 청구서
            </h2>

            {rows.length === 0 ? (
              <p className="rounded-2xl bg-[#FFF8F0] p-6 text-center text-sm text-[#8B7F75]">
                아직 발행된 청구서가 없어요. 쿠폰이 사용되면 자동으로 청구서가 생성돼요.
              </p>
            ) : (
              <ul className="divide-y divide-[#F1D9B8]">
                {rows.map((inv) => (
                  <li key={inv.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[#2D5A3D]">
                          {inv.invoice_number}
                        </span>
                        {statusBadge(inv.status)}
                      </div>
                      <p className="mt-1 text-xs text-[#6B6560]">
                        발행 {formatDate(inv.issued_at)}
                        {inv.paid_at ? ` · 결제 ${formatDate(inv.paid_at)}` : ""}
                      </p>
                      {inv.description && (
                        <p className="mt-0.5 truncate text-[11px] text-[#8B7F75]">
                          {inv.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-bold text-[#2D5A3D]">
                          {formatKrw(inv.total_amount)}
                        </p>
                        <p className="text-[11px] text-[#8B7F75]">
                          공급 {formatKrw(inv.amount)} + VAT {formatKrw(inv.vat)}
                        </p>
                      </div>
                      <Link
                        href={`/store/billing?tab=receipts&invoice=${inv.id}`}
                        className="rounded-lg border border-[#E8C9A0] bg-white px-3 py-1.5 text-xs font-semibold text-[#8B5E3C] transition hover:bg-[#FFF8F0]"
                      >
                        상세
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {tab === "settlement" && (
        <section className="rounded-3xl border border-[#E8C9A0] bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-base font-bold text-[#2D5A3D] md:text-lg">💸 정산 요약</h2>
          <p className="mt-2 text-sm text-[#6B6560]">
            월별 정산 내역과 조기 지급 요청은 전용 페이지에서 관리할 수 있어요.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Link
              href="/store/billing/settlements"
              className="block rounded-2xl border border-[#C4956A] bg-gradient-to-br from-[#FAE7D0] to-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-2xl" aria-hidden>
                📊
              </p>
              <h3 className="mt-2 text-sm font-bold text-[#2D5A3D]">월별 정산 내역</h3>
              <p className="mt-1 text-xs text-[#6B6560]">
                쿠폰 사용 통계, 수수료 산출 내역, 지급 일정
              </p>
            </Link>

            <Link
              href="/store/billing/bank-account"
              className="block rounded-2xl border border-[#C4956A] bg-gradient-to-br from-[#FAE7D0] to-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-2xl" aria-hidden>
                🏦
              </p>
              <h3 className="mt-2 text-sm font-bold text-[#2D5A3D]">정산 계좌 관리</h3>
              <p className="mt-1 text-xs text-[#6B6560]">
                은행, 계좌번호, 예금주 (실명 확인 포함)
              </p>
            </Link>
          </div>
        </section>
      )}

      {tab === "tax" && (
        <section className="rounded-3xl border border-[#E8C9A0] bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-base font-bold text-[#2D5A3D] md:text-lg">
            📄 세금계산서
          </h2>
          <p className="mt-2 text-sm text-[#6B6560]">
            매달 정산 확정 시점에 자동으로 세금계산서가 발행돼요. 발행 이메일은 설정한
            담당자 주소로 전송됩니다.
          </p>

          {rows.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-[#FFF8F0] p-6 text-center text-sm text-[#8B7F75]">
              아직 발행된 세금계산서가 없어요.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[#F1D9B8]">
              {rows.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-mono text-xs font-semibold text-[#2D5A3D]">
                      {inv.invoice_number}
                    </p>
                    <p className="mt-0.5 text-xs text-[#6B6560]">
                      {formatDate(inv.issued_at)} · 공급가 {formatKrw(inv.amount)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        inv.tax_invoice_issued
                          ? "bg-[#E8F0E4] text-[#2D5A3D]"
                          : "bg-[#F1EDE7] text-[#8B7F75]"
                      }`}
                    >
                      {inv.tax_invoice_issued ? "발행 완료" : "발행 대기"}
                    </span>
                    <button
                      type="button"
                      disabled={!inv.tax_invoice_issued}
                      className="rounded-lg border border-[#E8C9A0] bg-white px-3 py-1.5 text-xs font-semibold text-[#8B5E3C] transition hover:bg-[#FFF8F0] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      PDF 다운로드
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "receipts" && (
        <section className="rounded-3xl border border-[#E8C9A0] bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-base font-bold text-[#2D5A3D] md:text-lg">🧾 영수증</h2>
          <p className="mt-2 text-sm text-[#6B6560]">
            결제 완료된 청구서는 영수증을 다운로드 받을 수 있어요.
          </p>

          {rows.filter((r) => r.status === "PAID" || r.status === "CONFIRMED").length === 0 ? (
            <p className="mt-4 rounded-2xl bg-[#FFF8F0] p-6 text-center text-sm text-[#8B7F75]">
              결제 완료된 영수증이 아직 없어요.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[#F1D9B8]">
              {rows
                .filter((r) => r.status === "PAID" || r.status === "CONFIRMED")
                .map((inv) => (
                  <li
                    key={inv.id}
                    className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-mono text-xs font-semibold text-[#2D5A3D]">
                        {inv.invoice_number}
                      </p>
                      <p className="mt-0.5 text-xs text-[#6B6560]">
                        결제일 {inv.paid_at ? formatDate(inv.paid_at) : "-"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#2D5A3D]">
                        {formatKrw(inv.total_amount)}
                      </span>
                      <button
                        type="button"
                        className="rounded-lg bg-[#2D5A3D] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3A7A52]"
                      >
                        영수증 다운로드
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
