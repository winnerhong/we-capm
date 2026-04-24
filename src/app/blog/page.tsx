import type { Metadata } from "next";
import Link from "next/link";
import { ARTICLES } from "./articles";
import { BlogList } from "./blog-list";
import { SiteFooter } from "@/components/site-footer";
import { AcornIcon } from "@/components/acorn-icon";

export const metadata: Metadata = {
  title: "토리로 이야기 · 블로그",
  description:
    "숲에서 만난 소중한 순간들. 토리로의 운영 노하우, 교육 팁, 참가자 후기, 공지사항을 만나보세요.",
};

export default function BlogIndexPage() {
  const sorted = [...ARTICLES].sort((a, b) => (a.date < b.date ? 1 : -1));

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
              className="rounded-full bg-[#E8F0E4] px-3 py-1.5 text-[#2D5A3D]"
            >
              블로그
            </Link>
            <Link
              href="/faq"
              className="rounded-full px-3 py-1.5 text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              FAQ
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1F3D2B] via-[#2D5A3D] to-[#4A7C59] text-white">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center md:py-20">
          <p className="text-xs font-semibold tracking-[0.4em] text-[#D4E4BC]">
            TORIRO STORIES
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight md:text-5xl">
            <span aria-hidden>🌲 </span>
            토리로 이야기
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[#E8F0E4] md:text-base">
            숲에서 만난 소중한 순간들을 기록합니다.
          </p>
        </div>
      </section>

      {/* Main */}
      <main className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <BlogList articles={sorted} />
      </main>

      <SiteFooter />
    </div>
  );
}
