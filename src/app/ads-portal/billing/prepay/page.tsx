import Link from "next/link";
import { prepayDepositAction } from "../actions";
import { calculateAcornBonus, calculateVat } from "@/lib/billing/invoice";

const AMOUNT_OPTIONS = [
  { label: "100만원", value: 1_000_000, tone: "emerald" },
  { label: "500만원", value: 5_000_000, tone: "amber" },
  { label: "1,000만원", value: 10_000_000, tone: "violet" },
  { label: "5,000만원", value: 50_000_000, tone: "rose" },
];

function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

function BonusInfoCard({ amount }: { amount: number }) {
  const bonus = calculateAcornBonus(amount);
  const vat = calculateVat(amount);
  return (
    <div className="rounded-xl border border-[#D4E4BC] bg-[#F5F9EF] p-3 text-[11px] text-[#2D5A3D]">
      <div className="flex items-center justify-between">
        <span>기본 적립</span>
        <span className="font-bold">
          {bonus.acorns.toLocaleString("ko-KR")} 도토리
        </span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span>보너스 ({Math.round(bonus.bonusRate * 100)}%)</span>
        <span className="font-bold text-[#2D5A3D]">
          +{bonus.bonusAcorns.toLocaleString("ko-KR")} 도토리
        </span>
      </div>
      <div className="flex items-center justify-between mt-1 pt-1 border-t border-[#D4E4BC]">
        <span>VAT 10%</span>
        <span className="font-bold">{formatWon(vat.vat)}</span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="font-bold">총 결제 금액</span>
        <span className="font-extrabold text-base text-[#2D5A3D]">
          {formatWon(vat.total)}
        </span>
      </div>
    </div>
  );
}

export default async function PrepayPage({
  searchParams,
}: {
  searchParams: Promise<{ amount?: string }>;
}) {
  const sp = await searchParams;
  const selected = Number(sp?.amount ?? 1_000_000);
  const amount = AMOUNT_OPTIONS.some((o) => o.value === selected)
    ? selected
    : 1_000_000;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/ads-portal/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/ads-portal/billing" className="hover:text-[#2D5A3D]">
          결제·청구
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">선수금 충전</span>
      </nav>

      {/* 헤더 */}
      <section className="rounded-3xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#6B9B5E] p-6 text-white shadow-lg relative overflow-hidden">
        <div
          className="absolute -right-6 -top-6 text-[140px] opacity-10 select-none"
          aria-hidden
        >
          🌰
        </div>
        <div className="relative z-10">
          <p className="text-[11px] tracking-[0.4em] opacity-80 font-light">
            PREPAY
          </p>
          <h1 className="mt-1 text-2xl font-extrabold flex items-center gap-2">
            <span aria-hidden>🌰</span>
            <span>선수금 충전</span>
          </h1>
          <p className="mt-2 text-sm opacity-95">
            캠페인 집행에 사용할 도토리를 미리 충전하세요. 많이 충전할수록
            보너스가 커집니다.
          </p>
        </div>
      </section>

      {/* 금액 선택 (GET 리프레시) */}
      <section aria-label="금액 선택">
        <div className="flex items-center justify-between px-1 pb-2">
          <h2 className="text-sm font-bold text-[#6B4423]">충전 금액 선택</h2>
          <span className="text-[10px] text-[#8B6F47]">
            1,000원 = 1 도토리
          </span>
        </div>
        <form className="grid grid-cols-2 gap-3 md:grid-cols-4" action="">
          {AMOUNT_OPTIONS.map((opt) => {
            const isActive = opt.value === amount;
            return (
              <button
                key={opt.value}
                type="submit"
                name="amount"
                value={opt.value}
                aria-pressed={isActive}
                className={
                  isActive
                    ? "rounded-2xl border-2 border-[#2D5A3D] bg-gradient-to-br from-[#F5F9EF] to-white p-4 text-center shadow-md"
                    : "rounded-2xl border border-[#E5D3B8] bg-white p-4 text-center hover:border-[#C4956A] hover:shadow-sm transition-all"
                }
              >
                <div className="text-2xl" aria-hidden>
                  {opt.value >= 50_000_000
                    ? "🌲"
                    : opt.value >= 10_000_000
                      ? "🌳"
                      : opt.value >= 5_000_000
                        ? "🌿"
                        : "🌱"}
                </div>
                <div
                  className={
                    isActive
                      ? "mt-1 text-base font-extrabold text-[#2D5A3D]"
                      : "mt-1 text-base font-extrabold text-[#6B4423]"
                  }
                >
                  {opt.label}
                </div>
                <div className="mt-0.5 text-[10px] text-[#8B6F47]">
                  {calculateAcornBonus(opt.value).bonusRate > 0
                    ? `보너스 +${Math.round(calculateAcornBonus(opt.value).bonusRate * 100)}%`
                    : "기본"}
                </div>
              </button>
            );
          })}
        </form>
      </section>

      {/* 결제 폼 */}
      <section
        aria-label="결제 정보"
        className="rounded-2xl border border-[#E5D3B8] bg-white p-5"
      >
        <h2 className="text-sm font-bold text-[#6B4423] mb-3 flex items-center gap-1.5">
          <span aria-hidden>📝</span>
          <span>결제 정보</span>
        </h2>
        <form action={prepayDepositAction} className="space-y-4">
          <input type="hidden" name="amount" value={amount} />

          <BonusInfoCard amount={amount} />

          <div>
            <label
              htmlFor="company"
              className="block text-xs font-semibold text-[#6B4423] mb-1"
            >
              상호 (광고주명)
            </label>
            <input
              id="company"
              name="company"
              type="text"
              required
              autoComplete="organization"
              placeholder="예: (주)토리로"
              className="w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-sm text-[#6B4423] placeholder:text-[#C4B9AC] focus:border-[#8B6F47] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
            />
          </div>

          <fieldset>
            <legend className="block text-xs font-semibold text-[#6B4423] mb-2">
              결제 수단
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 cursor-pointer hover:bg-[#FFF8F0] has-[:checked]:border-[#2D5A3D] has-[:checked]:bg-[#F5F9EF]">
                <input
                  type="radio"
                  name="payment_method"
                  value="BANK_TRANSFER"
                  defaultChecked
                  className="accent-[#2D5A3D]"
                />
                <span className="text-sm text-[#6B4423]">🏦 무통장 입금</span>
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 cursor-pointer hover:bg-[#FFF8F0] has-[:checked]:border-[#2D5A3D] has-[:checked]:bg-[#F5F9EF]">
                <input
                  type="radio"
                  name="payment_method"
                  value="CARD"
                  className="accent-[#2D5A3D]"
                />
                <span className="text-sm text-[#6B4423]">💳 카드 결제(PG)</span>
              </label>
            </div>
          </fieldset>

          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
            <span aria-hidden>ℹ️</span>
            <p className="leading-relaxed">
              충전 신청 후 청구서가 생성됩니다. 입금 확인 완료 시점에 도토리가
              지갑에 반영되며, 세금계산서는 청구서 상세에서 요청할 수 있습니다.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/ads-portal/billing"
              className="flex-1 rounded-xl border border-[#E5D3B8] bg-white px-4 py-2.5 text-center text-sm font-semibold text-[#6B4423] hover:bg-[#FFF8F0]"
            >
              취소
            </Link>
            <button
              type="submit"
              className="flex-[2] rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40"
            >
              {formatWon(amount)} 충전 신청
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
