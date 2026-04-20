"use client";

import { useState, use } from "react";
import Link from "next/link";
import { createRewardAction } from "../actions";
import type { RewardType } from "@/lib/supabase/database.types";

const TYPES: { value: RewardType; label: string; desc: string }[] = [
  { value: "POINT", label: "🌰 도토리 누적형", desc: "도토리 N개 이상 모으면 자동 수령" },
  { value: "INSTANT", label: "⚡ 즉시 보상형", desc: "특정 숲길 승인 즉시 수령" },
  { value: "BADGE", label: "🎖️ 뱃지", desc: "특정 숲길 걸음 완료 시 획득" },
  { value: "LOTTERY", label: "🎲 추첨형", desc: "숲길 종료 후 추첨 실행" },
  { value: "RANK", label: "🏆 숲지기 순위형", desc: "숲길 종료 시 상위 등수에게" },
];

export default function NewRewardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const [type, setType] = useState<RewardType>("POINT");

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href={`/admin/events/${eventId}/rewards`} className="text-sm hover:underline">
        ← 보상 목록
      </Link>
      <h1 className="text-2xl font-bold">새 보상</h1>

      <div className="space-y-2">
        <label className="text-sm font-medium">종류</label>
        <div className="grid gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`rounded-lg border p-3 text-left transition ${
                type === t.value ? "border-violet-600 bg-violet-50" : "border-neutral-200"
              }`}
            >
              <div className="font-semibold">{t.label}</div>
              <div className="text-xs">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <form
        action={createRewardAction.bind(null, eventId)}
        className="space-y-4 rounded-lg border bg-white p-6"
      >
        <input type="hidden" name="reward_type" value={type} />

        <Field label="보상 이름" name="name" required placeholder="음료 쿠폰" />
        <Field label="설명 (선택)" name="description" placeholder="시원한 음료 1잔" />
        <Field label="수량 제한 (비우면 무제한)" name="quantity" type="number" />

        {type === "POINT" && (
          <Field
            label="🌰 필요 도토리 수"
            name="threshold"
            type="number"
            required
            defaultValue="50"
          />
        )}

        {(type === "BADGE" || type === "INSTANT") && (
          <Field label="숲길 ID" name="mission_id" required placeholder="mission UUID" />
        )}

        {type === "RANK" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="시작 등수" name="rank_from" type="number" defaultValue="1" />
            <Field label="끝 등수" name="rank_to" type="number" defaultValue="3" />
          </div>
        )}

        {type === "LOTTERY" && (
          <>
            <Field
              label="응모 최소 도토리"
              name="lottery_min_score"
              type="number"
              defaultValue="0"
            />
            <Field label="당첨자 수" name="lottery_winners" type="number" defaultValue="1" />
          </>
        )}

        <button
          type="submit"
          className="w-full rounded-lg bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700"
        >
          만들기
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-violet-500"
      />
    </div>
  );
}
