"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  toggleOrgProgramPublishAction,
  deleteOrgProgramAction,
} from "../../../actions";

export function DangerActions({
  programId,
  orgId,
  isPublished,
}: {
  programId: string;
  orgId: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [togglePending, startToggle] = useTransition();
  const [deletePending, startDelete] = useTransition();

  const onToggle = () => {
    startToggle(async () => {
      const res = await toggleOrgProgramPublishAction(programId, !isPublished);
      if (res && res.ok === false) {
        alert(`공개 전환 실패: ${res.message ?? "알 수 없는 오류"}`);
        return;
      }
      router.refresh();
    });
  };

  const onDelete = () => {
    const ok = window.confirm(
      "정말 이 프로그램을 삭제할까요?\n삭제 후에는 복구할 수 없어요."
    );
    if (!ok) return;
    startDelete(async () => {
      const res = await deleteOrgProgramAction(programId);
      if (res && res.ok === false) {
        alert(`삭제 실패: ${res.message ?? "알 수 없는 오류"}`);
        return;
      }
      // 삭제 성공 — 편집 페이지(이미 사라진 row 를 보려는 곳)에서 프로그램 목록으로 이동
      router.push(`/org/${orgId}/programs`);
      router.refresh();
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
