import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { BackToTop } from "@/components/back-to-top";
import { AcornIcon } from "@/components/acorn-icon";
import {
  BUSINESS,
  PRIVACY_OFFICER_LINE,
  SUPPORT_LINE,
} from "@/lib/business-info";

export const metadata: Metadata = {
  title: "사업자 정보 · 토리로",
  description:
    "토리로를 운영하는 (주)위너그룹의 사업자 등록 정보, 고객센터, 개인정보보호책임자 연락처를 안내합니다.",
};

interface Row {
  label: string;
  value: string;
}

// 값은 lib/business-info 한 곳에서 온다 — 푸터와 어긋나지 않게.
const BUSINESS_INFO: Row[] = [
  { label: "서비스명", value: BUSINESS.serviceName },
  { label: "상호", value: BUSINESS.companyName },
  { label: "대표자", value: BUSINESS.representative },
  { label: "사업자등록번호", value: BUSINESS.registrationNumber },
  { label: "사업장 주소", value: BUSINESS.address },
  { label: "고객센터", value: SUPPORT_LINE },
  { label: "이메일", value: BUSINESS.email },
  { label: "개인정보보호책임자", value: PRIVACY_OFFICER_LINE },
  { label: "호스팅 제공자", value: BUSINESS.hosting },
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
            <AcornIcon size={20} />
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
                <dd className="text-[15px] leading-relaxed text-[#2C2C2C]">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

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
