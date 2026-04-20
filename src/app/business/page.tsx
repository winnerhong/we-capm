import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { BackToTop } from "@/components/back-to-top";

export const metadata: Metadata = {
  title: "사업자 정보 · 토리로",
  description:
    "토리로의 사업자 등록 정보, 통신판매업 신고, 고객센터, 개인정보보호책임자 연락처를 안내합니다.",
};

interface Row {
  label: string;
  value: string;
  placeholder?: boolean;
}

const BUSINESS_INFO: Row[] = [
  { label: "상호", value: "토리로 (TORIRO)" },
  { label: "대표자", value: "[대표자명]", placeholder: true },
  { label: "사업자등록번호", value: "[000-00-00000]", placeholder: true },
  {
    label: "통신판매업신고번호",
    value: "[제2026-서울-0000호]",
    placeholder: true,
  },
  {
    label: "사업장 주소",
    value: "[서울특별시 ○○구 ○○로 00, 00층]",
    placeholder: true,
  },
  { label: "고객센터", value: "1588-0000 (평일 10:00 ~ 17:00, 공휴일 휴무)" },
  { label: "이메일", value: "hello@toriro.com" },
  {
    label: "개인정보보호책임자",
    value: "[홍길동] (privacy@toriro.com)",
    placeholder: true,
  },
  { label: "호스팅 제공자", value: "Vercel Inc. / Amazon Web Services" },
];

export default function BusinessPage() {
  return (
    <div className="min-h-dvh bg-[#FFF8F0] text-[#2C2C2C]">
      <header className="border-b border-[#D4E4BC] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-[#2D5A3D]"
          >
            <span className="text-xl" aria-hidden>
              🌰
            </span>
            <span>토리로</span>
          </Link>
          <Link
            href="/"
            className="text-xs font-semibold text-[#2D5A3D] hover:underline"
          >
            ← 홈으로
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <p className="text-xs font-semibold tracking-[0.3em] text-[#8B6F47]">
          BUSINESS INFORMATION
        </p>
        <h1 className="mt-2 font-serif text-3xl font-extrabold text-[#2D5A3D] md:text-4xl">
          사업자 정보
        </h1>
        <p className="mt-3 text-sm text-[#6B6560]">
          전자상거래법 제10조 및 공정거래위원회 고시에 따른 사업자 정보
          공개입니다.
        </p>

        <div
          role="alert"
          className="mt-6 rounded-2xl border-2 border-dashed border-[#C4956A] bg-[#FFF4E5] p-4 text-sm text-[#8B6F47]"
        >
          ⚠️ 실제 서비스 운영 전에 사업자 정보를 실제 값으로 교체해주세요.
          아래 [대괄호] 표기 항목은 모두 플레이스홀더입니다.
        </div>

        <div className="mt-8 overflow-hidden rounded-3xl border border-[#D4E4BC] bg-white shadow-sm">
          <dl className="divide-y divide-[#E8F0E4]">
            {BUSINESS_INFO.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-1 gap-1 p-5 md:grid-cols-[220px_1fr] md:gap-4"
              >
                <dt className="text-sm font-bold text-[#2D5A3D]">
                  {row.label}
                </dt>
                <dd
                  className={`text-[15px] leading-relaxed ${
                    row.placeholder ? "text-[#C4956A]" : "text-[#2C2C2C]"
                  }`}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <section className="mt-8 rounded-3xl border border-[#D4E4BC] bg-white p-6 shadow-sm md:p-8">
          <h2 className="font-serif text-lg font-extrabold text-[#2D5A3D] md:text-xl">
            사업자정보 공개시스템
          </h2>
          <p className="mt-2 text-sm text-[#6B6560]">
            공정거래위원회 사업자정보 공개시스템에서 통신판매업 신고 내역을
            확인하실 수 있습니다.
          </p>
          <a
            href="https://www.ftc.go.kr/bizCommPop.do?wrkr_no=0000000000"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1F4229] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/40"
          >
            공정거래위원회에서 조회하기
            <span aria-hidden>↗</span>
          </a>
          <p className="mt-2 text-xs text-[#C4956A]">
            ⚠️ URL의 wrkr_no 값을 실제 사업자등록번호로 교체해주세요.
          </p>
        </section>

        <section className="mt-8 rounded-3xl border border-[#D4E4BC] bg-[#E8F0E4]/60 p-6 text-sm leading-relaxed text-[#2D5A3D] md:p-8">
          <h2 className="font-serif text-lg font-extrabold">관련 문서</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/terms" className="underline hover:no-underline">
                이용약관
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="underline hover:no-underline">
                개인정보처리방침
              </Link>
            </li>
            <li>
              <a
                href="mailto:privacy@toriro.com"
                className="underline hover:no-underline"
              >
                개인정보 관련 문의 (privacy@toriro.com)
              </a>
            </li>
          </ul>
        </section>
      </main>

      <SiteFooter />
      <BackToTop />
    </div>
  );
}
