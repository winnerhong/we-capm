import Link from "next/link";

export default function AdsPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#FFF8F0]">
      {/* 헤더 — 숲속 정령 포털 */}
      <header className="border-b border-[#E5D3B8] bg-white shadow-sm sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/ads-portal" className="flex items-center gap-2 font-bold text-[#6B4423]">
            <span className="text-xl" aria-hidden>🧚</span>
            <span className="text-[15px]">숲속 정령</span>
            <span className="rounded-full bg-[#F5E6D3] px-2 py-0.5 text-[10px] font-semibold text-[#8B6F47] border border-[#E5D3B8]">
              광고주
            </span>
          </Link>

          <div className="flex items-center gap-2">
            {/* Stage 표시 */}
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 border border-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" aria-hidden />
              Stage 1 · 준비 중
            </span>
            <Link
              href="/ads-portal/dashboard"
              className="rounded-lg border border-[#E5D3B8] bg-white px-3 py-1 text-xs font-semibold text-[#6B4423] hover:bg-[#FFF8F0]"
            >
              대시보드
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-4">{children}</div>

      {/* 푸터 */}
      <footer className="mx-auto mt-10 max-w-6xl border-t border-[#E5D3B8] px-4 py-6 text-center">
        <p className="text-xs text-[#8B6F47]">
          🌳 토리로 광고 플랫폼 · 숲속 정령이 숲의 친구들에게 이야기를 전합니다
        </p>
      </footer>
    </div>
  );
}
