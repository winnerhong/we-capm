"use client";

// 빙고 템플릿 타일 편집 — 문구 추가/삭제 + 미니 빙고판에 고정 위치 배치.
// (기관 보드의 OrgTilesEditor 와 동일 UX, 대상이 템플릿 타일.)

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addTemplateTileAction,
  removeTemplateTileAction,
  setTemplateTilePositionAction,
} from "@/lib/bingo/template-actions";
import { phraseSizeStyle } from "@/lib/bingo/tile-style";
import type { BingoTemplateTileRow } from "@/lib/bingo/types";

export function TemplateTilesEditor({
  templateId,
  size,
  tiles,
}: {
  templateId: string;
  size: number;
  tiles: BingoTemplateTileRow[];
}) {
  const router = useRouter();
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fixedByPos = useMemo(() => {
    const m = new Map<number, BingoTemplateTileRow>();
    for (const t of tiles) if (t.fixed_position != null) m.set(t.fixed_position, t);
    return m;
  }, [tiles]);

  function run(fn: () => Promise<void>) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "처리 실패");
      }
    });
  }

  function add() {
    const text = phrase.trim();
    if (!text) return;
    run(async () => {
      await addTemplateTileAction(templateId, text);
      setPhrase("");
    });
  }

  function onCellClick(pos: number) {
    const occupant = fixedByPos.get(pos);
    if (selectedId) {
      const id = selectedId;
      run(async () => {
        await setTemplateTilePositionAction(templateId, id, pos);
        setSelectedId(null);
      });
    } else if (occupant) {
      run(() => setTemplateTilePositionAction(templateId, occupant.id, null));
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="문구를 입력하고 추가 (40자 이내)"
          maxLength={40}
          disabled={pending}
          className="flex-1 rounded-lg border-2 border-[#D4E4BC] bg-[#FFFDF8] px-3 py-2 text-sm text-[#2D5A3D] focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending || !phrase.trim()}
          className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          추가
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs font-semibold text-rose-700">⚠ {error}</p>
      )}

      {tiles.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-[#D4E4BC] bg-[#FFFDF8] px-3 py-4 text-center text-xs text-[#8B7F75]">
          아직 문구가 없어요. 위에서 문구를 추가해 보세요.
        </p>
      ) : (
        <>
          <ul className="mt-3 flex flex-wrap gap-2">
            {tiles.map((tile) => {
              const placed = tile.fixed_position != null;
              const selected = selectedId === tile.id;
              return (
                <li
                  key={tile.id}
                  className={`flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-1.5 text-xs font-bold transition ${
                    selected
                      ? "border-amber-400 bg-amber-100 text-amber-800 ring-2 ring-amber-300"
                      : "border-violet-200 bg-violet-50 text-violet-800"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(selected ? null : tile.id)}
                    disabled={pending}
                    className="flex items-center gap-1"
                  >
                    {placed && <span aria-hidden>📌</span>}
                    <span className="max-w-[200px] truncate">{tile.keyword}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      run(() => removeTemplateTileAction(templateId, tile.id))
                    }
                    disabled={pending}
                    title="삭제"
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-white/70 text-violet-500 hover:bg-rose-100 hover:text-rose-600 disabled:opacity-50"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="mt-2 text-[11px] text-[#6B6560]">
            {selectedId
              ? "📍 배치할 칸을 누르세요. (고정된 칸을 누르면 그 칸으로 이동)"
              : "칩을 선택하면 빙고판에 배치할 수 있어요. 고정된 칸(📌)을 누르면 해제돼요."}
          </p>

          <div
            className="mx-auto mt-2 grid w-1/2 min-w-[200px] gap-1.5"
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: size * size }, (_, pos) => {
              const occ = fixedByPos.get(pos);
              return (
                <button
                  key={pos}
                  type="button"
                  onClick={() => onCellClick(pos)}
                  disabled={pending || (!selectedId && !occ)}
                  style={{ containerType: "inline-size" }}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                    occ
                      ? "border-violet-400 bg-gradient-to-br from-violet-500 to-fuchsia-600"
                      : selectedId
                        ? "border-amber-300 bg-amber-50 hover:border-amber-500 cursor-pointer"
                        : "border-dashed border-[#D4E4BC] bg-[#FFFDF8] text-[#B0A89C]"
                  }`}
                >
                  {occ ? (
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden p-1">
                      <span
                        className="break-keep text-center font-extrabold text-white"
                        style={phraseSizeStyle(occ.keyword)}
                      >
                        {occ.keyword}
                      </span>
                    </div>
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                      {pos + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
