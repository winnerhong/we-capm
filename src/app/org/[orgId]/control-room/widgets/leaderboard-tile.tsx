import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "../control-room.module.css";

type Props = {
  items: ControlRoomSnapshot["leaderboard"];
  isTvMode: boolean;
};

// chat-tile.tsx 의 마스킹 규칙 복제 (TV 모드 프라이버시)
function maskName(name: string): string {
  if (!name) return "";
  const parts = name.split(/(\s+)/);
  const head = parts[0] ?? "";
  if (head.length <= 1) {
    parts[0] = "*";
  } else if (head.length === 2) {
    parts[0] = head[0] + "*";
  } else {
    const masked = head
      .split("")
      .map((c, i) => (i === head.length - 2 ? "*" : c))
      .join("");
    parts[0] = masked;
  }
  return parts.join("");
}

// 자녀 이름 목록 "가온·나온" 을 각각 마스킹
function maskChildrenLabel(label: string): string {
  return label
    .split("·")
    .map((n) => maskName(n.trim()))
    .join("·");
}

function rankIcon(rank: number): string {
  if (rank === 1) return "🏆";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
}

function rankLabel(rank: number): string {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

export function LeaderboardTile({ items, isTvMode }: Props) {
  const list = items.slice(0, 10);
  const maxAcorns = list.reduce((m, it) => Math.max(m, it.totalAcorns), 0);

  return (
    <div className={`${styles.surface} flex h-full flex-col p-5`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base" aria-hidden>
          🏆
        </span>
        <h2 className="text-xs font-semibold tracking-[0.15em] text-[#7FA892]">
          순위 · TOP 10
        </h2>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
          <div className="text-5xl" aria-hidden>
            🌱
          </div>
          <div className="text-sm text-[#7FA892]">
            아직 집계된 도토리가 없어요
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((it) => {
            const icon = rankIcon(it.rank);
            const pct =
              maxAcorns > 0
                ? Math.max(2, Math.round((it.totalAcorns / maxAcorns) * 100))
                : 2;
            const isTop3 = it.rank <= 3;
            const name = isTvMode ? maskName(it.displayName) : it.displayName;

            return (
              <li
                key={it.userId}
                className="flex items-center gap-3 rounded-lg border border-[#1f2a24] bg-[#0e1513] px-3 py-2"
              >
                <span
                  className={`w-10 shrink-0 font-mono text-[11px] font-bold tabular-nums ${
                    isTop3 ? styles.neonGreen : "text-[#7FA892]"
                  }`}
                >
                  {rankLabel(it.rank)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {icon && (
                      <span className="shrink-0 text-sm" aria-hidden>
                        {icon}
                      </span>
                    )}
                    <span
                      className={`truncate text-sm font-semibold ${
                        isTop3
                          ? `${styles.neonGreen} ${styles.top3Glow}`
                          : "text-[#e8f0e4]"
                      }`}
                    >
                      {name}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center gap-2">
                    <div
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#111815]"
                      aria-hidden
                    >
                      <div
                        className={styles.rankBar}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {it.childrenLabel && (
                      <span className="shrink-0 truncate text-[10px] text-[#5e7a6c]">
                        └{" "}
                        {isTvMode
                          ? maskChildrenLabel(it.childrenLabel)
                          : it.childrenLabel}
                      </span>
                    )}
                  </div>
                </div>

                <span
                  className={`shrink-0 font-mono text-sm font-bold tabular-nums ${
                    isTop3 ? styles.neonGreen : "text-[#c9c9c9]"
                  }`}
                >
                  {it.totalAcorns.toLocaleString("ko-KR")}🌰
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
