import Link from "next/link";

export default function StoreLandingPage() {
  return (
    <div className="space-y-10 py-4">
      {/* Hero */}
      <section className="rounded-3xl border border-[#E8C9A0] bg-gradient-to-br from-[#FFF8F0] via-[#FAE7D0] to-[#F1D9B8] p-6 shadow-sm md:p-10">
        <div className="text-center">
          <div className="mb-3 text-5xl">🌳</div>
          <h1 className="text-2xl font-bold text-[#2D5A3D] md:text-3xl">숲길 친구 (가맹점)</h1>
          <p className="mt-2 text-sm text-[#6B6560] md:text-base">
            토리로 가족들에게 따뜻한 선물을 전해주세요
          </p>
          <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-semibold text-[#8B5E3C] shadow-sm md:text-sm">
            ✨ 행사 종료 후 자동으로 쿠폰이 전달돼요
          </div>
        </div>
      </section>

      {/* 혜택 카드 3종 */}
      <section>
        <h2 className="mb-4 text-center text-lg font-bold text-[#2D5A3D] md:text-xl">
          왜 숲길 친구인가요?
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-[#E8C9A0] bg-white p-5 shadow-sm">
            <div className="mb-2 text-3xl">🎯</div>
            <h3 className="text-base font-bold text-[#2D5A3D]">자동 타겟팅</h3>
            <p className="mt-1 text-sm text-[#6B6560]">
              우리 가게 근처에서 열리는 행사의 가족들에게만 쿠폰이 전달돼요.
            </p>
          </article>

          <article className="rounded-2xl border border-[#E8C9A0] bg-white p-5 shadow-sm">
            <div className="mb-2 text-3xl">💰</div>
            <h3 className="text-base font-bold text-[#2D5A3D]">성과형 과금</h3>
            <p className="mt-1 text-sm text-[#6B6560]">
              쿠폰이 실제로 사용됐을 때만 수수료가 발생해요. 홍보비 걱정 NO.
            </p>
          </article>

          <article className="rounded-2xl border border-[#E8C9A0] bg-white p-5 shadow-sm">
            <div className="mb-2 text-3xl">📊</div>
            <h3 className="text-base font-bold text-[#2D5A3D]">실시간 리포트</h3>
            <p className="mt-1 text-sm text-[#6B6560]">
              전달 → 열람 → 방문 → 사용까지 모든 단계를 숫자로 확인해요.
            </p>
          </article>
        </div>
      </section>

      {/* Login form (stub) + Waitlist */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-[#E8C9A0] bg-white p-6 shadow-sm">
          <div className="mb-4 text-center">
            <div className="mb-2 text-3xl">🔐</div>
            <h2 className="text-lg font-bold text-[#2D5A3D]">숲길 친구 로그인</h2>
            <p className="mt-1 text-xs text-[#6B6560]">등록된 가맹점만 이용 가능해요</p>
          </div>

          <form action="/store/dashboard" method="get" className="space-y-3">
            <div>
              <label
                htmlFor="store-id"
                className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
              >
                사업자 아이디
              </label>
              <input
                id="store-id"
                name="id"
                type="text"
                autoComplete="username"
                inputMode="text"
                placeholder="예: forest_cafe"
                className="w-full rounded-xl border border-[#E8C9A0] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
              />
            </div>

            <div>
              <label
                htmlFor="store-pw"
                className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
              >
                비밀번호
              </label>
              <input
                id="store-pw"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="비밀번호"
                className="w-full rounded-xl border border-[#E8C9A0] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-[#2D5A3D] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/50"
            >
              로그인
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-[#8B7F75]">
            비밀번호를 잊으셨나요?{" "}
            <Link href="#" className="font-semibold text-[#8B5E3C] hover:underline">
              재설정
            </Link>
          </p>
        </div>

        {/* Waitlist */}
        <div className="rounded-2xl border-2 border-dashed border-[#C4956A] bg-gradient-to-br from-white to-[#FAE7D0] p-6 shadow-sm">
          <div className="mb-4 text-center">
            <div className="mb-2 text-3xl">🌱</div>
            <h2 className="text-lg font-bold text-[#2D5A3D]">가맹점 등록 대기 신청</h2>
            <p className="mt-1 text-xs text-[#6B6560]">
              오픈 소식을 가장 먼저 알려드릴게요
            </p>
          </div>

          <form action="#" method="post" className="space-y-3">
            <div>
              <label
                htmlFor="wait-name"
                className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
              >
                가게 이름
              </label>
              <input
                id="wait-name"
                name="store_name"
                type="text"
                autoComplete="organization"
                placeholder="예: 숲속 베이커리"
                className="w-full rounded-xl border border-[#E8C9A0] bg-white px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
              />
            </div>

            <div>
              <label
                htmlFor="wait-phone"
                className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
              >
                연락처
              </label>
              <input
                id="wait-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="010-1234-5678"
                pattern="[0-9]{3}-[0-9]{4}-[0-9]{4}"
                className="w-full rounded-xl border border-[#E8C9A0] bg-white px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
              />
            </div>

            <div>
              <label
                htmlFor="wait-category"
                className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
              >
                업종
              </label>
              <select
                id="wait-category"
                name="category"
                className="w-full rounded-xl border border-[#E8C9A0] bg-white px-4 py-2.5 text-sm text-[#2C2C2C] focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
                defaultValue=""
              >
                <option value="" disabled>
                  선택해 주세요
                </option>
                <option value="restaurant">🍽️ 음식점</option>
                <option value="cafe">☕ 카페·베이커리</option>
                <option value="experience">🎨 체험·액티비티</option>
                <option value="education">📚 교육·학원</option>
                <option value="shop">🛍️ 소매·편의</option>
                <option value="etc">기타</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-[#C4956A] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#A67A52] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/50"
            >
              대기 신청하기
            </button>
            <p className="text-center text-[11px] text-[#8B7F75]">
              제출 시 토리로 가맹 약관에 동의하는 것으로 간주돼요.
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}
