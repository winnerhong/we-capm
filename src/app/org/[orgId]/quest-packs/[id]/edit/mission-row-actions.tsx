"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  moveMissionAction,
  removeMissionFromPackAction,
} from "../../../missions/actions";

type Props = {
  missionId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

export function MissionRowActions({
  missionId,
  canMoveUp,
  canMoveDown,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onMove(direction: "UP" | "DOWN") {
    setErr(null);
    startTransition(async () => {
      try {
        await moveMissionAction(missionId, direction);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "이동 실패");
      }
    });
  }

  function onRemove() {
    if (
      !window.confirm(
        "이 미션을 스탬프북에서 제거할까요? 편집 내용도 모두 사라집니다."
      )
    ) {
      return;
    }
    setErr(null);
    startTransition(async () => {
      try {
        await removeMissionFromPackAction(missionId);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "삭제 실패");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onMove("UP")}
          disabled={!canMoveUp || isPending}
          aria-label="위로 이동"
          className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-1 text-xs font-semibold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove("DOWN")}
          disabled={!canMoveDown || isPending}
          aria-label="아래로 이동"
          className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-1 text-xs font-semibold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-30"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={isPending}
          aria-label="제거"
          className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
        >
          🗑
        </button>
      </div>
      {err && (
        <p role="alert" className="text-[10px] font-semibold text-rose-700">
          {err}
        </p>
      )}
    </div>
  );
}
