"use client";

import { useMemo, useState } from "react";
import type { ScheduleItem } from "@/lib/partner-programs/types";

interface Props {
  name?: string;
  defaultValue?: ScheduleItem[];
}

export function ScheduleEditor({
  name = "schedule_items",
  defaultValue = [],
}: Props) {
  const [items, setItems] = useState<ScheduleItem[]>(
    defaultValue.length > 0 ? defaultValue : []
  );

  const hiddenValue = useMemo(
    () =>
      JSON.stringify(
        items
          .map((it) => ({
            time: it.time.trim(),
            title: it.title.trim(),
            desc: it.desc?.trim() || undefined,
          }))
          .filter((it) => it.time || it.title)
      ),
    [items]
  );

  const update = (idx: number, patch: Partial<ScheduleItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const remove = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const add = () => {
    setItems((prev) => [...prev, { time: "", title: "", desc: "" }]);
  };

  return (
    <div>
      <input type="hidden" name={name} value={hiddenValue} />

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-3 py-4 text-center text-xs text-[#8B7F75]">
          일정 항목이 없습니다. 아래 버튼으로 추가하세요.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, idx) => (
            <li
              key={idx}
              className="rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3"
            >
              <div className="flex items-start gap-2">
                <div className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#2D5A3D] text-[10px] font-bold text-white">
                  {idx + 1}
                </div>
                <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-[120px_1fr]">
                  <input
                    type="text"
                    value={it.time}
                    onChange={(e) => update(idx, { time: e.target.value })}
                    placeholder="10:00 또는 10:00-10:30"
                    aria-label={`일정 ${idx + 1} 시간`}
                    className="rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1.5 text-xs text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
                  />
                  <input
                    type="text"
                    value={it.title}
                    onChange={(e) => update(idx, { title: e.target.value })}
                    placeholder="제목 (예: 오리엔테이션)"
                    aria-label={`일정 ${idx + 1} 제목`}
                    className="rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1.5 text-xs text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
                  />
                  <input
                    type="text"
                    value={it.desc ?? ""}
                    onChange={(e) => update(idx, { desc: e.target.value })}
                    placeholder="설명 (선택)"
                    aria-label={`일정 ${idx + 1} 설명`}
                    className="rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1.5 text-xs text-[#6B6560] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30 md:col-span-2"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  aria-label={`일정 ${idx + 1} 삭제`}
                  className="flex-none rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={add}
        className="mt-3 inline-flex items-center gap-1 rounded-xl border border-dashed border-[#2D5A3D]/40 bg-white px-3 py-2 text-xs font-semibold text-[#2D5A3D] hover:border-[#2D5A3D] hover:bg-[#E8F0E4]"
      >
        <span aria-hidden>➕</span>
        <span>항목 추가</span>
      </button>
    </div>
  );
}
