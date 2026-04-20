"use client";

import { useTransition } from "react";

type Option = { value: string; label: string };

interface Props {
  companyId: string;
  options: Option[];
  onChangeAction: (id: string, stage: string) => Promise<void>;
}

export function StageSelect({ companyId, options, onChangeAction }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="block">
      <span className="sr-only">단계 이동</span>
      <select
        name="stage"
        defaultValue=""
        disabled={isPending}
        onChange={(e) => {
          const next = e.currentTarget.value;
          if (!next) return;
          startTransition(async () => {
            await onChangeAction(companyId, next);
          });
          e.currentTarget.value = "";
        }}
        className="w-full rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] px-2 py-1 text-[11px] text-[#1E3A5F] focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30 disabled:opacity-50"
        aria-label="파이프라인 단계 이동"
      >
        <option value="">{isPending ? "⏳ 이동중..." : "➡️ 단계 이동..."}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
