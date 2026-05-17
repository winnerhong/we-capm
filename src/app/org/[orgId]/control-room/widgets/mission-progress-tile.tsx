import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "../control-room.module.css";

type Props = {
  items: ControlRoomSnapshot["missionProgress"];
  isTvMode: boolean;
};

const KIND_LABEL: Record<string, string> = {
  PHOTO: "사진",
  PHOTO_APPROVAL: "사진검수",
  QR_QUIZ: "QR퀴즈",
  TREASURE: "보물찾기",
  RADIO: "라디오",
  COOP: "협동",
  BROADCAST: "돌발",
  FINAL_REWARD: "최종보상",
};

/**
 * 🎯 미션별 진행률 — 각 미션마다 완료/대기/거부 카운트와 완료%.
 * 운영자가 "어느 미션이 막혔는지 / 인기 미션인지" 한눈에 본다.
 */
export function MissionProgressTile({ items, isTvMode }: Props) {
  // 완료% 높은 순.
  const sorted = items.slice().sort((a, b) => b.completionPct - a.completionPct);

  return (
    <div className={`${styles.surface} flex flex-col p-4`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base" aria-hidden>
          🎯
        </span>
        <h2 className="text-xs font-semibold tracking-[0.15em] text-[#a8b8d0]">
          미션별 진행률
        </h2>
        <span className="ml-auto font-mono text-xs text-[#a8b8d0]">
          {items.length}
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="py-1 text-[12px] text-[#a8b8d0]">
          🌱 활성 미션이 없어요
        </div>
      ) : (
        <ul
          className={`scroll-dark flex flex-col gap-2 overflow-y-auto pr-1 ${
            isTvMode ? "max-h-none" : "max-h-[420px]"
          }`}
        >
          {sorted.map((m) => {
            const kindLabel = KIND_LABEL[m.kind] ?? m.kind;
            const notStarted = Math.max(
              0,
              m.totalParticipants - m.completedCount - m.pendingCount
            );
            return (
              <li
                key={m.missionId}
                className="rounded-lg border border-[#1a2a52] bg-[#0a1839] p-3"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-base" aria-hidden>
                    {m.icon ?? "🌱"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#f4ecd8]">
                    {m.title}
                  </span>
                  <span className="shrink-0 rounded-full bg-[#16234a] px-1.5 py-0.5 text-[9px] font-bold text-[#a8b8d0]">
                    {kindLabel}
                  </span>
                  <span
                    className={`shrink-0 font-mono text-sm font-bold tabular-nums ${styles.neonGreen}`}
                  >
                    {m.completionPct}%
                  </span>
                </div>

                {/* progress bar */}
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#111815]"
                  aria-hidden
                >
                  <div
                    className={styles.rankBar}
                    style={{ width: `${Math.max(2, m.completionPct)}%` }}
                  />
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px]">
                  <span className={styles.neonGreen}>
                    ✓ 완료 {m.completedCount}
                  </span>
                  {m.pendingCount > 0 && (
                    <span className="text-amber-400">
                      ⏳ 검수 {m.pendingCount}
                    </span>
                  )}
                  {m.rejectedCount > 0 && (
                    <span className="text-rose-400">
                      ✕ 반려 {m.rejectedCount}
                    </span>
                  )}
                  <span className="text-[#7a8aa8]">
                    · 미시작 {notStarted}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
