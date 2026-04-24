"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createDifficultyAction,
  updateDifficultyAction,
  deleteDifficultyAction,
} from "./difficulty-actions";

export interface CustomDifficulty {
  id: string;
  key: string;
  label: string;
  icon: string | null;
  description: string | null;
}

interface BuiltInDifficulty {
  key: string;
  label: string;
  icon: string;
  description: string;
}

const BUILT_IN: BuiltInDifficulty[] = [
  { key: "EASY", label: "쉬움", icon: "🌱", description: "30분 내외 · 남녀노소 누구나" },
  { key: "MEDIUM", label: "보통", icon: "🌿", description: "1시간 내외 · 가벼운 도전" },
  { key: "HARD", label: "어려움", icon: "🌲", description: "2시간 이상 · 체력 필요" },
];

const ICON_OPTIONS = [
  "🌱",
  "🌿",
  "🌲",
  "🍃",
  "🏞️",
  "⛰️",
  "🥾",
  "💪",
  "🔥",
  "🌊",
  "🎯",
  "⭐",
];

interface Props {
  name: string;
  defaultValue?: string;
  customDifficulties: CustomDifficulty[];
}

export function DifficultyPicker({
  name,
  defaultValue = "EASY",
  customDifficulties,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const all: Array<BuiltInDifficulty | CustomDifficulty> = [
    ...BUILT_IN,
    ...customDifficulties.map((c) => ({
      ...c,
      icon: c.icon ?? "🌿",
      description: c.description ?? "",
    })),
  ];

  const handleCreate = (fd: FormData) => {
    startTransition(async () => {
      try {
        await createDifficultyAction(fd);
        setCreating(false);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("NEXT_REDIRECT")) alert(msg);
      }
    });
  };

  const handleUpdate = (id: string, fd: FormData) => {
    startTransition(async () => {
      try {
        await updateDifficultyAction(id, fd);
        setEditingId(null);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("NEXT_REDIRECT")) alert(msg);
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("이 난이도를 삭제할까요? (이 난이도를 쓰는 숲길이 있으면 삭제 불가)"))
      return;
    startTransition(async () => {
      try {
        await deleteDifficultyAction(id);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("NEXT_REDIRECT")) alert(msg);
      }
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-[#2D5A3D]">난이도 *</div>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {all.map((d) => {
          const isCustom = customDifficulties.some(
            (c) => c.id === (d as CustomDifficulty).id
          );
          const customItem = isCustom ? (d as CustomDifficulty) : null;

          return (
            <label
              key={d.key}
              className={`group relative flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition has-[:checked]:border-[#2D5A3D] has-[:checked]:bg-[#F5F1E8] ${
                value === d.key
                  ? "border-[#2D5A3D] bg-[#F5F1E8]"
                  : "border-[#D4E4BC] bg-white hover:bg-[#FFF8F0]"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={d.key}
                checked={value === d.key}
                onChange={() => setValue(d.key)}
                className="sr-only"
              />
              <span className="text-lg">
                {d.icon} {d.label}
              </span>
              {d.description && (
                <span className="text-[10px] text-[#6B6560]">{d.description}</span>
              )}

              {isCustom && customItem && (
                <div className="absolute right-1 top-1 flex opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setEditingId(customItem.id);
                      setCreating(false);
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded border border-[#E5D3B8] bg-white text-[10px] hover:bg-[#FFF8F0]"
                    aria-label="수정"
                    title="수정"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete(customItem.id);
                    }}
                    className="ml-0.5 flex h-6 w-6 items-center justify-center rounded border border-rose-200 bg-white text-[10px] hover:bg-rose-50"
                    aria-label="삭제"
                    title="삭제"
                  >
                    🗑
                  </button>
                </div>
              )}
            </label>
          );
        })}

        {/* ➕ 새 난이도 트리거 카드 */}
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setEditingId(null);
          }}
          className={`flex min-h-[72px] flex-col items-center justify-center rounded-xl border border-dashed bg-white p-3 text-xs font-semibold transition ${
            creating
              ? "border-sky-400 text-sky-700"
              : "border-[#D4E4BC] text-[#6B6560] hover:border-[#2D5A3D] hover:bg-[#F5F1E8] hover:text-[#2D5A3D]"
          }`}
        >
          <span className="text-xl">➕</span>
          <span className="mt-0.5">새 난이도</span>
        </button>
      </div>

      {/* 생성 폼 (그리드 아래 풀폭) */}
      {creating && (
        <form
          action={handleCreate}
          className="mt-3 rounded-xl border border-sky-400 bg-sky-50 p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <select
              name="icon"
              defaultValue="🌿"
              className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-2 text-lg"
              aria-label="아이콘 선택"
            >
              {ICON_OPTIONS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
            <input
              name="label"
              maxLength={30}
              required
              autoFocus
              className="min-w-[140px] flex-1 rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
              placeholder="난이도 이름 (예: 매우 쉬움)"
            />
            <input
              name="description"
              maxLength={60}
              className="min-w-[140px] flex-1 rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
              placeholder="간단 설명 (선택)"
            />
            <div className="ml-auto flex gap-1">
              <button
                type="button"
                onClick={() => setCreating(false)}
                disabled={pending}
                className="rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#6B6560] hover:bg-white disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white hover:bg-[#3A7A52] disabled:opacity-50"
              >
                ➕ 추가
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 편집 폼 (그리드 아래 풀폭) */}
      {editingId &&
        (() => {
          const target = customDifficulties.find((c) => c.id === editingId);
          if (!target) return null;
          return (
            <form
              action={(fd) => handleUpdate(target.id, fd)}
              className="mt-3 rounded-xl border border-amber-400 bg-amber-50 p-3"
            >
              <p className="mb-2 text-[11px] font-semibold text-amber-900">
                ✏️ 난이도 수정 — {target.label}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  name="icon"
                  defaultValue={target.icon ?? "🌿"}
                  className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-2 text-lg"
                  aria-label="아이콘 선택"
                >
                  {ICON_OPTIONS.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
                <input
                  name="label"
                  defaultValue={target.label}
                  maxLength={30}
                  required
                  className="min-w-[140px] flex-1 rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
                  placeholder="난이도 이름"
                />
                <input
                  name="description"
                  defaultValue={target.description ?? ""}
                  maxLength={60}
                  className="min-w-[140px] flex-1 rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
                  placeholder="간단 설명 (선택)"
                />
                <div className="ml-auto flex gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    disabled={pending}
                    className="rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#6B6560] hover:bg-white disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-lg bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white hover:bg-[#3A7A52] disabled:opacity-50"
                  >
                    💾 저장
                  </button>
                </div>
              </div>
            </form>
          );
        })()}
    </div>
  );
}
