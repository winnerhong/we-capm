"use client";

// 도토리 잔액 TOP N 가족 리더보드 — 참가자 홈/스탬프북/라디오 상단 공용.
// 접기/펼치기 가능. 상태는 localStorage 에 저장돼 페이지 이동해도 유지.

import { useEffect, useState } from "react";
import { AcornIcon } from "@/components/acorn-icon";
import type { TopAcornFamily } from "@/lib/app-user/queries";
import type { AcornGuideItem } from "@/lib/missions/acorn-guide-core";

interface Props {
  families: TopAcornFamily[];
  myUserId: string;
  orgName: string;
  /**
   * "도토리 모으는 법" — 이 행사 설정에서 뽑아온 목록(loadAcornGuide).
   * 비어 있으면 줄 자체가 나타나지 않는다.
   */
  guide?: AcornGuideItem[];
}

const STORAGE_KEY = "acorn-top-board:collapsed";
const GUIDE_STORAGE_KEY = "acorn-top-board:guide-open";

export function AcornTopBoard({
  families,
  myUserId,
  orgName,
  guide = [],
}: Props) {
  // 초기에는 SSR 과 동일하게 펼침 상태. 마운트 후 localStorage 에서 복원.
  const [collapsed, setCollapsed] = useState(false);
  // 안내는 곁들이는 정보라 기본은 접힘 — 한 번 펴면 그 상태를 기억한다.
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") setCollapsed(true);
      if (localStorage.getItem(GUIDE_STORAGE_KEY) === "1") setGuideOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  function toggleGuide() {
    setGuideOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(GUIDE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

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

  // 순위가 없어도 안내는 쓸모가 있다 — 행사 첫날 아침이 정확히 그 상황이다.
  if (families.length === 0 && guide.length === 0) return null;

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
                {/* 등수를 가르는 것은 점수(도토리×100 + 속도 − 반려)이고,
                    도토리는 지갑이다. 둘이 다른 값이라 둘 다 보여준다 —
                    점수만 보이면 "내 도토리는 5개인데 450은 뭐지"가 되고,
                    도토리만 보이면 5개끼리 순위가 갈린 이유를 알 수 없다. */}
                <span className="flex shrink-0 flex-col items-end leading-tight">
                  {typeof f.score === "number" && (
                    <span className="text-sm font-bold tabular-nums text-[#6B4423]">
                      {f.score.toLocaleString("ko-KR")}
                      <span className="ml-0.5 text-[10px] font-semibold">점</span>
                    </span>
                  )}
                  <span
                    className={
                      typeof f.score === "number"
                        ? "flex items-center gap-1 text-[10px] font-semibold tabular-nums text-[#8B6F47]"
                        : "flex items-center gap-1 text-sm font-bold tabular-nums text-[#6B4423]"
                    }
                  >
                    <AcornIcon size={typeof f.score === "number" ? 10 : 14} />
                    {f.acorns}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* 도토리 모으는 법 — 순위만 보여주면 "어떻게 저만큼 모았지" 로 끝난다.
          목록은 이 행사에 실제로 켜져 있는 미션·스위치에서 만들어진다. */}
      {guide.length > 0 && (
        <div className="mt-2 border-t border-[#E5D3B8]/70 pt-2">
          <button
            type="button"
            onClick={toggleGuide}
            aria-expanded={guideOpen}
            aria-controls="acorn-guide-list"
            className="flex w-full items-center justify-between gap-2 rounded-xl px-1 py-1 text-left transition hover:bg-white/50"
          >
            <span className="flex items-center gap-1.5 text-[12px] font-bold text-[#6B4423]">
              <AcornIcon size={14} />
              도토리 모으는 법
            </span>
            <span
              aria-hidden
              className={`text-[11px] font-bold text-[#8B6F47] transition-transform ${
                guideOpen ? "rotate-180" : ""
              }`}
            >
              ▾
            </span>
          </button>

          {guideOpen && (
            <ul id="acorn-guide-list" className="mt-1.5 space-y-1">
              {guide.map((g, i) => (
                <li
                  key={`${g.label}-${i}`}
                  className="flex items-center gap-2 rounded-xl bg-white/60 px-3 py-1.5"
                >
                  <span aria-hidden className="text-sm">
                    {g.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#2D5A3D]">
                    {g.label}
                  </span>
                  <span className="shrink-0 text-[11px] font-bold tabular-nums text-[#6B4423]">
                    {g.detail}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
