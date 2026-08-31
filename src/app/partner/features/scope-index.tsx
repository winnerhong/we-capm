"use client";

// 「누구 것을 보고 있나」 — 왼쪽 목차.
//
// 처음엔 알약 한 줄이었다. 기관이 여섯일 때는 됐지만 늘어나면 가로로 흘러
// 스크롤해야 찾을 수 있다 — 찾으려면 이름을 이미 알아야 하는 목록은 목록이 아니다.
//
// 그래서 세로 목차로 바꾸고 **행사 단계로 묶는다**(진행중 → 예정 → 종료 → 보관).
// 기관 자체 상태(활성/휴면)가 아니라 행사 단계인 이유: 기능을 만질 때 위험한 것은
// "계약이 살아 있나" 가 아니라 **"지금 행사가 돌고 있나"** 다. 진행중 기관을
// 건드리면 그 순간 참가자 화면이 바뀐다. 그래서 진행중이 맨 위다.
//
// 검색이 붙어 있는 이유도 같다. 100곳이 되면 묶기만으로는 못 찾는다.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ORG_PHASE_ORDER,
  ORG_PHASE_META,
  type ScopeOption,
} from "@/lib/org-tools/phases";

export function ScopeIndex({
  options,
  current,
}: {
  options: ScopeOption[];
  /** null = 전체 기관 */
  current: string | null;
}) {
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hit = needle
      ? options.filter((o) => o.orgName.toLowerCase().includes(needle))
      : options;
    return ORG_PHASE_ORDER.map((phase) => ({
      phase,
      items: hit.filter((o) => o.phase === phase),
    })).filter((g) => g.items.length > 0);
  }, [options, q]);

  const exceptions = options.filter((o) => o.differsCount > 0).length;
  const found = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="space-y-2">
      {/* 전체 기관 — 묶음 밖에 따로 둔다. 기관 하나가 아니라 방침이라서다. */}
      <Link
        href="/partner/features"
        aria-current={current === null ? "page" : undefined}
        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
          current === null
            ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
            : "border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#E8F0E4]"
        }`}
      >
        <span aria-hidden>🏢</span>
        <span className="flex-1">전체 기관</span>
        {exceptions > 0 && (
          <span
            title={`${exceptions}곳이 전체값과 다르게 설정됨`}
            className={`rounded-full px-1.5 py-0.5 text-[10px] ${
              current === null
                ? "bg-white/20 text-white"
                : "bg-[#FAE7D0] text-[#B5651D]"
            }`}
          >
            예외 {exceptions}
          </span>
        )}
      </Link>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`기관 검색 (${options.length}곳)`}
        aria-label="기관 검색"
        className="w-full rounded-xl border border-[#E8DDC8] bg-[#FDFBF6] px-3 py-2 text-xs text-[#2C2C2C] placeholder:text-[#B5AA9E] focus:border-[#2D5A3D] focus:outline-none"
      />

      {found === 0 && (
        <p className="rounded-xl border border-dashed border-[#E5DDD0] px-3 py-4 text-center text-[11px] text-[#8B7F75]">
          «{q}» 에 맞는 기관이 없어요
        </p>
      )}

      {groups.map((g) => {
        const meta = ORG_PHASE_META[g.phase];
        return (
          <section key={g.phase}>
            <p className="mt-3 mb-1 flex items-center gap-1.5 px-1 text-[10px] font-bold text-[#6B6560]">
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
              />
              {meta.label}
              <span className="font-normal text-[#B5AA9E]">
                {g.items.length}
              </span>
            </p>
            <ul className="space-y-0.5">
              {g.items.map((o) => {
                const on = current === o.orgId;
                return (
                  <li key={o.orgId}>
                    <Link
                      href={`/partner/features?org=${o.orgId}`}
                      aria-current={on ? "page" : undefined}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        on
                          ? "bg-[#E8F0E4] text-[#2D5A3D]"
                          : "text-[#6B6560] hover:bg-[#F5F1E8] hover:text-[#2D5A3D]"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {o.orgName}
                      </span>
                      {/* 전체값과 다른 게 있으면 점 하나. 개수는 툴팁에 —
                          이름이 길어 잘리는 목록에서 숫자까지 넣으면 이름이 진다. */}
                      {o.differsCount > 0 && (
                        <span
                          title={`전체값과 다른 항목 ${o.differsCount}개`}
                          aria-label={`전체값과 다른 항목 ${o.differsCount}개`}
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E08A3C]"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
