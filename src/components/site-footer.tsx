import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#D4E4BC] bg-white">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-extrabold text-[#2D5A3D]"
            >
              <span aria-hidden>🌰</span>
              <span>토리로</span>
            </Link>
            <p className="mt-3 text-xs leading-relaxed text-[#6B6560]">
              숲길에서 만나는 가족의 하루.
              <br />
              가족 · 기업 · 지역사회가 함께하는 곳.
            </p>
            <div className="mt-4 flex gap-2" aria-label="소셜 미디어">
              <a
                href="#"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D4E4BC] text-sm text-[#2D5A3D] hover:bg-[#E8F0E4]"
                aria-label="인스타그램"
              >
                📷
              </a>
              <a
                href="#"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D4E4BC] text-sm text-[#2D5A3D] hover:bg-[#E8F0E4]"
                aria-label="블로그"
              >
                📝
              </a>
              <a
                href="#"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D4E4BC] text-sm text-[#2D5A3D] hover:bg-[#E8F0E4]"
                aria-label="유튜브"
              >
                📺
              </a>
            </div>
          </div>

          {/* 서비스 */}
          <nav aria-label="서비스 링크">
            <h3 className="text-xs font-bold tracking-wider text-[#2D5A3D]">
              서비스
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-[#6B6560]">
              <li>
                <Link href="/events" className="hover:text-[#2D5A3D]">
                  숲길 찾기
                </Link>
              </li>
              <li>
                <Link href="/programs" className="hover:text-[#2D5A3D]">
                  프로그램
                </Link>
              </li>
              <li>
                <Link href="/enterprise" className="hover:text-[#2D5A3D]">
                  기업 문의
                </Link>
              </li>
              <li>
                <Link href="/partner" className="hover:text-[#2D5A3D]">
                  숲지기 되기
                </Link>
              </li>
            </ul>
          </nav>

          {/* 콘텐츠 */}
          <nav aria-label="콘텐츠 링크">
            <h3 className="text-xs font-bold tracking-wider text-[#2D5A3D]">
              알아보기
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-[#6B6560]">
              <li>
                <Link href="/blog" className="hover:text-[#2D5A3D]">
                  블로그
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-[#2D5A3D]">
                  자주 묻는 질문
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-[#2D5A3D]">
                  회사 소개
                </Link>
              </li>
            </ul>
          </nav>

          {/* 회사 */}
          <nav aria-label="회사 링크">
            <h3 className="text-xs font-bold tracking-wider text-[#2D5A3D]">
              회사
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-[#6B6560]">
              <li>
                <Link href="/about" className="hover:text-[#2D5A3D]">
                  회사 소개
                </Link>
              </li>
              <li>
                <a
                  href="mailto:careers@toriro.kr"
                  className="hover:text-[#2D5A3D]"
                >
                  채용
                </a>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-[#2D5A3D]">
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-[#2D5A3D]">
                  이용약관
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        {/* 사업자 정보 */}
        <div className="mt-10 border-t border-[#E8F0E4] pt-6 text-[11px] leading-relaxed text-[#8B6F47]">
          <p className="font-semibold">(주)토리로</p>
          <p className="mt-1">
            대표 홍보광 · 사업자등록번호 123-45-67890 · 통신판매업신고 제
            2026-서울성동-0000호
          </p>
          <p className="mt-1">
            서울특별시 성동구 성수동 1가 숲속로 25 · 고객센터 1544-0000 ·
            hello@toriro.kr
          </p>
          <p className="mt-3">© 2026 Toriro Inc. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
