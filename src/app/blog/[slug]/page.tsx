import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ARTICLES,
  getArticleBySlug,
  getRelatedArticles,
} from "../articles";
import { SiteFooter } from "@/components/site-footer";

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return { title: "글을 찾을 수 없어요" };
  return {
    title: `${article.title} · 토리로 이야기`,
    description: article.excerpt,
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const related = getRelatedArticles(slug, 3);
  const dateLabel = new Date(article.date).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-dvh bg-[#FFF8F0] text-[#2C2C2C]">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-[#D4E4BC] bg-white/90 backdrop-blur">
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
          <nav className="flex items-center gap-1 text-xs font-semibold">
            <Link
              href="/blog"
              className="rounded-full px-3 py-1.5 text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              ← 블로그
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section
        className={
          "bg-gradient-to-br text-white " + article.coverGradient
        }
      >
        <div className="mx-auto max-w-3xl px-4 py-14 text-center md:py-20">
          <span className="inline-block rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-[#2D5A3D] shadow-sm">
            {article.category}
          </span>
          <h1 className="mt-4 text-2xl font-extrabold leading-tight drop-shadow-md md:text-4xl">
            {article.title}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/90 md:text-base">
            {article.excerpt}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3 text-xs text-white/90">
            <span className="flex items-center gap-1.5">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-sm"
                aria-hidden
              >
                {article.authorEmoji}
              </span>
              <span className="font-semibold">{article.author}</span>
            </span>
            <span aria-hidden>·</span>
            <span>{dateLabel}</span>
            <span aria-hidden>·</span>
            <span>{article.readMinutes}분 읽기</span>
          </div>
        </div>
      </section>

      {/* Body */}
      <main className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <article className="space-y-8">
          {article.paragraphs.map((p, idx) => (
            <section key={idx}>
              {p.heading ? (
                <h2 className="text-lg font-extrabold text-[#2D5A3D] md:text-xl">
                  {p.heading}
                </h2>
              ) : null}
              <p className="mt-3 text-[15px] leading-[1.9] text-[#2C2C2C] md:text-base">
                {p.body}
              </p>
            </section>
          ))}
        </article>

        {/* Share */}
        <div className="mt-12 rounded-2xl border border-[#D4E4BC] bg-white p-5">
          <h2 className="text-sm font-bold text-[#2D5A3D]">
            이 글이 도움이 되었다면 공유해 주세요
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="#"
              className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
              aria-label="카카오톡으로 공유"
            >
              <span aria-hidden>💬</span> 카카오톡
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
              aria-label="페이스북으로 공유"
            >
              <span aria-hidden>📘</span> 페이스북
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
              aria-label="URL 복사"
            >
              <span aria-hidden>🔗</span> URL 복사
            </a>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-lg font-extrabold text-[#2D5A3D] md:text-xl">
              이 글과 함께 읽으면 좋아요
            </h2>
            <ul className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              {related.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/blog/${a.slug}`}
                    className="group block h-full overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div
                      className={
                        "flex aspect-[16/10] items-center justify-center bg-gradient-to-br " +
                        a.coverGradient
                      }
                      aria-hidden
                    >
                      <span className="text-4xl">{a.coverEmoji}</span>
                    </div>
                    <div className="p-4">
                      <p className="text-[10px] font-bold tracking-wider text-[#8B6F47]">
                        {a.category}
                      </p>
                      <h3 className="mt-1 text-sm font-extrabold text-[#2C2C2C] group-hover:text-[#2D5A3D]">
                        {a.title}
                      </h3>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-12 text-center">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#2D5A3D] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#234a30]"
          >
            ← 블로그 홈으로
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
