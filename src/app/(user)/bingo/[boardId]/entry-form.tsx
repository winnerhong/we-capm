"use client";

// 가족 사진 + 키워드 등록 — 1팀 1개. 재제출 시 덮어쓰기 (upsert).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CoverImagePicker } from "@/components/cover-image-picker";
import { submitBingoEntryAction } from "@/lib/bingo/participant-actions";
import type { BingoEntryRow } from "@/lib/bingo/types";

type Props = {
  boardId: string;
  keywordTheme: string | null;
  existingEntry: BingoEntryRow | null;
};

export function EntryForm({ boardId, keywordTheme, existingEntry }: Props) {
  const router = useRouter();
  const [photoUrl, setPhotoUrl] = useState(existingEntry?.photo_url ?? "");
  const [keyword, setKeyword] = useState(existingEntry?.keyword ?? "");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(!existingEntry);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);
    if (!photoUrl) {
      setError("우리 가족 사진을 올려주세요");
      return;
    }
    if (!keyword.trim()) {
      setError("키워드를 적어주세요");
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("photo_url", photoUrl);
        fd.set("keyword", keyword.trim());
        await submitBingoEntryAction(boardId, fd);
        setSavedAt(Date.now());
        setEditing(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "등록에 실패했어요");
      }
    });
  };

  // 이미 등록됨 + 편집 중 아님 → 요약 카드 + [수정] 버튼.
  if (existingEntry && !editing) {
    return (
      <section className="rounded-2xl border-2 border-emerald-300 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={existingEntry.photo_url}
            alt="우리 가족"
            className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-emerald-200"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
              ✓ 등록 완료
            </p>
            <p className="mt-0.5 text-sm font-bold text-[#2D5A3D]">
              🗝 {existingEntry.keyword}
            </p>
            <p className="mt-1 text-[11px] text-[#6B6560]">
              피드에 우리 가족 사진이 올라갔어요!
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1 text-[11px] font-bold text-[#2D5A3D] hover:bg-[#F5F1E8]"
          >
            ✏️ 수정
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 shadow-sm">
      <h2 className="text-sm font-bold text-amber-900">
        🌟 우리 가족 등록하기
      </h2>
      <p className="mt-1 text-[11px] text-amber-800">
        가족 사진 한 장 + 키워드 한 줄을 적어주세요. 다른 가족들의 빙고판에
        올라갑니다.
      </p>
      {keywordTheme && (
        <p className="mt-2 inline-block rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-amber-800">
          이번 주제: 🗝 {keywordTheme}
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-3 space-y-3">
        <div>
          <label className="block text-xs font-bold text-amber-900">
            📷 우리 가족 사진
          </label>
          <div className="mt-1">
            <CoverImagePicker
              value={photoUrl}
              onChange={setPhotoUrl}
              bucket="preset-covers"
              pathPrefix="bingo"
              compact
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-amber-900">
            🗝 키워드 (30자 이내)
          </label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={keywordTheme ?? "예) 우리 가족의 추억"}
            maxLength={30}
            required
            disabled={pending}
            className="mt-1 w-full rounded-lg border-2 border-amber-300 bg-white px-3 py-2.5 text-sm text-[#2D5A3D] focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-300/40"
          />
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
            ⚠ {error}
          </div>
        )}
        {savedAt && (
          <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            ✅ 등록됐어요
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-60"
          >
            {pending ? "올리는 중…" : existingEntry ? "💾 수정 저장" : "🌟 등록하기"}
          </button>
          {existingEntry && (
            <button
              type="button"
              onClick={() => {
                setPhotoUrl(existingEntry.photo_url);
                setKeyword(existingEntry.keyword);
                setEditing(false);
                setError(null);
              }}
              disabled={pending}
              className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-xs font-bold text-[#6B4423]"
            >
              취소
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
