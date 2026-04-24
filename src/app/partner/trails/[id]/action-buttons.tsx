"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateTrailStatusAction,
  deleteTrailAction,
  duplicateTrailAction,
} from "../actions";

type Props = {
  trailId: string;
  currentStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
};

export function TrailActionButtons({ trailId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const handleStatus = (next: "DRAFT" | "PUBLISHED" | "ARCHIVED") => {
    if (next === currentStatus) return;
    setErr(null);
    startTransition(async () => {
      try {
        await updateTrailStatusAction(trailId, next);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("NEXT_REDIRECT")) setErr(msg);
      }
    });
  };

  const handleDuplicate = () => {
    if (!confirm("이 숲길을 복제할까요? 모든 지점도 함께 복제돼요.")) return;
    setErr(null);
    startTransition(async () => {
      try {
        await duplicateTrailAction(trailId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("NEXT_REDIRECT")) setErr(msg);
      }
    });
  };

  const handleDelete = () => {
    if (
      !confirm(
        "정말 이 숲길을 삭제할까요? 지점과 완주 기록도 모두 삭제되며 되돌릴 수 없어요."
      )
    )
      return;
    setErr(null);
    startTransition(async () => {
      try {
        await deleteTrailAction(trailId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("NEXT_REDIRECT")) setErr(msg);
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1 text-xs text-[#6B6560]">
          상태
          <select
            defaultValue={currentStatus}
            onChange={(e) =>
              handleStatus(e.target.value as "DRAFT" | "PUBLISHED" | "ARCHIVED")
            }
            disabled={isPending}
            className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-1 text-xs font-semibold text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20 disabled:opacity-60"
            aria-label="숲길 상태"
          >
            <option value="DRAFT">📝 초안</option>
            <option value="PUBLISHED">🌳 공개중</option>
            <option value="ARCHIVED">📦 보관</option>
          </select>
        </label>

        <button
          type="button"
          onClick={handleDuplicate}
          disabled={isPending}
          className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-60"
        >
          📄 복제
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
        >
          🗑 삭제
        </button>
      </div>

      {err && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] text-rose-700"
        >
          ⚠️ {err}
        </div>
      )}
    </div>
  );
}
