"use client";

// 📝 기관 문구 타일 편집 — 운영자가 사진 없이 문구 타일을 추가/삭제하고,
// 보드의 특정 칸에 "고정 배치"하면 모든 가족 판 그 칸에 자동으로 들어간다.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addOrgBingoTileAction,
  deleteOrgBingoTileAction,
  setOrgTilePositionAction,
} from "@/lib/bingo/actions";
import {
  applyTemplateToBoardAction,
  saveBoardAsOrgTemplateAction,
} from "@/lib/bingo/template-actions";
import { phraseSizeStyle } from "@/lib/bingo/tile-style";
import type {
  BingoEntryRow,
  BingoTemplateWithTiles,
} from "@/lib/bingo/types";

export function OrgTilesEditor({
  boardId,
  size,
  tiles,
  templates = [],
  dark = false,
}: {
  boardId: string;
  size: number;
  tiles: BingoEntryRow[];
  /** 불러올 수 있는 템플릿 (전역 + 기관 전용). */
  templates?: BingoTemplateWithTiles[];
  /** 관제실(다크 배경)에 임베드할 때 true. */
  dark?: boolean;
}) {
  const router = useRouter();
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [saveName, setSaveName] = useState("");
  const [pending, startTransition] = useTransition();

  // position → 고정 타일.
  const fixedByPos = useMemo(() => {
    const m = new Map<number, BingoEntryRow>();
    for (const t of tiles) if (t.fixed_position != null) m.set(t.fixed_position, t);
    return m;
  }, [tiles]);

  function add() {
    const text = phrase.trim();
    if (!text || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        await addOrgBingoTileAction(boardId, text);
        setPhrase("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "추가 실패");
      }
    });
  }

  function remove(entryId: string) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteOrgBingoTileAction(boardId, entryId);
        if (selectedId === entryId) setSelectedId(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "삭제 실패");
      }
    });
  }

  function setPosition(entryId: string, position: number | null) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        await setOrgTilePositionAction(boardId, entryId, position);
        setSelectedId(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "배치 실패");
      }
    });
  }

  // 칸 클릭 — 선택한 타일이 있으면 거기 배치, 없으면 점유 타일 해제.
  function onCellClick(pos: number) {
    const occupant = fixedByPos.get(pos);
    if (selectedId) {
      setPosition(selectedId, pos);
    } else if (occupant) {
      setPosition(occupant.id, null);
    }
  }

  function applyTemplate() {
    if (!templateId || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        await applyTemplateToBoardAction(boardId, templateId);
        setTemplateId("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "불러오기 실패");
      }
    });
  }

  function saveTemplate() {
    const name = saveName.trim();
    if (!name || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        await saveBoardAsOrgTemplateAction(boardId, name);
        setSaveName("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장 실패");
      }
    });
  }

  const t = {
    section: dark ? "border-white/10 bg-white/5" : "border-[#D4E4BC] bg-white",
    title: dark ? "text-amber-100" : "text-[#2D5A3D]",
    sub: dark ? "text-white/50" : "text-[#8B7F75]",
    body: dark ? "text-white/60" : "text-[#6B6560]",
    input: dark
      ? "border-white/15 bg-black/25 text-white placeholder:text-white/40 focus:border-emerald-400"
      : "border-[#D4E4BC] bg-[#FFFDF8] text-[#2D5A3D] focus:border-emerald-500",
    emptyCell: dark
      ? "border-dashed border-white/15 bg-black/20 text-white/40 hover:border-emerald-400/60"
      : "border-dashed border-[#D4E4BC] bg-[#FFFDF8] text-[#B0A89C] hover:border-emerald-400",
  };

  return (
    <section className={`rounded-2xl border p-5 shadow-sm ${t.section}`}>
      <h2 className={`text-sm font-bold ${t.title}`}>
        📝 기관 문구 타일{" "}
        <span className={`font-normal ${t.sub}`}>
          (사진 없이 문구만 — 모든 가족에게 노출)
        </span>
      </h2>
      <p className={`mt-1 text-xs ${t.body}`}>
        문구를 추가한 뒤, 칩을 선택하고 아래 빙고판의 칸을 누르면 그 칸에 고정돼요.
        고정한 칸은 <b>모든 가족 판</b>에 자동으로 채워집니다.
      </p>

      {/* 📋 템플릿 — 불러오기 / 저장 (라인 2개) */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          disabled={pending || templates.length === 0}
          className={`min-w-[160px] flex-1 rounded-lg border px-2 py-1.5 text-xs focus:outline-none ${t.input}`}
        >
          <option value="">
            {templates.length === 0 ? "템플릿 없음" : "📋 템플릿 불러오기…"}
          </option>
          {templates.map((tp) => (
            <option key={tp.id} value={tp.id}>
              {tp.scope === "ORG" ? "🏫 " : "🌐 "}
              {tp.name} ({tp.size}×{tp.size}, 문구 {tp.tiles.length})
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={applyTemplate}
          disabled={pending || !templateId}
          className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          불러오기
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="내 템플릿으로 저장 (이름)"
          maxLength={40}
          disabled={pending}
          className={`min-w-[160px] flex-1 rounded-lg border px-2 py-1.5 text-xs focus:outline-none ${t.input}`}
        />
        <button
          type="button"
          onClick={saveTemplate}
          disabled={pending || !saveName.trim()}
          className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
            dark
              ? "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
              : "border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#F5F1E8]"
          }`}
        >
          저장
        </button>
      </div>

      <div className="mt-3 flex gap-2">
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
          className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm focus:outline-none ${t.input}`}
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
        <p
          className={`mt-2 text-xs font-semibold ${
            dark ? "text-rose-300" : "text-rose-700"
          }`}
        >
          ⚠ {error}
        </p>
      )}

      {tiles.length === 0 ? (
        <p
          className={`mt-3 rounded-lg border border-dashed px-3 py-4 text-center text-xs ${
            dark
              ? "border-white/15 bg-black/20 text-white/50"
              : "border-[#D4E4BC] bg-[#FFFDF8] text-[#8B7F75]"
          }`}
        >
          아직 기관 문구 타일이 없어요. 위에서 문구를 추가해 보세요.
        </p>
      ) : (
        <>
          {/* 칩 — 클릭해서 배치할 타일 선택 */}
          <ul className="mt-3 flex flex-wrap gap-2">
            {tiles.map((tile) => {
              const placed = tile.fixed_position != null;
              const selected = selectedId === tile.id;
              return (
                <li
                  key={tile.id}
                  className={`flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-1.5 text-xs font-bold transition ${
                    selected
                      ? "border-amber-400 bg-amber-500/30 text-amber-100 ring-2 ring-amber-300/50"
                      : dark
                        ? "border-violet-300/30 bg-violet-500/20 text-violet-100"
                        : "border-violet-200 bg-violet-50 text-violet-800"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedId(selected ? null : tile.id)
                    }
                    disabled={pending}
                    title={placed ? "선택 후 다른 칸으로 이동" : "선택 후 칸에 배치"}
                    className="flex items-center gap-1"
                  >
                    {placed && <span aria-hidden>📌</span>}
                    <span className="max-w-[180px] truncate">{tile.keyword}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(tile.id)}
                    disabled={pending}
                    title="삭제"
                    className={`flex h-5 w-5 items-center justify-center rounded-full disabled:opacity-50 ${
                      dark
                        ? "bg-white/15 text-violet-200 hover:bg-rose-500/40 hover:text-white"
                        : "bg-white/70 text-violet-500 hover:bg-rose-100 hover:text-rose-600"
                    }`}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>

          <p className={`mt-2 text-[11px] ${t.body}`}>
            {selectedId
              ? "📍 배치할 칸을 누르세요. (고정된 칸을 다시 누르면 그 칸으로 이동)"
              : "칩을 선택하면 빙고판에 배치할 수 있어요. 고정된 칸(📌)을 누르면 해제돼요."}
          </p>

          {/* 배치용 빙고판 — 절반 크기, 가운데 정렬 */}
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
                        ? dark
                          ? "border-amber-300/50 bg-amber-500/10 hover:border-amber-300"
                          : "border-amber-300 bg-amber-50 hover:border-amber-500"
                        : t.emptyCell
                  } ${pending ? "cursor-wait" : "cursor-pointer"}`}
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
    </section>
  );
}
