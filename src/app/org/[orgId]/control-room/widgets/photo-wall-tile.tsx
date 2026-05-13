import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import { fmtClockKstAlways } from "@/lib/datetime/kst";
import styles from "../control-room.module.css";

type Props = {
  items: ControlRoomSnapshot["photoWall"];
  isTvMode: boolean;
};

/**
 * 📸 사진 월 — 최근 제출된 사진을 갤러리로 표시.
 * - 행사 진행 중 운영자가 한눈에 "지금 어떤 사진들이 올라오고 있나" 볼 수 있게.
 * - 각 사진 hover/tap 시 미션·가족·시각 메타정보 노출.
 * - TV 모드: 더 큰 그리드.
 */
export function PhotoWallTile({ items, isTvMode }: Props) {
  const limit = isTvMode ? 18 : 12;
  const list = items.slice(0, limit);

  return (
    <div className={`${styles.surface} flex h-full flex-col p-5`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base" aria-hidden>
          📸
        </span>
        <h2 className="text-xs font-semibold tracking-[0.15em] text-[#7FA892]">
          사진 월
        </h2>
        <span className="ml-auto font-mono text-xs text-[#7FA892]">
          {items.length}
        </span>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
          <div className="text-5xl" aria-hidden>
            🌲
          </div>
          <div className="text-sm text-[#7FA892]">
            아직 올라온 사진이 없어요
          </div>
        </div>
      ) : (
        <ul
          className={`grid gap-1.5 ${
            isTvMode ? "grid-cols-6" : "grid-cols-3 md:grid-cols-4"
          }`}
        >
          {list.map((p) => (
            <li
              key={p.submissionId}
              className="group relative aspect-square overflow-hidden rounded-md border border-[#1f2a24] bg-[#0e1513]"
              title={`${p.userDisplayName} · ${p.missionTitle} · ${fmtClockKstAlways(p.submittedAt)}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.missionTitle}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
              {/* hover/tap overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="truncate text-[10px] font-bold text-[#e8f0e4]">
                  {p.missionIcon ?? "📷"} {p.missionTitle}
                </div>
                <div className="truncate text-[9px] text-[#a8c3b3]">
                  {p.userDisplayName}
                </div>
                <div className="font-mono text-[9px] text-[#7FA892]">
                  {fmtClockKstAlways(p.submittedAt)}
                </div>
              </div>
              {p.status === "PENDING_REVIEW" && (
                <span className="absolute right-1 top-1 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[8px] font-bold text-white">
                  검수
                </span>
              )}
              {p.status === "REJECTED" && (
                <span className="absolute right-1 top-1 rounded-full bg-rose-500/90 px-1.5 py-0.5 text-[8px] font-bold text-white">
                  반려
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
