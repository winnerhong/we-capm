import Link from "next/link";
import { updateBankAccountAction } from "../actions";

export const dynamic = "force-dynamic";

const BANKS = [
  "KB국민은행",
  "신한은행",
  "우리은행",
  "하나은행",
  "NH농협은행",
  "IBK기업은행",
  "SC제일은행",
  "카카오뱅크",
  "토스뱅크",
  "케이뱅크",
  "새마을금고",
  "신협",
  "우체국",
];

export default function StoreBankAccountPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="rounded-3xl bg-gradient-to-br from-[#C4956A] via-[#D9AB82] to-[#E8C9A0] p-6 text-white shadow-md md:p-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
              숲길 친구 정산
            </p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">🏦 정산 계좌 관리</h1>
            <p className="mt-2 text-sm text-white/90">
              매달 10일 정산액이 이 계좌로 입금돼요.
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

      {/* 현재 등록된 계좌 */}
      <section
        aria-labelledby="current-account-heading"
        className="rounded-3xl border border-[#E8C9A0] bg-white p-5 shadow-sm md:p-6"
      >
        <h2
          id="current-account-heading"
          className="text-base font-bold text-[#2D5A3D] md:text-lg"
        >
          현재 등록 계좌
        </h2>

        <div className="mt-3 rounded-2xl border border-[#F1D9B8] bg-[#FFF8F0] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#6B6560]">은행 · 계좌번호</p>
              <p className="mt-1 text-sm font-bold text-[#2D5A3D]">
                우리은행 1002-***-789012
              </p>
            </div>
            <span className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[11px] font-semibold text-[#2D5A3D]">
              실명 확인 완료
            </span>
          </div>
          <p className="mt-2 text-xs text-[#6B6560]">
            예금주: <strong className="text-[#2D5A3D]">홍길동 (숲속 베이커리)</strong>
          </p>
          <p className="mt-1 text-[11px] text-[#8B7F75]">
            최근 확인: 2026-04-10
          </p>
        </div>
      </section>

      {/* 계좌 변경 폼 */}
      <section
        aria-labelledby="change-account-heading"
        className="rounded-3xl border border-[#E8C9A0] bg-white p-5 shadow-sm md:p-6"
      >
        <h2
          id="change-account-heading"
          className="text-base font-bold text-[#2D5A3D] md:text-lg"
        >
          ✏️ 계좌 변경
        </h2>
        <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
          변경된 계좌는 다음달 정산분부터 적용돼요.
        </p>

        <form action={updateBankAccountAction} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="bank"
              className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
            >
              은행 <span className="text-[#B04A4A]">*</span>
            </label>
            <select
              id="bank"
              name="bank"
              required
              defaultValue=""
              className="w-full rounded-xl border border-[#E8C9A0] bg-white px-4 py-2.5 text-sm text-[#2C2C2C] focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
            >
              <option value="" disabled>
                선택해 주세요
              </option>
              {BANKS.map((bank) => (
                <option key={bank} value={bank}>
                  {bank}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="account_number"
              className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
            >
              계좌번호 <span className="text-[#B04A4A]">*</span>
            </label>
            <input
              id="account_number"
              name="account_number"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9-]{8,20}"
              placeholder="예: 1002-456-789012"
              required
              className="w-full rounded-xl border border-[#E8C9A0] bg-white px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
            />
            <p className="mt-1 text-[11px] text-[#8B7F75]">
              숫자와 - 만 입력 가능해요 (8~20자)
            </p>
          </div>

          <div>
            <label
              htmlFor="holder"
              className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
            >
              예금주 <span className="text-[#B04A4A]">*</span>
            </label>
            <input
              id="holder"
              name="holder"
              type="text"
              autoComplete="name"
              placeholder="예: 홍길동 또는 (주)숲속베이커리"
              required
              className="w-full rounded-xl border border-[#E8C9A0] bg-white px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
            />
            <p className="mt-1 text-[11px] text-[#8B7F75]">
              사업자등록증상의 명의와 일치해야 실명 확인을 통과해요.
            </p>
          </div>

          <div className="rounded-2xl bg-[#FFF4E0] p-4 text-xs text-[#8B5E3C]">
            ⚠️ 계좌 변경 시 <strong>실명 확인 API</strong>가 자동 실행돼요.
            예금주가 불일치하면 저장이 되지 않아요.
          </div>

          <div className="flex flex-col gap-2 md:flex-row">
            <button
              type="submit"
              className="flex-1 rounded-xl bg-[#2D5A3D] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/50"
            >
              실명 확인 후 저장
            </button>
            <Link
              href="/store/billing"
              className="flex-1 rounded-xl border border-[#E8C9A0] bg-white px-4 py-3 text-center text-sm font-semibold text-[#6B6560] transition hover:bg-[#FFF8F0]"
            >
              취소
            </Link>
          </div>
        </form>
      </section>

      {/* 변경 이력 */}
      <section className="rounded-3xl border border-[#E8C9A0] bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-base font-bold text-[#2D5A3D] md:text-lg">📜 변경 이력</h2>
        <ul className="mt-3 divide-y divide-[#F1D9B8]">
          <li className="flex items-center justify-between py-3 text-xs text-[#6B6560]">
            <div>
              <p className="font-semibold text-[#2D5A3D]">우리은행 1002-***-789012</p>
              <p className="mt-0.5 text-[11px] text-[#8B7F75]">홍길동</p>
            </div>
            <span className="text-[11px] text-[#8B7F75]">2026-04-10 등록</span>
          </li>
          <li className="flex items-center justify-between py-3 text-xs text-[#6B6560]">
            <div>
              <p className="font-semibold text-[#2D5A3D]">국민은행 123-45-***-890</p>
              <p className="mt-0.5 text-[11px] text-[#8B7F75]">홍길동</p>
            </div>
            <span className="text-[11px] text-[#8B7F75]">2025-11-02 해지</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
