"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

interface Props {
  regions: string[];
  seasons: string[];
}

export function GalleryFilters({ regions, seasons }: Props) {
  const params = useSearchParams();
  const initialRegion = params.get("region") ?? "all";
  const initialSeason = params.get("season") ?? "all";

  const [region, setRegion] = useState<string>(initialRegion);
  const [season, setSeason] = useState<string>(initialSeason);

  // 클라이언트 사이드 필터 (data-속성 기반)
  useEffect(() => {
    const grid = document.querySelector<HTMLElement>("[data-gallery-grid]");
    if (!grid) return;

    const items = grid.querySelectorAll<HTMLElement>("li[data-region]");
    let visible = 0;
    items.forEach((el) => {
      const r = el.dataset.region ?? "";
      const s = el.dataset.season ?? "";
      const matchR = region === "all" || r === region;
      const matchS = season === "all" || s === season;
      const show = matchR && matchS;
      el.style.display = show ? "" : "none";
      if (show) visible++;
    });

    // 빈 상태 표시
    const emptyId = "gallery-filter-empty";
    let empty = document.getElementById(emptyId);
    if (visible === 0 && items.length > 0) {
      if (!empty) {
        empty = document.createElement("div");
        empty.id = emptyId;
        empty.className =
          "col-span-full rounded-2xl border border-[#D4E4BC] bg-white p-8 text-center text-xs text-[#6B6560]";
        empty.textContent = "조건에 맞는 숲길이 없어요";
        grid.appendChild(empty);
      }
    } else if (empty) {
      empty.remove();
    }

    // URL 동기화 (히스토리 스택 쌓지 않고 replace)
    const next = new URLSearchParams();
    if (region !== "all") next.set("region", region);
    if (season !== "all") next.set("season", season);
    const qs = next.toString();
    const url = qs ? `?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [region, season]);

  const regionOptions = useMemo(() => ["all", ...regions], [regions]);
  const seasonOptions = useMemo(() => ["all", ...seasons], [seasons]);

  return (
    <section
      aria-label="갤러리 필터"
      className="sticky top-[53px] z-10 border-b border-[#D4E4BC] bg-[#FFF8F0]/95 backdrop-blur"
    >
      <div className="mx-auto max-w-5xl space-y-2 px-4 py-3">
        {/* 지역 */}
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="지역 필터"
        >
          <span className="shrink-0 self-center text-[11px] font-bold text-[#8B6F47]">
            지역
          </span>
          {regionOptions.map((r) => {
            const active = region === r;
            return (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRegion(r)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-[#2D5A3D] text-white"
                    : "border border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#E8F0E4]"
                }`}
              >
                {r === "all" ? "전체" : r}
              </button>
            );
          })}
        </div>

        {/* 시즌 */}
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="시즌 필터"
        >
          <span className="shrink-0 self-center text-[11px] font-bold text-[#8B6F47]">
            시즌
          </span>
          {seasonOptions.map((s) => {
            const active = season === s;
            const emoji =
              s === "봄"
                ? "🌸"
                : s === "여름"
                ? "🌿"
                : s === "가을"
                ? "🍂"
                : s === "겨울"
                ? "❄️"
                : "";
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSeason(s)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-[#2D5A3D] text-white"
                    : "border border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#E8F0E4]"
                }`}
              >
                {s === "all" ? "전체" : `${emoji} ${s}`}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
