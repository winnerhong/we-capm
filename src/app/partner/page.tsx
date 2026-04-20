import Link from "next/link";

export default function PartnerLoginPage() {
  return (
    <div className="flex min-h-[calc(100dvh-110px)] items-center justify-center py-10">
      <div className="w-full max-w-sm rounded-2xl border border-[#D4E4BC] bg-white p-6 shadow-sm md:p-8">
        <div className="mb-6 text-center">
          <div className="mb-2 text-4xl">🏡</div>
          <h1 className="text-2xl font-bold text-[#2D5A3D]">숲지기 로그인</h1>
          <p className="mt-1 text-sm text-[#6B6560]">숲길 운영을 시작해보세요</p>
        </div>

        <form action="/partner/dashboard" method="get" className="space-y-4">
          <div>
            <label htmlFor="partner-id" className="mb-1 block text-sm font-semibold text-[#2D5A3D]">
              아이디
            </label>
            <input
              id="partner-id"
              name="id"
              type="text"
              autoComplete="username"
              inputMode="text"
              placeholder="숲지기 아이디"
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
            />
          </div>

          <div>
            <label htmlFor="partner-pw" className="mb-1 block text-sm font-semibold text-[#2D5A3D]">
              비밀번호
            </label>
            <input
              id="partner-pw"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="비밀번호"
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-[#2D5A3D] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/50"
          >
            로그인
          </button>
        </form>

        <div className="mt-6 border-t border-[#D4E4BC] pt-4 text-center text-sm text-[#6B6560]">
          아직 가입하지 않으셨나요?{" "}
          <Link
            href="/partner/signup"
            className="font-semibold text-[#2D5A3D] underline-offset-2 hover:underline"
          >
            숲지기 되기 →
          </Link>
        </div>
      </div>
    </div>
  );
}
