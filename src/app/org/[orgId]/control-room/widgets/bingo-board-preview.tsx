"use client";

// 🔍 가족 행에 마우스 올리면(또는 탭하면) 그 가족의 현재 빙고판을 팝오버로 미리보기.

import { useState } from "react";
import { phraseSizeStyle } from "@/lib/bingo/tile-style";

export type PreviewCell = {
  position: number;
  photo_url: string;
  keyword: string;
  called: boolean;
  is_org: boolean;
};

function short(text: string): string {
  return (text ?? "").trim().slice(0, 6);
}

export function BingoBoardPreview({
  size,
  name,
  cells,
  children,
}: {
  size: number;
  name: string;
  cells: PreviewCell[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const byPos = new Map<number, PreviewCell>();
  for (const c of cells) byPos.set(c.position, c);
  const checked = cells.filter((c) => c.called).length;

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((v) => !v)}
    >
      {children}

      {open && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-96 max-w-[90vw] -translate-x-1/2 rounded-xl border border-amber-300/30 bg-[#161d2e] p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="truncate text-xs font-bold text-amber-200">
              {name}
            </span>
            <span className="shrink-0 text-[11px] font-bold text-emerald-300">
              ✅ {checked} · 배치 {cells.length}
            </span>
          </div>

          {cells.length === 0 ? (
            <p className="rounded-md bg-white/5 px-2 py-5 text-center text-[11px] text-white/50">
              아직 빙고판에 사진을 배치하지 않았어요
            </p>
          ) : (
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: size * size }, (_, pos) => {
                const c = byPos.get(pos);
                return (
                  <div
                    key={pos}
                    style={{ containerType: "inline-size" }}
                    className={`relative aspect-square overflow-hidden rounded-[3px] ${
                      c
                        ? c.called
                          ? "ring-1 ring-emerald-400"
                          : "ring-1 ring-white/15"
                        : "bg-white/5"
                    }`}
                  >
                    {c && (
                      <>
                        {c.is_org ? (
                          <div
                            className={`absolute inset-0 flex items-center justify-center overflow-hidden bg-gradient-to-br from-violet-500 to-fuchsia-600 p-0.5 ${
                              c.called ? "" : "opacity-40"
                            }`}
                          >
                            <span
                              className="break-keep text-center font-extrabold leading-tight text-white"
                              style={phraseSizeStyle(c.keyword)}
                            >
                              {c.keyword}
                            </span>
                          </div>
                        ) : (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={c.photo_url}
                              alt=""
                              className={`absolute inset-0 h-full w-full object-cover ${
                                c.called ? "" : "opacity-30"
                              }`}
                            />
                            <span
                              className="absolute inset-0 flex items-center justify-center text-center font-extrabold leading-none text-white"
                              style={{
                                fontSize: "22cqw",
                                textShadow: "0 1px 2px rgba(0,0,0,.9)",
                              }}
                            >
                              {short(c.keyword)}
                            </span>
                          </>
                        )}
                        {c.called && (
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <span
                              className="aspect-square w-[82%] rounded-full border-[3px] border-rose-500"
                              style={{
                                boxShadow:
                                  "0 0 5px rgba(244,63,94,.9), inset 0 0 4px rgba(244,63,94,.6)",
                              }}
                            />
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
