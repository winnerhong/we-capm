"use client";

// 도토리 잔액 TOP N 가족 리더보드 — 참가자 홈/스탬프북/라디오 상단 공용.
// 접기/펼치기 가능. 상태는 localStorage 에 저장돼 페이지 이동해도 유지.

import { useEffect, useState } from "react";
import { AcornIcon } from "@/components/acorn-icon";
import type { TopAcornFamily } from "@/lib/app-user/queries";

interface Props {
  families: TopAcornFamily[];
  myUserId: string;
  orgName: string;
}

const STORAGE_KEY = "acorn-top-board:collapsed";

export function AcornTopBoard({ families, myUserId, orgName }: Props) {
  // 초기에는 SSR 과 동일하게 펼침 상태. 마운트 후 localStorage 에서 복원.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (families.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-[#E5D3B8] bg-gradient-to-br from-[#FFFDF8] to-[#FFF6E5] p-4 shadow-sm">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-controls="acorn-top-board-list"
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <h2 className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-[#6B4423]">
          <span aria-hidden>🏆</span>
          <span className="truncate">{orgName} TOP 5</span>
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[10px] font-semibold text-[#8B6F47]">
            실시간 기준
          </span>
          <span
            aria-hidden
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/70 text-[11px] font-bold text-[#6B4423] transition-transform ${
              collapsed ? "" : "rotate-180"
            }`}
            title={collapsed ? "펼치기" : "접기"}
          >
            ▾
          </span>
        </div>
      </button>

      {!collapsed && (
        <ol
          id="acorn-top-board-list"
          className="mt-2 space-y-1.5"
        >
          {families.map((f) => {
            const isMe = f.userId === myUserId;
            const medal =
              f.rank === 1 ? "🥇" : f.rank === 2 ? "🥈" : f.rank === 3 ? "🥉" : null;
            return (
              <li
                key={f.userId}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                  isMe
                    ? "bg-gradient-to-r from-[#FFE9B3] to-[#FFD98A] ring-1 ring-[#E5B86A]"
                    : "bg-white/70"
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    medal
                      ? "bg-transparent text-base"
                      : "bg-[#E5D3B8] text-[#6B4423]"
                  }`}
                  aria-label={`${f.rank}위`}
                >
                  {medal ?? f.rank}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-[12px] ${
                    isMe ? "font-bold text-[#6B4423]" : "font-semibold text-[#2D5A3D]"
                  }`}
                >
                  {f.className && (
                    <span className="mr-1 text-[10px] font-bold text-[#8B6F47]">
                      {f.className}
                    </span>
                  )}
                  {f.familyLabel}
                  {isMe && (
                    <span className="ml-1 text-[10px] text-[#8B6F47]">(나)</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums text-[#6B4423]">
                  <AcornIcon size={14} />
                  {f.acorns}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
