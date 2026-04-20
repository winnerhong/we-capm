"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Article, ArticleCategory } from "./articles";
import { ARTICLE_CATEGORIES } from "./articles";

type FilterValue = "전체" | ArticleCategory;

const FILTERS: FilterValue[] = ["전체", ...ARTICLE_CATEGORIES];

export function BlogList({ articles }: { articles: Article[] }) {
  const [filter, setFilter] = useState<FilterValue>("전체");

  const filtered = useMemo(() => {
    if (filter === "전체") return articles;
    return articles.filter((a) => a.category === filter);
  }, [filter, articles]);

  return (
    <div>
      {/* Filter tabs */}
      <nav
        aria-label="카테고리"
        className="flex flex-wrap gap-2 border-b border-[#D4E4BC] pb-4"
      >
        {FILTERS.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={active}
              className={
                "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#2D5A3D] focus:ring-offset-2 " +
                (active
                  ? "bg-[#2D5A3D] text-white shadow-sm"
                  : "border border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#E8F0E4]")
              }
            >
              {f}
            </button>
          );
        })}
      </nav>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="mt-12 text-center text-sm text-[#8B6F47]">
          해당 카테고리의 글이 아직 없어요.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {filtered.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/blog/${a.slug}`}
                className="group block h-full overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#2D5A3D] focus:ring-offset-2"
              >
                {/* Thumbnail */}
                <div
                  className={
                    "relative flex aspect-[16/9] items-center justify-center bg-gradient-to-br " +
                    a.coverGradient
                  }
                  aria-hidden
                >
                  <span className="text-6xl drop-shadow-md">
                    {a.coverEmoji}
                  </span>
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-[#2D5A3D] shadow-sm">
                    {a.category}
                  </span>
                </div>

                <div className="p-5">
                  <h3 className="text-base font-extrabold leading-snug text-[#2C2C2C] group-hover:text-[#2D5A3D] md:text-lg">
                    {a.title}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[#6B6560]">
                    {a.excerpt}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-[11px] text-[#8B6F47]">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E8F0E4] text-xs"
                        aria-hidden
                      >
                        {a.authorEmoji}
                      </span>
                      <span className="font-semibold">{a.author}</span>
                    </span>
                    <span>
                      {new Date(a.date).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}{" "}
                      · {a.readMinutes}분
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
