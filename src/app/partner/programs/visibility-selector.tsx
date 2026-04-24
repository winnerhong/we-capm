"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  VISIBILITY_META,
  VISIBILITY_OPTIONS,
  type ProgramVisibility,
} from "@/lib/partner-programs/types";
import { updateProgramVisibilityAction } from "./actions";

interface Props {
  programId: string;
  currentVisibility: ProgramVisibility;
}

export function VisibilitySelector({ programId, currentVisibility }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as ProgramVisibility;
    if (next === currentVisibility) return;
    startTransition(async () => {
      try {
        await updateProgramVisibilityAction(programId, next);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "변경 실패");
      }
    });
  };

  const meta = VISIBILITY_META[currentVisibility];

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}
        aria-label="현재 공개 범위"
      >
        {meta.icon} {meta.label}
      </span>
      <select
        value={currentVisibility}
        onChange={handleChange}
        disabled={pending}
        className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-1 text-xs font-semibold text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20 disabled:opacity-50"
        aria-label="공개 범위 변경"
      >
        {VISIBILITY_OPTIONS.map((v) => (
          <option key={v} value={v}>
            {VISIBILITY_META[v].icon} {VISIBILITY_META[v].label}
          </option>
        ))}
      </select>
    </div>
  );
}
