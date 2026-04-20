"use client";

import { useState, useTransition } from "react";

const ICONS = ["🏡", "🌳", "🌿", "🐿️", "🦔", "🦉"];

export default function NewGuildForm({
  eventId,
  action,
  leaderName,
}: {
  eventId: string;
  action: (formData: FormData) => Promise<void>;
  leaderName: string;
}) {
  const [icon, setIcon] = useState<string>("🏡");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    formData.set("icon", icon);
    startTransition(async () => {
      try {
        await action(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "생성에 실패했어요");
      }
    });
  }

  return (
    <form
      action={onSubmit}
      className="space-y-5 rounded-2xl border border-[#D4E4BC] bg-white p-6 shadow-sm"
    >
      <p className="text-xs text-[#6B6560]">
        숲지기는 <span className="font-semibold text-[#2D5A3D]">{leaderName}</span>님이에요
      </p>

      {/* Name */}
      <div>
        <label htmlFor="guild-name" className="block text-sm font-semibold text-[#2D5A3D]">
          패밀리 이름
          <span className="ml-1 text-red-500" aria-hidden>
            *
          </span>
        </label>
        <input
          id="guild-name"
          name="name"
          type="text"
          required
          maxLength={24}
          autoComplete="off"
          placeholder="예: 도토리 탐험대"
          className="mt-2 w-full rounded-xl border border-[#D4E4BC] px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="guild-description"
          className="block text-sm font-semibold text-[#2D5A3D]"
        >
          한 줄 소개
        </label>
        <input
          id="guild-description"
          name="description"
          type="text"
          maxLength={60}
          autoComplete="off"
          placeholder="우리 패밀리는 이런 다람이가족!"
          className="mt-2 w-full rounded-xl border border-[#D4E4BC] px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {/* Icon picker */}
      <div>
        <span className="block text-sm font-semibold text-[#2D5A3D]">아이콘</span>
        <div
          role="radiogroup"
          aria-label="패밀리 아이콘 선택"
          className="mt-2 grid grid-cols-6 gap-2"
        >
          {ICONS.map((ic) => {
            const selected = icon === ic;
            return (
              <button
                key={ic}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setIcon(ic)}
                className={`flex aspect-square items-center justify-center rounded-xl border text-2xl transition ${
                  selected
                    ? "border-violet-500 bg-violet-50 ring-2 ring-violet-400"
                    : "border-[#D4E4BC] bg-white hover:bg-[#F5F9F0]"
                }`}
              >
                {ic}
              </button>
            );
          })}
        </div>
        <input type="hidden" name="icon" value={icon} />
      </div>

      {/* Max members */}
      <div>
        <label
          htmlFor="guild-max-members"
          className="block text-sm font-semibold text-[#2D5A3D]"
        >
          최대 인원
        </label>
        <input
          id="guild-max-members"
          name="max_members"
          type="number"
          inputMode="numeric"
          min={2}
          max={50}
          defaultValue={10}
          className="mt-2 w-full rounded-xl border border-[#D4E4BC] px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-violet-500"
        />
        <p className="mt-1 text-xs text-[#6B6560]">2명 ~ 50명 사이로 정해요</p>
      </div>

      {/* Public toggle */}
      <label className="flex items-start gap-3 rounded-xl border border-[#D4E4BC] bg-[#F8FBF3] p-3">
        <input
          type="checkbox"
          name="is_public"
          defaultChecked
          className="mt-0.5 h-5 w-5 rounded border-[#D4E4BC] text-violet-600 focus:ring-violet-500"
        />
        <span className="text-sm">
          <span className="font-semibold text-[#2D5A3D]">공개 패밀리로 열기</span>
          <br />
          <span className="text-xs text-[#6B6560]">
            다른 다람이가족이 자유롭게 합류할 수 있어요
          </span>
        </span>
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-violet-600 py-3 text-base font-bold text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "만드는 중..." : "🌱 패밀리 만들기"}
      </button>
    </form>
  );
}
