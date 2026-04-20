"use client";

import { useState } from "react";
import Link from "next/link";
import { createChallengeAction } from "../actions";

const ICONS = ["🎯", "🌰", "🏆", "🌿", "🌲"];

const GOAL_TYPES: { value: string; label: string; unit: string }[] = [
  { value: "MISSION_COUNT", label: "미션 개수", unit: "개" },
  { value: "ACORN_COUNT", label: "도토리 개수", unit: "개" },
  { value: "STAMP_COUNT", label: "스탬프 개수", unit: "개" },
  { value: "ATTENDANCE", label: "출석 일수", unit: "일" },
];

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function NewChallengeForm({
  events,
}: {
  events: { id: string; name: string }[];
}) {
  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [icon, setIcon] = useState<string>("🎯");
  const [goalType, setGoalType] = useState<string>("MISSION_COUNT");
  const [startsAt, setStartsAt] = useState<string>(toLocalInput(now));
  const [endsAt, setEndsAt] = useState<string>(toLocalInput(weekLater));

  const currentUnit =
    GOAL_TYPES.find((g) => g.value === goalType)?.unit ?? "개";

  return (
    <form
      action={createChallengeAction}
      className="space-y-4 rounded-2xl border border-[#D4E4BC] bg-white p-6"
    >
      <input type="hidden" name="icon" value={icon} />

      {/* 아이콘 선택 */}
      <div>
        <label className="mb-2 block text-sm font-medium text-[#2C2C2C]">
          🎨 아이콘
        </label>
        <div className="flex flex-wrap gap-2">
          {ICONS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIcon(i)}
              aria-pressed={icon === i}
              className={`h-12 w-12 rounded-xl border-2 text-2xl transition-colors ${
                icon === i
                  ? "border-[#2D5A3D] bg-[#E8F0E4]"
                  : "border-[#D4E4BC] bg-white hover:bg-[#FFF8F0]"
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      {/* 제목 */}
      <div>
        <label htmlFor="challenge-title" className="mb-1 block text-sm font-medium text-[#2C2C2C]">
          🌰 챌린지 이름
        </label>
        <input
          id="challenge-title"
          name="title"
          required
          placeholder="예) 4월 벚꽃 도토리 모으기"
          autoComplete="off"
          className="w-full rounded-xl border border-[#D4E4BC] px-3 py-2 outline-none focus:ring-2 focus:ring-[#2D5A3D]"
        />
      </div>

      {/* 설명 */}
      <div>
        <label htmlFor="challenge-desc" className="mb-1 block text-sm font-medium text-[#2C2C2C]">
          📝 설명
        </label>
        <textarea
          id="challenge-desc"
          name="description"
          rows={3}
          placeholder="참가자에게 보여줄 챌린지 소개 문구를 입력하세요"
          className="w-full rounded-xl border border-[#D4E4BC] px-3 py-2 outline-none focus:ring-2 focus:ring-[#2D5A3D]"
        />
      </div>

      {/* 목표 유형 + 값 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label htmlFor="goal-type" className="mb-1 block text-sm font-medium text-[#2C2C2C]">
            🎯 목표 유형
          </label>
          <select
            id="goal-type"
            name="goal_type"
            value={goalType}
            onChange={(e) => setGoalType(e.target.value)}
            className="w-full rounded-xl border border-[#D4E4BC] px-3 py-2 outline-none focus:ring-2 focus:ring-[#2D5A3D] bg-white"
          >
            {GOAL_TYPES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="goal-value" className="mb-1 block text-sm font-medium text-[#2C2C2C]">
            🔢 목표 값 ({currentUnit})
          </label>
          <input
            id="goal-value"
            name="goal_value"
            type="number"
            min={1}
            defaultValue={10}
            required
            inputMode="numeric"
            className="w-full rounded-xl border border-[#D4E4BC] px-3 py-2 outline-none focus:ring-2 focus:ring-[#2D5A3D]"
          />
        </div>
      </div>

      {/* 보상 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label htmlFor="reward-acorns" className="mb-1 block text-sm font-medium text-[#2C2C2C]">
            🌰 보상 도토리
          </label>
          <input
            id="reward-acorns"
            name="reward_acorns"
            type="number"
            min={0}
            defaultValue={10}
            inputMode="numeric"
            className="w-full rounded-xl border border-[#D4E4BC] px-3 py-2 outline-none focus:ring-2 focus:ring-[#2D5A3D]"
          />
        </div>
        <div>
          <label htmlFor="reward-badge" className="mb-1 block text-sm font-medium text-[#2C2C2C]">
            🏆 보상 뱃지 (선택)
          </label>
          <input
            id="reward-badge"
            name="reward_badge"
            placeholder="예) 벚꽃 탐험가"
            autoComplete="off"
            className="w-full rounded-xl border border-[#D4E4BC] px-3 py-2 outline-none focus:ring-2 focus:ring-[#2D5A3D]"
          />
        </div>
      </div>

      {/* 기간 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label htmlFor="starts-at" className="mb-1 block text-sm font-medium text-[#2C2C2C]">
            🌅 시작일
          </label>
          <input
            id="starts-at"
            name="starts_at"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
            className="w-full rounded-xl border border-[#D4E4BC] px-3 py-2 outline-none focus:ring-2 focus:ring-[#2D5A3D]"
          />
        </div>
        <div>
          <label htmlFor="ends-at" className="mb-1 block text-sm font-medium text-[#2C2C2C]">
            🌇 종료일
          </label>
          <input
            id="ends-at"
            name="ends_at"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            required
            className="w-full rounded-xl border border-[#D4E4BC] px-3 py-2 outline-none focus:ring-2 focus:ring-[#2D5A3D]"
          />
        </div>
      </div>

      {/* 행사 연결 */}
      <div>
        <label htmlFor="event-id" className="mb-1 block text-sm font-medium text-[#2C2C2C]">
          🌲 행사 연결 (선택)
        </label>
        <select
          id="event-id"
          name="event_id"
          defaultValue=""
          className="w-full rounded-xl border border-[#D4E4BC] px-3 py-2 outline-none focus:ring-2 focus:ring-[#2D5A3D] bg-white"
        >
          <option value="">전체 행사 (특정 행사 없이 진행)</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[#6B6560]">
          비워두면 모든 행사의 참가자가 대상입니다
        </p>
      </div>

      {/* 제출 */}
      <div className="flex items-center gap-2 pt-2">
        <Link
          href="/admin/challenges"
          className="flex-1 rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-center text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
        >
          취소
        </Link>
        <button
          type="submit"
          className="flex-1 rounded-xl bg-[#2D5A3D] text-white px-4 py-2.5 text-sm font-bold hover:bg-[#3A7A52] transition-colors"
        >
          🌱 챌린지 만들기
        </button>
      </div>
    </form>
  );
}
