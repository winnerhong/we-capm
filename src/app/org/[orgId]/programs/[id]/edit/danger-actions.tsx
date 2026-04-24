"use client";

import { useTransition } from "react";
import {
  toggleOrgProgramPublishAction,
  deleteOrgProgramAction,
} from "../../../actions";

export function DangerActions({
  programId,
  isPublished,
}: {
  programId: string;
  isPublished: boolean;
}) {
  const [togglePending, startToggle] = useTransition();
  const [deletePending, startDelete] = useTransition();

  const onToggle = () => {
    startToggle(async () => {
      await toggleOrgProgramPublishAction(programId, !isPublished);
    });
  };

  const onDelete = () => {
    const ok = window.confirm(
      "정말 이 프로그램을 삭제할까요?\n삭제 후에는 복구할 수 없어요."
    );
    if (!ok) return;
    startDelete(async () => {
      await deleteOrgProgramAction(programId);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        disabled={togglePending}
        aria-busy={togglePending}
        className={`rounded-xl px-3 py-2 text-xs font-bold shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60 ${
          isPublished
            ? "border border-[#D4E4BC] bg-white text-[#2D5A3D]"
            : "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white"
        }`}
      >
        {togglePending
          ? "처리 중..."
          : isPublished
            ? "⏸️ 비공개로 전환"
            : "📢 공개하기"}
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={deletePending}
        aria-busy={deletePending}
        className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
      >
        {deletePending ? "삭제 중..." : "🗑️ 삭제"}
      </button>
    </div>
  );
}
