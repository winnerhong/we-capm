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
              숲에서 자라는 가족의 시간.
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

          {/* 고객지원 / 법적고지 */}
          <nav aria-label="고객 지원 및 법적 고지">
            <h3 className="text-xs font-bold tracking-wider text-[#2D5A3D]">
              고객지원
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-[#6B6560]">
              <li>
                <Link href="/terms" className="hover:text-[#2D5A3D]">
                  이용약관
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="font-semibold text-[#2D5A3D] hover:underline"
                >
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <Link href="/business" className="hover:text-[#2D5A3D]">
                  사업자 정보
                </Link>
              </li>
              <li>
                <a
                  href="mailto:hello@toriro.com"
                  className="hover:text-[#2D5A3D]"
                >
                  고객센터
                </a>
              </li>
            </ul>
          </nav>
        </div>

        {/* 사업자 정보 (전자상거래법 제10조) */}
        <div className="mt-10 border-t border-[#E8F0E4] pt-6 text-[11px] leading-relaxed text-[#8B6F47]">
          <p className="text-sm font-bold text-[#2D5A3D]">
            토리로 (TORIRO)
          </p>
          <div className="mt-2 grid gap-x-4 gap-y-1 md:grid-cols-2">
            <p>
              <span className="text-[#6B6560]">상호</span> 토리로 ·{" "}
              <span className="text-[#6B6560]">대표</span> 홍길동
            </p>
            <p>
              <span className="text-[#6B6560]">사업자등록번호</span>{" "}
              000-00-00000
            </p>
            <p>
              <span className="text-[#6B6560]">통신판매업신고</span>{" "}
              제2026-서울-0000호
            </p>
            <p>
              <span className="text-[#6B6560]">개인정보보호책임자</span>{" "}
              홍길동 (privacy@toriro.com)
            </p>
            <p className="md:col-span-2">
              <span className="text-[#6B6560]">주소</span>{" "}
              서울특별시 ○○구 ○○로 00, 00층
            </p>
            <p>
              <span className="text-[#6B6560]">고객센터</span> 1588-0000
              (평일 10:00-17:00)
            </p>
            <p>
              <span className="text-[#6B6560]">이메일</span>{" "}
              <a
                href="mailto:hello@toriro.com"
                className="underline hover:no-underline"
              >
                hello@toriro.com
              </a>
            </p>
            <p className="md:col-span-2">
              <span className="text-[#6B6560]">호스팅 제공자</span> Vercel
              Inc. / Amazon Web Services
            </p>
          </div>

          <p className="mt-4 text-[11px] text-[#C4956A]">
            ⚠️ 위 사업자 정보는 샘플 플레이스홀더입니다. 실제 서비스 운영 시
            반드시 실제 사업자 정보로 교체해 주세요.{" "}
            <Link href="/business" className="underline hover:no-underline">
              사업자 정보 전체 보기
            </Link>
          </p>

          <p className="mt-4 text-[11px]">
            © 2026 TORIRO. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
