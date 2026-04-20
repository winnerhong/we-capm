import Link from "next/link";
import { getPartner } from "@/lib/auth-guard";

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const partner = await getPartner();

  return (
    <div className="min-h-dvh bg-[#FFF8F0]">
      {/* 준비 중 wait-list 배너 */}
      <div className="bg-gradient-to-r from-[#C4956A] to-[#D4E4BC] px-4 py-2 text-center text-xs font-semibold text-[#2D5A3D] md:text-sm">
        🌱 숲지기 포털은 현재 준비 중입니다 · 베타 오픈 대기자 신청을 받고 있어요
      </div>

      <header className="border-b border-[#D4E4BC] bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link
            href={partner ? "/partner/dashboard" : "/partner"}
            className="flex items-center gap-2 font-bold text-[#2D5A3D]"
          >
            <span className="text-xl">🏡</span>
            <span>토리로 숲지기</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {partner ? (
              <>
                <span className="rounded-full bg-[#E8F0E4] px-3 py-1 text-xs font-semibold text-[#2D5A3D]">
                  🌿 {partner.name}
                </span>
                <form action="/api/auth/partner-logout" method="post">
                  <button
                    type="submit"
                    className="rounded-lg border border-[#D4E4BC] px-3 py-1 text-xs text-[#6B6560] hover:bg-[#FFF8F0]"
                  >
                    로그아웃
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/partner"
                className="rounded-lg border border-[#D4E4BC] px-3 py-1 text-xs text-[#6B6560] hover:bg-[#FFF8F0]"
              >
                로그인
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
