import Link from "next/link";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#FFF8F0]">
      {/* 숲길 친구 베타 배너 */}
      <div className="bg-gradient-to-r from-[#C4956A] to-[#E8C9A0] px-4 py-2 text-center text-xs font-semibold text-white md:text-sm">
        🌳 숲길 친구(가맹점) 포털 · 따뜻한 선물로 가족들을 만나보세요
      </div>

      <header className="border-b border-[#E8C9A0] bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/store/dashboard" className="flex items-center gap-2 font-bold text-[#2D5A3D]">
            <span className="text-xl">🌳</span>
            <span>숲길 친구</span>
          </Link>

          <nav className="hidden items-center gap-4 text-sm font-medium text-[#6B6560] md:flex">
            <Link href="/store/dashboard" className="hover:text-[#2D5A3D]">
              대시보드
            </Link>
            <Link href="/store/dashboard#coupons" className="hover:text-[#2D5A3D]">
              쿠폰 관리
            </Link>
            <Link href="/store/dashboard#targeting" className="hover:text-[#2D5A3D]">
              행사 타겟팅
            </Link>
            <Link href="/store/dashboard#analytics" className="hover:text-[#2D5A3D]">
              성과 분석
            </Link>
          </nav>

          <div className="flex items-center gap-2 text-sm">
            <span className="rounded-full bg-[#FAE7D0] px-3 py-1 text-xs font-semibold text-[#8B5E3C]">
              🌰 숲길 친구
            </span>
            <form action="/store" method="get">
              <button
                type="submit"
                className="rounded-lg border border-[#E8C9A0] px-3 py-1 text-xs text-[#6B6560] hover:bg-[#FFF8F0]"
              >
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>

      <footer className="mt-10 border-t border-[#E8C9A0] bg-white py-6 text-center text-xs text-[#8B7F75]">
        토리로 · 숲길 친구 포털 · 문의 friends@toriro.kr
      </footer>
    </div>
  );
}
