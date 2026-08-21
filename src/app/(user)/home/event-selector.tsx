"use client";

// 참가자가 여러 행사에 속한 경우의 행사 선택 드롭다운.
//
// 행사 선택 = 기관 전환. 두 기관에 다니는 보호자는 행사가 곧 기관이라,
// 별도 기관 스위처를 두지 않고 이 선택기 하나로 컨텍스트를 옮긴다.
//
// `?event_id=` 로 바로 가지 않고 /api/user/enter-event 를 경유하는 이유:
// 홈·스탬프북·미션·토리FM 이 전부 세션 쿠키의 orgId 를 컨텍스트로 읽는데,
// Server Component 렌더 중에는 쿠키를 쓸 수 없다. 라우트 핸들러가 활성 기관을
// 바꾼 뒤 /home?event_id= 로 되돌려준다.

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { OrgEventRow } from "@/lib/org-events/types";

type Props = {
  events: OrgEventRow[];
  selectedId: string;
  /** orgId → 기관명. 행사가 두 기관 이상에 걸쳐 있을 때만 라벨에 붙는다. */
  orgNames?: Record<string, string>;
};

export function EventSelector({ events, selectedId, orgNames }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 여러 기관에 걸쳐 있으면 어느 기관 행사인지 구분이 필요하다.
  const multiOrg = new Set(events.map((e) => e.org_id)).size > 1;

  return (
    <section className="rounded-2xl border border-[#D4E4BC] bg-white/90 p-3 shadow-sm">
      <label
        htmlFor="event-select"
        className="block text-[11px] font-semibold text-[#6B6560]"
      >
        {multiOrg ? "🎪 참여 중인 행사 · 기관" : "🎪 참여 중인 행사"}
      </label>
      <select
        id="event-select"
        value={selectedId}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(() => {
            router.push(`/api/user/enter-event?event_id=${next}`);
          });
        }}
        className="mt-1 w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm font-semibold text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30 disabled:opacity-60"
      >
        {events.map((e) => {
          const org = multiOrg ? orgNames?.[e.org_id] : "";
          return (
            <option key={e.id} value={e.id}>
              {org ? `[${org}] ${e.name}` : e.name}
            </option>
          );
        })}
      </select>
      {multiOrg && (
        <p className="mt-1.5 text-[10px] text-[#8B7F75]">
          행사를 고르면 그 기관 화면으로 바뀌어요
        </p>
      )}
    </section>
  );
}
