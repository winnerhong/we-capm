"use client";

import { useMemo, useState } from "react";
import type { FaqCategory, FaqItem } from "./faq-data";
import { FAQ_CATEGORIES } from "./faq-data";

type TabValue = "전체" | FaqCategory;

const TABS: TabValue[] = ["전체", ...FAQ_CATEGORIES];

function highlight(text: string, query: string) {
  if (!query) return text;
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return text;
  const parts = text.split(new RegExp(`(${escapeRegex(normalizedQuery)})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === normalizedQuery.toLowerCase() ? (
          <mark key={i} className="rounded bg-[#FFF6D9] px-0.5 text-[#2D5A3D]">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function FaqClient({ items }: { items: FaqItem[] }) {
  const [tab, setTab] = useState<TabValue>("전체");
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (tab !== "전체" && item.category !== tab) return false;
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [items, tab, query]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<FaqCategory, FaqItem[]>();
    for (const item of filtered) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return FAQ_CATEGORIES.filter((c) => map.has(c)).map((c) => ({
      category: c,
      items: map.get(c)!,
    }));
  }, [filtered]);

  return (
    <div>
      {/* Search */}
      <div className="relative">
        <label htmlFor="faq-search" className="sr-only">
          질문 검색
        </label>
        <input
          id="faq-search"
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="궁금한 내용을 검색해 보세요 (예: 환불, 도토리, 수수료)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-2xl border border-[#D4E4BC] bg-white py-3.5 pl-11 pr-4 text-sm text-[#2C2C2C] shadow-sm placeholder:text-[#A09A94] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
        />
        <span
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8B6F47]"
          aria-hidden
        >
          🔍
        </span>
      </div>

      {/* Tabs */}
      <nav
        aria-label="카테고리"
        className="mt-5 flex flex-wrap gap-2 border-b border-[#D4E4BC] pb-4"
      >
        {TABS.map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={active}
              className={
                "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#2D5A3D] focus:ring-offset-2 " +
                (active
                  ? "bg-[#2D5A3D] text-white shadow-sm"
                  : "border border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#E8F0E4]")
              }
            >
              {t}
            </button>
          );
        })}
      </nav>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <p className="text-4xl" aria-hidden>
            🤔
          </p>
          <p className="mt-3 text-sm text-[#6B6560]">
            검색하신 내용과 일치하는 질문이 없어요.
          </p>
          <p className="mt-1 text-xs text-[#8B6F47]">
            다른 키워드로 검색해 보시거나, hello@toriro.kr로 문의해 주세요.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {grouped.map(({ category, items: list }) => (
            <section key={category}>
              <h2 className="text-base font-extrabold text-[#2D5A3D] md:text-lg">
                <span aria-hidden className="mr-1">
                  {iconFor(category)}
                </span>
                {category}
                <span className="ml-2 text-xs font-semibold text-[#8B6F47]">
                  {list.length}개
                </span>
              </h2>
              <ul className="mt-3 divide-y divide-[#E8F0E4] overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm">
                {list.map((item) => {
                  const key = `${item.category}-${item.question}`;
                  const open = openKey === key;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => setOpenKey(open ? null : key)}
                        aria-expanded={open}
                        className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-[#FFF8F0] focus:bg-[#FFF8F0] focus:outline-none"
                      >
                        <span className="flex-1">
                          <span className="mr-2 inline-block rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-bold text-[#2D5A3D]">
                            Q
                          </span>
                          <span className="text-sm font-semibold text-[#2C2C2C] md:text-[15px]">
                            {highlight(item.question, query)}
                          </span>
                        </span>
                        <span
                          className={
                            "mt-1 shrink-0 text-xs text-[#8B6F47] transition-transform " +
                            (open ? "rotate-180" : "")
                          }
                          aria-hidden
                        >
                          ▼
                        </span>
                      </button>
                      {open ? (
                        <div className="border-t border-[#E8F0E4] bg-[#FFF8F0]/60 px-5 py-4">
                          <p className="text-[14px] leading-[1.85] text-[#2C2C2C]">
                            <span className="mr-2 inline-block rounded-full bg-[#FFE7CC] px-2 py-0.5 text-[10px] font-bold text-[#8B6F47]">
                              A
                            </span>
                            {highlight(item.answer, query)}
                          </p>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function iconFor(category: FaqCategory): string {
  switch (category) {
    case "가족/참가자":
      return "👨‍👩‍👧";
    case "기관/선생님":
      return "🏫";
    case "업체/숲지기":
      return "🏡";
    case "기업":
      return "🏢";
    case "일반":
      return "💡";
  }
}
