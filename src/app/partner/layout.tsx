import Link from "next/link";
import { getPartner } from "@/lib/auth-guard";
import { PartnerNav } from "@/components/partner-nav";

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const partner = await getPartner();

  return (
    <div className="min-h-dvh bg-[#FFF8F0]">
      {/* 준비 중 wait-list 배너 */}
      <div className="bg-gradient-to-r from-[#C4956A] to-[#D4E4BC] px-4 py-1.5 text-center text-xs font-semibold text-[#2D5A3D]">
        🌱 숲지기 포털은 현재 준비 중입니다 · 베타 오픈 대기자 신청을 받고 있어요
      </div>

      {/* 로그인 안 한 상태면 심플 헤더, 로그인 되어 있으면 풀 네비 */}
      {partner ? (
        <PartnerNav partnerName={partner.name} />
      ) : (
        <header className="border-b border-[#D4E4BC] bg-white shadow-sm">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <Link href="/partner" className="flex items-center gap-2 font-bold text-[#2D5A3D]">
              <span className="text-xl">🏡</span>
              <span>토리로 숲지기</span>
            </Link>
            <Link
              href="/partner"
              className="rounded-lg border border-[#D4E4BC] px-3 py-1 text-xs text-[#6B6560] hover:bg-[#FFF8F0]"
            >
              로그인
            </Link>
          </div>
        </header>
      )}

      <main className={partner ? "mx-auto max-w-7xl px-4 py-6" : "mx-auto max-w-4xl px-4 py-6"}>
        {children}
      </main>
    </div>
  );
}
