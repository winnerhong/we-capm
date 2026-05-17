// 도토리 잔액 TOP N 가족 리더보드 — 참가자 홈/스탬프북/라디오 상단 공용.
// 서버에서 loadTopAcornFamilies 호출 후 결과만 prop 으로 전달.

import { AcornIcon } from "@/components/acorn-icon";
import type { TopAcornFamily } from "@/lib/app-user/queries";

interface Props {
  families: TopAcornFamily[];
  myUserId: string;
  orgName: string;
}

export function AcornTopBoard({ families, myUserId, orgName }: Props) {
  if (families.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-3xl border border-[#E5D3B8] bg-gradient-to-br from-[#FFFDF8] to-[#FFF6E5] p-4 shadow-sm">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-[#6B4423]">
          <span aria-hidden>🏆</span>
          <span className="truncate">{orgName} TOP 5</span>
        </h2>
        <span className="shrink-0 text-[10px] font-semibold text-[#8B6F47]">
          실시간 기준
        </span>
      </header>
      <ol className="space-y-1.5">
        {families.map((f) => {
          const isMe = f.userId === myUserId;
          const medal =
            f.rank === 1 ? "🥇" : f.rank === 2 ? "🥈" : f.rank === 3 ? "🥉" : null;
          return (
            <li
              key={f.userId}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                isMe
                  ? "bg-gradient-to-r from-[#FFE9B3] to-[#FFD98A] ring-1 ring-[#E5B86A]"
                  : "bg-white/70"
              }`}
            >
              <span
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  medal
                    ? "bg-transparent text-base"
                    : "bg-[#E5D3B8] text-[#6B4423]"
                }`}
                aria-label={`${f.rank}위`}
              >
                {medal ?? f.rank}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  isMe ? "font-bold text-[#6B4423]" : "font-semibold text-[#2D5A3D]"
                }`}
              >
                {f.familyLabel}
                {isMe && (
                  <span className="ml-1 text-[10px] text-[#8B6F47]">(나)</span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums text-[#6B4423]">
                <AcornIcon size={14} />
                {f.acorns}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
