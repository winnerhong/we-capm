"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import {
  CATEGORIES,
  CATEGORY_COLORS,
  MISSION_TEMPLATES,
  TEMPLATE_TYPE_LABEL,
  type MissionTemplate,
  type MissionTemplateCategory,
} from "@/lib/mission-templates";

type FilterValue = MissionTemplateCategory | "ALL" | "POPULAR";

export default function MissionTemplatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = use(params);
  const [filter, setFilter] = useState<FilterValue>("ALL");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MISSION_TEMPLATES.filter((t) => {
      if (filter === "POPULAR" && !t.popular) return false;
      if (filter !== "ALL" && filter !== "POPULAR" && t.category !== filter) return false;
      if (!q) return true;
      const haystack = [t.title, t.description, t.instruction, ...t.tags]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [filter, query]);

  const chips: { value: FilterValue; label: string; icon?: string }[] = [
    { value: "ALL", label: "전체" },
    { value: "POPULAR", label: "인기", icon: "🔥" },
    ...CATEGORIES.map((c) => ({
      value: c.id as FilterValue,
      label: c.label,
      icon: c.icon,
    })),
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <Link
          href={`/admin/events/${eventId}/missions`}
          className="text-sm text-neutral-500 hover:underline"
        >
          ← 숲길 목록
        </Link>
        <h1 className="text-2xl font-bold">🎨 숲길 템플릿</h1>
        <p className="text-sm text-neutral-500">빠르게 시작하거나 영감을 얻어보세요</p>
      </div>

      {/* Search bar */}
      <div>
        <label htmlFor="template-search" className="sr-only">
          템플릿 검색
        </label>
        <input
          id="template-search"
          type="search"
          inputMode="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 검색 (예: 가족, 도토리, 퀴즈)"
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {/* Category chips */}
      <div
        className="-mx-1 flex flex-wrap gap-2 overflow-x-auto px-1 pb-1"
        role="tablist"
        aria-label="카테고리 필터"
      >
        {chips.map((chip) => {
          const active = filter === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(chip.value)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${
                active
                  ? "border-violet-600 bg-violet-600 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-violet-300 hover:text-violet-700"
              }`}
            >
              {chip.icon && <span className="mr-1">{chip.icon}</span>}
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Results count */}
      <div className="text-xs text-neutral-500">
        {filtered.length}개의 템플릿{query && ` · "${query}" 검색`}
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TemplateCard key={t.id} template={t} eventId={eventId} />
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border bg-white p-12 text-center text-neutral-500">
          일치하는 템플릿이 없어요.
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("ALL");
            }}
            className="ml-2 text-violet-600 hover:underline"
          >
            필터 초기화
          </button>
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  eventId,
}: {
  template: MissionTemplate;
  eventId: string;
}) {
  const colors = CATEGORY_COLORS[template.category];
  const categoryLabel =
    CATEGORIES.find((c) => c.id === template.category)?.label ?? template.category;

  return (
    <li
      className={`group flex flex-col overflow-hidden rounded-xl border border-neutral-200 border-t-4 bg-white transition hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 ${colors.accent} ${colors.ring}`}
    >
      <div className="flex-1 space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="text-3xl" aria-hidden="true">
            {template.icon}
          </div>
          {template.popular && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              🔥 인기
            </span>
          )}
        </div>

        <h3 className="text-base font-bold text-neutral-900">{template.title}</h3>
        <p className="text-sm text-neutral-600">{template.description}</p>
        <p className="hidden text-xs text-neutral-500 group-hover:block">
          💡 {template.instruction}
        </p>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors.badge}`}>
            {categoryLabel}
          </span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
            {TEMPLATE_TYPE_LABEL[template.template_type]}
          </span>
          <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs text-yellow-700">
            🌰 {template.points}
          </span>
          {template.auto_approve && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
              자동승인
            </span>
          )}
        </div>
      </div>

      <Link
        href={`/admin/events/${eventId}/missions/new?template=${template.id}`}
        className="block w-full bg-violet-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
      >
        이 템플릿으로 만들기 →
      </Link>
    </li>
  );
}
