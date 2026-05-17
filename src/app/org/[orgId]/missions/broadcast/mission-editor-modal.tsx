"use client";

// 돌발 미션 생성/수정 폼 모달.
// trigger-panel 에서 "+ 새 미션" 또는 카드의 "✏️ 수정" 버튼으로 호출.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createBroadcastMissionAction,
  updateBroadcastMissionAction,
  type BroadcastMissionInput,
} from "@/lib/missions/broadcast-actions";

export interface MissionEditorInitial {
  id: string;
  title: string;
  icon: string | null;
  description: string | null;
  acorns: number;
  prompt: string;
  duration_sec: number;
  submission_kind: "PHOTO" | "TEXT";
}

interface Props {
  initial: MissionEditorInitial | null; // null = 신규
  onClose: () => void;
}

export function MissionEditorModal({ initial, onClose }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "⚡");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [durationMin, setDurationMin] = useState(
    Math.max(1, Math.round((initial?.duration_sec ?? 300) / 60))
  );
  const [acorns, setAcorns] = useState(initial?.acorns ?? 3);
  const [submissionKind, setSubmissionKind] = useState<"PHOTO" | "TEXT">(
    initial?.submission_kind ?? "PHOTO"
  );

  const isEdit = initial !== null;

  function handleSave() {
    setError(null);
    const input: BroadcastMissionInput = {
      title,
      prompt,
      durationSec: durationMin * 60,
      acorns,
      submissionKind,
      icon,
      description: description.trim() || null,
    };
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateBroadcastMissionAction(initial!.id, input);
        } else {
          await createBroadcastMissionAction(input);
        }
        router.refresh();
        onClose();
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "저장에 실패했어요. 잠시 후 다시 시도해 주세요."
        );
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "돌발 미션 수정" : "돌발 미션 만들기"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-[#E5DDD0] px-5 py-3">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-lg">
              {isEdit ? "✏️" : "✨"}
            </span>
            <h3 className="text-sm font-bold text-[#2D5A3D]">
              {isEdit ? "돌발 미션 수정" : "새 돌발 미션 만들기"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="닫기"
            className="rounded-lg px-2 py-1 text-sm text-[#6B6560] hover:bg-[#F5F1E8] disabled:opacity-40"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
              {error}
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-[#2D5A3D]">
              제목 <span className="text-rose-600">*</span>
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={icon ?? ""}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={4}
                placeholder="⚡"
                className="w-14 rounded-lg border border-[#D4E4BC] bg-[#FEFCF8] px-2 py-2 text-center text-base"
                aria-label="아이콘"
              />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder="예: 지금 이 순간 인증샷"
                className="flex-1 rounded-lg border border-[#D4E4BC] bg-[#FEFCF8] px-3 py-2 text-sm"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-[#2D5A3D]">
              프롬프트 (참가자가 보는 안내문){" "}
              <span className="text-rose-600">*</span>
            </span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={400}
              rows={3}
              placeholder="예: 지금 이 순간을 사진 1장으로 남겨주세요!"
              className="w-full rounded-lg border border-[#D4E4BC] bg-[#FEFCF8] px-3 py-2 text-sm"
            />
            <span className="mt-0.5 block text-right text-[10px] text-[#8B7F75]">
              {prompt.length} / 400
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-[#2D5A3D]">
              내부 메모 (선택 — 운영자만)
            </span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={120}
              placeholder="용도/타이밍 메모"
              className="w-full rounded-lg border border-[#D4E4BC] bg-[#FEFCF8] px-3 py-2 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[#2D5A3D]">
                제한 시간 (분)
              </span>
              <input
                type="number"
                value={durationMin}
                onChange={(e) =>
                  setDurationMin(Math.max(1, Math.min(60, Number(e.target.value))))
                }
                min={1}
                max={60}
                className="w-full rounded-lg border border-[#D4E4BC] bg-[#FEFCF8] px-3 py-2 text-sm"
              />
              <span className="mt-0.5 block text-[10px] text-[#8B7F75]">
                1~60분
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[#2D5A3D]">
                도토리 보상
              </span>
              <input
                type="number"
                value={acorns}
                onChange={(e) =>
                  setAcorns(Math.max(0, Math.min(99, Number(e.target.value))))
                }
                min={0}
                max={99}
                className="w-full rounded-lg border border-[#D4E4BC] bg-[#FEFCF8] px-3 py-2 text-sm"
              />
              <span className="mt-0.5 block text-[10px] text-[#8B7F75]">
                0~99
              </span>
            </label>
          </div>

          <fieldset>
            <legend className="mb-1 block text-xs font-bold text-[#2D5A3D]">
              제출 방식
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#D4E4BC] bg-[#FEFCF8] p-2 has-[:checked]:border-[#2D5A3D] has-[:checked]:bg-[#E8F0E4]">
                <input
                  type="radio"
                  name="kind"
                  value="PHOTO"
                  checked={submissionKind === "PHOTO"}
                  onChange={() => setSubmissionKind("PHOTO")}
                />
                <span className="text-sm font-semibold">📸 사진</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#D4E4BC] bg-[#FEFCF8] p-2 has-[:checked]:border-[#2D5A3D] has-[:checked]:bg-[#E8F0E4]">
                <input
                  type="radio"
                  name="kind"
                  value="TEXT"
                  checked={submissionKind === "TEXT"}
                  onChange={() => setSubmissionKind("TEXT")}
                />
                <span className="text-sm font-semibold">✍️ 텍스트</span>
              </label>
            </div>
          </fieldset>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[#E5DDD0] bg-[#FFF8F0] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-sm font-semibold text-[#6B6560] hover:bg-[#F5F1E8] disabled:opacity-40"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !title.trim() || !prompt.trim()}
            className="rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:from-rose-700 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending
              ? "저장 중…"
              : isEdit
              ? "💾 수정 저장"
              : "✨ 만들기"}
          </button>
        </footer>
      </div>
    </div>
  );
}
