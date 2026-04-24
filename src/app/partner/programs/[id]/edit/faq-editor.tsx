"use client";

import { useMemo, useState } from "react";
import type { FaqItem } from "@/lib/partner-programs/types";

interface Props {
  name?: string;
  defaultValue?: FaqItem[];
}

export function FaqEditor({ name = "faq", defaultValue = [] }: Props) {
  const [items, setItems] = useState<FaqItem[]>(defaultValue);

  const hiddenValue = useMemo(
    () =>
      JSON.stringify(
        items
          .map((it) => ({ q: it.q.trim(), a: it.a.trim() }))
          .filter((it) => it.q || it.a)
      ),
    [items]
  );

  const update = (idx: number, patch: Partial<FaqItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const remove = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const add = () => {
    setItems((prev) => [...prev, { q: "", a: "" }]);
  };

  return (
    <div>
      <input type="hidden" name={name} value={hiddenValue} />

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-3 py-4 text-center text-xs text-[#8B7F75]">
          FAQ가 없습니다. 아래 버튼으로 자주 묻는 질문을 추가하세요.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((it, idx) => (
            <li
              key={idx}
              className="rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3"
            >
              <div className="flex items-start gap-2">
                <div className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#C4956A] text-[10px] font-bold text-white">
                  Q{idx + 1}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={it.q}
                    onChange={(e) => update(idx, { q: e.target.value })}
                    placeholder="질문 (예: 우천 시에도 진행하나요?)"
                    aria-label={`FAQ ${idx + 1} 질문`}
                    className="w-full rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#2D5A3D] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
                  />
                  <textarea
                    value={it.a}
                    onChange={(e) => update(idx, { a: e.target.value })}
                    rows={3}
                    placeholder="답변"
                    aria-label={`FAQ ${idx + 1} 답변`}
                    className="w-full rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1.5 text-xs text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  aria-label={`FAQ ${idx + 1} 삭제`}
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
        <span>Q&amp;A 추가</span>
      </button>
    </div>
  );
}
