"use client";

import { useState, useTransition } from "react";
import {
  BINGO_LINE_OPTIONS,
  BINGO_SIZES,
  type BingoLines,
  type BingoSize,
} from "@/lib/bingo/types";

type Props = {
  action: (formData: FormData) => Promise<void>;
  initial?: {
    name: string;
    size: BingoSize;
    lines_to_win: BingoLines;
    keyword_theme: string;
    show_ranking: boolean;
  };
};

export function BoardForm({ action, initial }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [size, setSize] = useState<BingoSize>(initial?.size ?? 3);
  const [linesToWin, setLinesToWin] = useState<BingoLines>(
    initial?.lines_to_win ?? 1
  );
  const [keywordTheme, setKeywordTheme] = useState(
    initial?.keyword_theme ?? ""
  );
  const [showRanking, setShowRanking] = useState(initial?.show_ranking ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);
    if (!name.trim()) {
      setError("보드 이름을 입력해 주세요");
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("name", name.trim());
        fd.set("size", String(size));
        fd.set("lines_to_win", String(linesToWin));
        fd.set("keyword_theme", keywordTheme.trim());
        if (showRanking) fd.set("show_ranking", "on");
        await action(fd);
      } catch (e2) {
        const msg = e2 instanceof Error ? e2.message : "저장에 실패했어요";
        if (!msg.includes("NEXT_REDIRECT")) setError(msg);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
      {error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
          ⚠ {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-[#2D5A3D]">
          보드 이름
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예) 봄가족운동회 빙고"
          maxLength={60}
          required
          disabled={pending}
          className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#2D5A3D]">
          빙고 크기
        </label>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {BINGO_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={pending}
              onClick={() => setSize(s)}
              className={`rounded-xl border-2 px-3 py-3 text-sm font-bold transition ${
                size === s
                  ? "border-[#2D5A3D] bg-[#E8F0E4] text-[#2D5A3D]"
                  : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-[#2D5A3D]/50"
              }`}
            >
              {s}×{s}
              <span className="ml-1 text-[10px] font-normal text-[#6B6560]">
                ({s * s}칸)
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#2D5A3D]">
          승리 조건
        </label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {BINGO_LINE_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              disabled={pending}
              onClick={() => setLinesToWin(n)}
              className={`rounded-xl border-2 px-3 py-3 text-sm font-bold transition ${
                linesToWin === n
                  ? "border-amber-500 bg-amber-50 text-amber-800"
                  : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-amber-300"
              }`}
            >
              {n}줄 완성
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#2D5A3D]">
          키워드 주제 <span className="text-xs font-normal text-[#8B7F75]">(선택)</span>
        </label>
        <input
          type="text"
          value={keywordTheme}
          onChange={(e) => setKeywordTheme(e.target.value)}
          placeholder="예) 우리 가족의 행복"
          maxLength={60}
          disabled={pending}
          className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
        />
        <p className="mt-1 text-[11px] text-[#6B6560]">
          참가자에게 안내될 한 줄 주제. 가족이 키워드를 적을 때 가이드가 돼요.
        </p>
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-[#D4E4BC] bg-white px-3 py-2">
        <input
          type="checkbox"
          checked={showRanking}
          onChange={(e) => setShowRanking(e.target.checked)}
          disabled={pending}
          className="h-4 w-4 rounded border-[#D4E4BC] text-emerald-600 focus:ring-emerald-500"
        />
        <span className="text-sm font-semibold text-[#2D5A3D]">
          참가자에게 순위 공개
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[#2D5A3D] px-4 py-3 text-sm font-bold text-white hover:bg-[#234A31] disabled:opacity-60"
      >
        {pending ? "저장 중…" : "💾 저장"}
      </button>
    </form>
  );
}
