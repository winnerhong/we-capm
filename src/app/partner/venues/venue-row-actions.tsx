"use client";

// 행사장 카드의 [보관]/[복원]/[삭제] 액션 — list page 인라인 사용.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveVenueAction,
  deleteVenueAction,
} from "@/lib/partner-venues/actions";

interface Props {
  id: string;
  label: string;
  archived: boolean;
}

export function VenueRowActions({ id, label, archived }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onArchive = () => {
    startTransition(async () => {
      try {
        await archiveVenueAction(id, !archived);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "처리 실패");
      }
    });
  };

  const onDelete = () => {
    if (!window.confirm(`"${label}" 행사장을 영구 삭제할까요?`)) return;
    startTransition(async () => {
      try {
        await deleteVenueAction(id);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "삭제 실패");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={onArchive}
        disabled={pending}
        className="rounded-lg border border-[#E5D3B8] bg-white px-2 py-1 text-[10px] font-bold text-[#8B6F47] hover:bg-[#FFF8F0] disabled:opacity-40"
      >
        {archived ? "↺ 복원" : "📦 보관"}
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-40"
      >
        🗑 삭제
      </button>
    </>
  );
}
