import Link from "next/link";
import { AcornIcon } from "@/components/acorn-icon";
import {
  BUSINESS,
  PRIVACY_OFFICER_LINE,
  SUPPORT_LINE,
} from "@/lib/business-info";

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
              <AcornIcon size={18} />
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

        {/* 사업자 정보 (전자상거래법 제10조) — 값은 lib/business-info 한 곳에서 */}
        <div className="mt-10 border-t border-[#E8F0E4] pt-6 text-[11px] leading-relaxed text-[#8B6F47]">
          <p className="text-sm font-bold text-[#2D5A3D]">
            {BUSINESS.serviceName}
          </p>
          <div className="mt-2 grid gap-x-4 gap-y-1 md:grid-cols-2">
            <p>
              <span className="text-[#6B6560]">상호</span>{" "}
              {BUSINESS.companyName} ·{" "}
              <span className="text-[#6B6560]">대표</span>{" "}
              {BUSINESS.representative}
            </p>
            <p>
              <span className="text-[#6B6560]">사업자등록번호</span>{" "}
              {BUSINESS.registrationNumber}
            </p>
            <p className="md:col-span-2">
              <span className="text-[#6B6560]">주소</span> {BUSINESS.address}
            </p>
            <p>
              <span className="text-[#6B6560]">고객센터</span> {SUPPORT_LINE}
            </p>
            <p>
              <span className="text-[#6B6560]">이메일</span>{" "}
              <a
                href={`mailto:${BUSINESS.email}`}
                className="underline hover:no-underline"
              >
                {BUSINESS.email}
              </a>
            </p>
            <p>
              <span className="text-[#6B6560]">개인정보보호책임자</span>{" "}
              {PRIVACY_OFFICER_LINE}
            </p>
            <p>
              <span className="text-[#6B6560]">호스팅 제공자</span>{" "}
              {BUSINESS.hosting}
            </p>
          </div>

          <p className="mt-4 text-[11px]">
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
