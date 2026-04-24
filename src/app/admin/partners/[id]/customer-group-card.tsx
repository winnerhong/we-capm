"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type CustomerItem = {
  id: string;
  name: string;
  sub: string | null;
  status: string | null;
  impersonateHref: string | null;
  disabledReason?: string;
};

type Props = {
  title: string;
  total: number;
  emptyMsg: string;
  /** 최신순으로 로드된 고객 리스트 (최대 LIST_LIMIT) */
  items: CustomerItem[];
};

const INLINE_VISIBLE = 5;

export function CustomerGroupCard({ title, total, emptyMsg, items }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");

  const visible = items.slice(0, INLINE_VISIBLE);
  const hasMore = total > INLINE_VISIBLE;

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return items;
    return items.filter(
      (c) => c.name.includes(q) || (c.sub ?? "").includes(q)
    );
  }, [query, items]);

  // ESC 닫기
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    },
    []
  );
  useEffect(() => {
    if (!modalOpen) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, onKeyDown]);

  return (
    <article className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#2D5A3D]">{title}</h3>
        <span className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[11px] font-bold text-[#2D5A3D] tabular-nums">
          {total}명
        </span>
      </header>

      {total === 0 ? (
        <p className="mt-3 text-center text-xs text-[#8B7F75]">{emptyMsg}</p>
      ) : (
        <>
          <ul className="mt-3 space-y-1.5">
            {visible.map((c) => (
              <CustomerRow key={c.id} item={c} />
            ))}
          </ul>
          {hasMore && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-3 block w-full rounded-xl border border-[#D4E4BC] bg-[#F5F1E8] px-3 py-2 text-xs font-bold text-[#2D5A3D] hover:bg-[#E8F0E4] active:scale-[0.99]"
            >
              더보기 (전체 {total}명) →
            </button>
          )}
          {!hasMore && total > visible.length && (
            <p className="mt-2 text-right text-[10px] text-[#8B7F75]">
              {visible.length}/{total}
            </p>
          )}
        </>
      )}

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} 전체 목록`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-[#D4E4BC] bg-white shadow-2xl">
            {/* 헤더 */}
            <header className="flex items-center justify-between border-b border-[#D4E4BC] bg-[#F5F1E8] px-5 py-3">
              <div>
                <h2 className="text-base font-bold text-[#2D5A3D]">
                  {title}
                </h2>
                <p className="text-[11px] text-[#6B6560]">
                  로드된 {items.length}명 · 전체 {total}명
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full px-2.5 py-1 text-sm font-bold text-[#6B6560] hover:bg-white"
                aria-label="닫기"
              >
                ✕
              </button>
            </header>

            {/* 검색 */}
            <div className="border-b border-[#F5F1E8] p-3">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름 또는 연락처로 검색"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2D5A3D] outline-none focus:border-[#3A7A52] focus:ring-2 focus:ring-[#3A7A52]/20"
              />
            </div>

            {/* 리스트 */}
            <div className="flex-1 overflow-y-auto p-3">
              {filtered.length === 0 ? (
                <p className="py-10 text-center text-sm text-[#8B7F75]">
                  일치하는 고객이 없어요
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {filtered.map((c) => (
                    <CustomerRow key={c.id} item={c} />
                  ))}
                </ul>
              )}
            </div>

            {total > items.length && (
              <footer className="border-t border-[#F5F1E8] bg-[#FFF8F0] px-4 py-2.5 text-[10px] text-[#8B7F75]">
                ℹ️ 최근 {items.length}명만 로드됨 · 더 오래된 고객은
                &lsquo;고객 관리&rsquo; 페이지에서 조회하세요
              </footer>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function CustomerRow({ item }: { item: CustomerItem }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-xl border border-[#F5F1E8] bg-[#FFF8F0] px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-bold text-[#2D5A3D]">
            {item.name}
          </span>
          {item.status && (
            <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-semibold text-[#6B6560]">
              {item.status}
            </span>
          )}
        </div>
        {item.sub && (
          <p className="mt-0.5 truncate font-mono text-[10px] text-[#8B7F75]">
            {item.sub}
          </p>
        )}
      </div>
      {item.impersonateHref ? (
        <a
          href={item.impersonateHref}
          target="_blank"
          rel="noopener"
          className="shrink-0 rounded-lg border border-violet-300 bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-800 hover:bg-violet-100"
        >
          🔑 로그인↗
        </a>
      ) : (
        <span
          className="shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] font-semibold text-zinc-500"
          title={item.disabledReason}
        >
          {item.disabledReason ?? "—"}
        </span>
      )}
    </li>
  );
}
