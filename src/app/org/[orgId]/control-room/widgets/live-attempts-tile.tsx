import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "../control-room.module.css";

type Props = {
  live: ControlRoomSnapshot["live"];
  isTvMode: boolean;
};

/**
 * 🔴 라이브 수행 — "지금 누가 어떤 미션 수행 중" 카드.
 * - last_seen_at 신선 + 미완료인 mission_attempts 기반.
 * - 10분 이상 정체된 가족은 ⚠ 강조 (도움 필요).
 */
export function LiveAttemptsTile({ live, isTvMode }: Props) {
  const { attempts, stuckCount, activeFamilies } = live;
  // 정체된 가족 우선 정렬.
  const sorted = attempts
    .slice()
    .sort((a, b) => {
      if (a.stuck !== b.stuck) return a.stuck ? -1 : 1;
      return b.elapsedMinutes - a.elapsedMinutes;
    });
  const limit = isTvMode ? 18 : 10;
  const list = sorted.slice(0, limit);

  return (
    <div className={`${styles.surface} flex flex-col p-4`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base" aria-hidden>
          🔴
        </span>
        <h2 className="text-xs font-semibold tracking-[0.15em] text-[#a8b8d0]">
          라이브 수행
        </h2>
        <span className="ml-2 font-mono text-xs text-[#a8b8d0]">
          {activeFamilies}가족
        </span>
        {stuckCount > 0 && (
          <span className="ml-auto rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300 ring-1 ring-rose-500/40">
            ⚠ 정체 {stuckCount}
          </span>
        )}
      </div>

      {list.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
          <div className="text-5xl" aria-hidden>
            🌿
          </div>
          <div className="text-sm text-[#a8b8d0]">
            지금 수행 중인 미션이 없어요
          </div>
          <div className="text-[10px] text-[#7a8aa8]">
            (참가자가 미션 페이지를 열면 3분 이내 표시)
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {list.map((a) => (
            <li
              key={a.attemptId}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                a.stuck
                  ? "border-rose-500/40 bg-rose-500/10"
                  : "border-[#1a2a52] bg-[#0a1839]"
              }`}
            >
              <span className="shrink-0 text-lg" aria-hidden>
                {a.missionIcon ?? "🌱"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-[#f4ecd8]">
                  {a.userDisplayName}
                </div>
                <div className="truncate text-[11px] text-[#cad3e0]">
                  {a.missionTitle}
                </div>
              </div>
              <span
                className={`shrink-0 font-mono text-xs tabular-nums ${
                  a.stuck ? "text-rose-300" : "text-[#a8b8d0]"
                }`}
                title={`opened: ${a.openedAt}`}
              >
                {a.stuck ? "⚠ " : ""}
                {a.elapsedMinutes < 1 ? "방금" : `${a.elapsedMinutes}분`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {stuckCount > 0 && list.length > 0 && (
        <p className="mt-3 rounded border border-rose-500/30 bg-rose-500/5 px-2 py-1.5 text-[10px] text-rose-300">
          ⚠ <b>{stuckCount}가족</b>이 10분 이상 진행 중이에요 — 도움이 필요할 수
          있어요.
        </p>
      )}
    </div>
  );
}
