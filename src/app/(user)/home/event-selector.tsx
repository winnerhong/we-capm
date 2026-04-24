"use client";

// 참가자가 여러 LIVE 행사에 속한 경우의 행사 선택 드롭다운.
// 선택 시 `?event_id=xxx` 쿼리로 리다이렉트해 서버에서 re-render.

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import type { OrgEventRow } from "@/lib/org-events/types";

type Props = {
  events: OrgEventRow[];
  selectedId: string;
};

export function EventSelector({ events, selectedId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <section className="rounded-2xl border border-[#D4E4BC] bg-white/90 p-3 shadow-sm">
      <label
        htmlFor="event-select"
        className="block text-[11px] font-semibold text-[#6B6560]"
      >
        🎪 참여 중인 행사
      </label>
      <select
        id="event-select"
        value={selectedId}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(() => {
            router.push(`${pathname}?event_id=${next}`);
          });
        }}
        className="mt-1 w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm font-semibold text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30 disabled:opacity-60"
      >
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
    </section>
  );
}
