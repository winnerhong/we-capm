import type { Metadata } from "next";
import Link from "next/link";
import { FAQ_ITEMS } from "./faq-data";
import { FaqClient } from "./faq-client";
import { SiteFooter } from "@/components/site-footer";
import { BackToTop } from "@/components/back-to-top";
import { AcornIcon } from "@/components/acorn-icon";

export const metadata: Metadata = {
  title: "자주 묻는 질문 · 토리로",
  description:
    "토리로 이용에 관한 자주 묻는 질문을 카테고리별로 정리했습니다. 가족, 기관, 숲지기, 기업 담당자를 위한 답변을 모두 모았어요.",
};

export default function FaqPage() {
  return (
    <div className="min-h-dvh bg-[#FFF8F0] text-[#2C2C2C]">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-[#D4E4BC] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-[#2D5A3D]"
          >
            <AcornIcon size={20} />
            <span>토리로</span>
          </Link>
          <nav className="flex items-center gap-1 text-xs font-semibold">
            <Link
              href="/events"
              className="rounded-full px-3 py-1.5 text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              숲길 찾기
            </Link>
            <Link
              href="/blog"
              className="rounded-full px-3 py-1.5 text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              블로그
            </Link>
            <Link
              href="/faq"
              className="rounded-full bg-[#E8F0E4] px-3 py-1.5 text-[#2D5A3D]"
            >
              FAQ
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#2D5A3D] via-[#4A7C59] to-[#8FB98A] text-white">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center md:py-20">
          <p className="text-xs font-semibold tracking-[0.4em] text-[#D4E4BC]">
            HELP CENTER
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight md:text-5xl">
            <span aria-hidden>💬 </span>
            자주 묻는 질문
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[#E8F0E4] md:text-base">
            가장 많이 들어오는 질문들을 한 곳에 모았어요.
            <br className="hidden sm:inline" />
            원하시는 답이 없다면 hello@toriro.kr로 보내주세요.
          </p>
        </div>
      </section>

      {/* Main */}
      <main className="mx-auto max-w-4xl px-4 py-10 md:py-14">
        <FaqClient items={FAQ_ITEMS} />

        {/* Still need help */}
        <div className="mt-14 rounded-3xl border border-[#D4E4BC] bg-white p-8 text-center shadow-sm md:p-10">
          <p className="text-[#2D5A3D]">
            <AcornIcon size={36} />
          </p>
          <h2 className="mt-3 text-xl font-extrabold text-[#2D5A3D] md:text-2xl">
            원하시는 답을 찾지 못하셨나요?
          </h2>
          <p className="mt-2 text-sm text-[#6B6560]">
            토리로 팀이 영업일 기준 1일 내에 직접 답변드립니다.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a
              href="mailto:hello@toriro.kr"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#2D5A3D] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#234a30]"
            >
              <span aria-hidden>✉️</span> 이메일 문의
            </a>
            <a
              href="tel:1544-0000"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#2D5A3D] bg-white px-5 py-2.5 text-sm font-bold text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              <span aria-hidden>📞</span> 1544-0000
            </a>
          </div>
        </div>
      </main>

      <SiteFooter />
      <BackToTop />
    </div>
  );
}
