import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requestSettlementPayoutAction } from "../actions";

export const dynamic = "force-dynamic";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  amount: number;
  vat: number;
  total_amount: number;
  status: "DRAFT" | "PENDING" | "PAID" | "CONFIRMED" | "EXPIRED" | "CANCELED" | "REFUNDED";
  issued_at: string;
  paid_at: string | null;
};

type MonthlyBucket = {
  ymKey: string; // 2026-04
  label: string; // 2026년 4월
  issuedCount: number;
  usedCount: number;
  fees: number;
  vat: number;
  total: number;
  statuses: InvoiceRow["status"][];
  payoutDate: string; // 2026-05-10
};

function formatKrw(n: number) {
  return `₩${n.toLocaleString("ko-KR")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${y}년 ${Number(m)}월`;
}

function payoutDateOf(key: string) {
  // 정산일 = 다음달 10일
  const [y, m] = key.split("-").map((v) => Number(v));
  const next = new Date(y, m, 10);
  return next.toLocaleDateString("ko-KR");
}

export default async function StoreSettlementsPage() {
  const supabase = await createClient();

  type SelectChain = {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            order: (c: string, o: { ascending: boolean }) => {
              limit: (n: number) => Promise<{
                data: InvoiceRow[] | null;
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
    .select("id,invoice_number,amount,vat,total_amount,status,issued_at,paid_at")
    .eq("target_type", "AFFILIATE")
    .eq("category", "COUPON_FEE")
    .order("issued_at", { ascending: false })
    .limit(100);

  const rows: InvoiceRow[] = invoices ?? [];

  // Group by YYYY-MM of issued_at.
  const bucketMap = new Map<string, MonthlyBucket>();
  for (const r of rows) {
    const d = new Date(r.issued_at);
    const ymKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const existing = bucketMap.get(ymKey);
    if (existing) {
      existing.issuedCount += 1;
      existing.usedCount += 1; // 청구서 1건당 사용 쿠폰 최소 1장
      existing.fees += r.amount;
      existing.vat += r.vat;
      existing.total += r.total_amount;
      existing.statuses.push(r.status);
    } else {
      bucketMap.set(ymKey, {
        ymKey,
        label: monthLabel(ymKey),
        issuedCount: 1,
        usedCount: 1,
        fees: r.amount,
        vat: r.vat,
        total: r.total_amount,
        statuses: [r.status],
        payoutDate: payoutDateOf(ymKey),
      });
    }
  }
  const buckets = Array.from(bucketMap.values()).sort((a, b) =>
    a.ymKey < b.ymKey ? 1 : -1
  );

  // 이번달(예정) 금액: 가장 최근 월의 PENDING/PAID/CONFIRMED 총합
  const pendingBucket = buckets[0];
  const pendingPayout = pendingBucket
    ? pendingBucket.statuses.some((s) => s === "PENDING")
      ? pendingBucket.total
      : 0
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="rounded-3xl bg-gradient-to-br from-[#C4956A] via-[#D9AB82] to-[#E8C9A0] p-6 text-white shadow-md md:p-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
              숲길 친구 정산
            </p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">📊 월별 정산 내역</h1>
            <p className="mt-2 text-sm text-white/90">
              매달 10일 전월 정산액이 등록된 계좌로 자동 송금돼요.
            </p>
          </div>
          <Link
            href="/store/billing"
            className="rounded-xl bg-white/20 px-3 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/30"
          >
            ← 정산 홈
          </Link>
        </div>
      </header>

      {/* 수수료 구조 안내 */}
      <section className="rounded-3xl border border-[#E8C9A0] bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-base font-bold text-[#2D5A3D] md:text-lg">💡 수수료 구조</h2>
        <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <li className="rounded-2xl border border-[#F1D9B8] bg-[#FFF8F0] p-4">
            <p className="text-xs text-[#6B6560]">기본 요율</p>
            <p className="mt-1 text-lg font-bold text-[#2D5A3D]">쿠폰 1장당 500원</p>
            <p className="mt-1 text-[11px] text-[#8B7F75]">
              사용된 쿠폰에 한해서만 정액으로 청구돼요.
            </p>
          </li>
          <li className="rounded-2xl border border-[#F1D9B8] bg-[#FFF8F0] p-4">
            <p className="text-xs text-[#6B6560]">대체 요율</p>
            <p className="mt-1 text-lg font-bold text-[#2D5A3D]">할인 금액의 5%</p>
            <p className="mt-1 text-[11px] text-[#8B7F75]">
              고액 할인 쿠폰은 정액과 정률 중 낮은 금액이 적용돼요.
            </p>
          </li>
        </ul>
      </section>

      {/* 월별 테이블 */}
      <section
        aria-labelledby="monthly-heading"
        className="rounded-3xl border border-[#E8C9A0] bg-white p-5 shadow-sm md:p-6"
      >
        <h2
          id="monthly-heading"
          className="mb-4 text-base font-bold text-[#2D5A3D] md:text-lg"
        >
          🗓️ 월별 정산
        </h2>

        {buckets.length === 0 ? (
          <p className="rounded-2xl bg-[#FFF8F0] p-6 text-center text-sm text-[#8B7F75]">
            아직 정산 내역이 없어요. 쿠폰이 사용되면 월별로 집계돼요.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E8C9A0] text-left text-xs text-[#8B7F75]">
                  <th className="py-2 pr-4 font-semibold">월</th>
                  <th className="py-2 pr-4 font-semibold">사용 쿠폰</th>
                  <th className="py-2 pr-4 font-semibold">수수료</th>
                  <th className="py-2 pr-4 font-semibold">VAT</th>
                  <th className="py-2 pr-4 font-semibold">정산액</th>
                  <th className="py-2 pr-4 font-semibold">지급일</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b) => (
                  <tr key={b.ymKey} className="border-b border-[#F1D9B8]">
                    <td className="py-3 pr-4 font-semibold text-[#2D5A3D]">{b.label}</td>
                    <td className="py-3 pr-4 text-[#6B6560]">
                      {b.usedCount.toLocaleString("ko-KR")}장
                    </td>
                    <td className="py-3 pr-4 text-[#6B6560]">{formatKrw(b.fees)}</td>
                    <td className="py-3 pr-4 text-[#6B6560]">{formatKrw(b.vat)}</td>
                    <td className="py-3 pr-4 font-bold text-[#2D5A3D]">
                      {formatKrw(b.total)}
                    </td>
                    <td className="py-3 pr-4 text-[#8B5E3C]">{b.payoutDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 조기 지급 요청 */}
      <section className="rounded-3xl border-2 border-dashed border-[#C4956A] bg-gradient-to-br from-white to-[#FAE7D0] p-5 shadow-sm md:p-6">
        <h2 className="text-base font-bold text-[#2D5A3D] md:text-lg">
          ⚡ 조기 지급 요청
        </h2>
        <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
          이번달 예정 정산액을 앞당겨 받을 수 있어요. (수수료 1%, 영업일 2일 소요)
        </p>

        <form action={requestSettlementPayoutAction} className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="payout-amount"
              className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
            >
              요청 금액
            </label>
            <input
              id="payout-amount"
              name="amount"
              type="number"
              inputMode="numeric"
              min={10000}
              step={1000}
              defaultValue={pendingPayout || 100000}
              required
              className="w-full rounded-xl border border-[#E8C9A0] bg-white px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
            />
            <p className="mt-1 text-[11px] text-[#8B7F75]">
              이번달 예정 정산액: {formatKrw(pendingPayout)}
            </p>
          </div>

          <div>
            <label
              htmlFor="payout-memo"
              className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
            >
              메모 (선택)
            </label>
            <input
              id="payout-memo"
              name="memo"
              type="text"
              maxLength={80}
              placeholder="예: 재료 매입 때문에 앞당겨 필요해요"
              className="w-full rounded-xl border border-[#E8C9A0] bg-white px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-[#2D5A3D] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/50"
          >
            조기 지급 요청하기
          </button>
          <p className="text-center text-[11px] text-[#8B7F75]">
            요청 후 담당자가 검토 뒤 승인 메일을 보내드려요.
          </p>
        </form>
      </section>
    </div>
  );
}
