"use client";

// 스탬프북 미션 리스트 — HTML5 native drag & drop 으로 순서 변경.
//
// 동작:
//   - 데스크톱: 행 좌측 핸들(≡) 또는 행 본문을 드래그해서 다른 행 위로 드롭
//   - 모바일: 길게 누르고 드래그하면 동작 (브라우저 지원 가변 → 추후 PointerSensor 라이브러리 검토)
//   - 드롭 시 optimistic 으로 로컬 상태 reorder → reorderMissionsInPackAction 호출
//   - 액션 실패 시 토스트 + router.refresh() 로 서버 상태와 재동기화

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AcornIcon } from "@/components/acorn-icon";
import {
  MISSION_KIND_META,
  type OrgMissionRow,
} from "@/lib/missions/types";
import {
  reorderMissionsInPackAction,
  removeMissionFromPackAction,
} from "../../../missions/actions";

type UnlockMeta = { label: string; icon: ReactNode; color: string };
type ApprovalMeta = { label: string; icon: string; color: string };

type Props = {
  packId: string;
  orgId: string;
  missions: OrgMissionRow[];
  unlockMetaMap: Record<string, UnlockMeta>;
  approvalMetaMap: Record<string, ApprovalMeta>;
};

export function DraggableMissionList({
  packId,
  orgId,
  missions,
  unlockMetaMap,
  approvalMetaMap,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState<OrgMissionRow[]>(missions);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);

  // SSR 데이터 동기화 — 외부에서 다시 들어왔을 때(예: router.refresh) 새 데이터로
  useEffect(() => {
    setItems(missions);
  }, [missions]);

  function onDragStart(e: React.DragEvent<HTMLLIElement>, idx: number) {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    // Firefox 호환 — 데이터 설정 안 하면 drop 이벤트가 발생 안 함
    try {
      e.dataTransfer.setData("text/plain", String(idx));
    } catch {
      /* ignore */
    }
  }

  function onDragOver(e: React.DragEvent<HTMLLIElement>, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overIdx !== idx) setOverIdx(idx);
  }

  function onDragLeave() {
    setOverIdx(null);
  }

  function onDrop(e: React.DragEvent<HTMLLIElement>, idx: number) {
    e.preventDefault();
    const from = draggedIdx;
    setDraggedIdx(null);
    setOverIdx(null);
    if (from === null || from === idx) return;

    // optimistic reorder
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(idx, 0, moved);
    setItems(next);
    setToast(null);

    startTransition(async () => {
      try {
        await reorderMissionsInPackAction(
          packId,
          next.map((m) => m.id)
        );
        setToast({ kind: "ok", text: "순서 변경 완료" });
        router.refresh();
        window.setTimeout(() => setToast(null), 1500);
      } catch (err) {
        setToast({
          kind: "error",
          text: err instanceof Error ? err.message : "순서 변경 실패",
        });
        // 실패 시 서버 상태로 복귀
        setItems(missions);
      }
    });
  }

  function onDragEnd() {
    setDraggedIdx(null);
    setOverIdx(null);
  }

  function onRemove(missionId: string) {
    if (
      !window.confirm(
        "이 미션을 스탬프북에서 제거할까요? 편집 내용도 모두 사라집니다."
      )
    )
      return;
    setToast(null);
    startTransition(async () => {
      try {
        await removeMissionFromPackAction(missionId);
        // optimistic 제거
        setItems((prev) => prev.filter((m) => m.id !== missionId));
        router.refresh();
      } catch (err) {
        setToast({
          kind: "error",
          text: err instanceof Error ? err.message : "삭제 실패",
        });
      }
    });
  }

  return (
    <>
      {toast && (
        <p
          role="status"
          className={`mb-2 rounded-lg px-3 py-2 text-xs font-semibold ${
            toast.kind === "ok"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-rose-50 text-rose-800"
          }`}
        >
          {toast.kind === "ok" ? "✅ " : "⚠ "}
          {toast.text}
        </p>
      )}
      <ul className="space-y-2">
        {items.map((m, idx) => {
          const kindMeta = MISSION_KIND_META[m.kind];
          const unlockMeta = unlockMetaMap[m.unlock_rule];
          const approvalMeta = approvalMetaMap[m.approval_mode];
          const isDragging = draggedIdx === idx;
          const isOver = overIdx === idx && draggedIdx !== idx;
          return (
            <li
              key={m.id}
              draggable={!isPending}
              onDragStart={(e) => onDragStart(e, idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, idx)}
              onDragEnd={onDragEnd}
              className={`flex flex-col gap-2 rounded-xl border p-3 transition md:flex-row md:items-center md:justify-between ${
                isDragging
                  ? "border-[#2D5A3D] bg-[#E8F0E4] opacity-50 shadow-md"
                  : isOver
                    ? "border-[#2D5A3D] bg-[#F5F1E8] shadow-md ring-2 ring-[#2D5A3D]/30"
                    : "border-[#D4E4BC] bg-[#FFF8F0]"
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                {/* 드래그 핸들 */}
                <span
                  className="flex h-9 w-7 flex-shrink-0 cursor-grab items-center justify-center rounded-lg text-[#8B7F75] hover:bg-white hover:text-[#2D5A3D] active:cursor-grabbing"
                  aria-label="드래그해서 순서 변경"
                  title="드래그해서 순서 변경"
                >
                  ⋮⋮
                </span>
                <span
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white text-lg font-bold text-[#2D5A3D]"
                  aria-hidden
                >
                  {idx + 1}
                </span>
                <span
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#E8F0E4] text-xl"
                  aria-hidden
                >
                  {m.icon || kindMeta.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#2C2C2C]">
                    {m.title || "(제목 없음)"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                      <span aria-hidden>{kindMeta.icon}</span>
                      <span>{kindMeta.label}</span>
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                      <AcornIcon size={12} />
                      <span>+{m.acorns}</span>
                    </span>
                    {unlockMeta && (
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${unlockMeta.color}`}
                      >
                        <span aria-hidden>{unlockMeta.icon}</span>
                        <span>{unlockMeta.label}</span>
                      </span>
                    )}
                    {approvalMeta && (
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${approvalMeta.color}`}
                      >
                        <span aria-hidden>{approvalMeta.icon}</span>
                        <span>{approvalMeta.label}</span>
                      </span>
                    )}
                    {!m.is_active && (
                      <span className="inline-flex items-center gap-0.5 rounded-full border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">
                        비활성
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-shrink-0 items-center gap-2">
                <Link
                  href={`/org/${orgId}/missions/${m.id}/edit`}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1.5 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
                >
                  <span aria-hidden>✏️</span>
                  <span>편집</span>
                </Link>
                <button
                  type="button"
                  onClick={() => onRemove(m.id)}
                  disabled={isPending}
                  aria-label="제거"
                  className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  🗑
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
