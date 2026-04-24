import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "../control-room.module.css";

type Props = {
  items: ControlRoomSnapshot["activityFeed"];
  isTvMode: boolean;
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

export function ActivityFeedTile({ items, isTvMode }: Props) {
  const limit = isTvMode ? 25 : 18;
  const list = items.slice(0, limit);

  return (
    <div className={`${styles.surface} flex h-full flex-col p-5`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base" aria-hidden>
          🌱
        </span>
        <h2 className="text-xs font-semibold tracking-[0.15em] text-[#7FA892]">
          실시간 피드
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
            오늘 아직 스탬프가 찍히지 않았어요
          </div>
        </div>
      ) : (
        <div className={styles.feedMask}>
          <ul className="flex flex-col">
            {list.map((it) => (
              <li
                key={it.id}
                className={`${styles.scanLine} flex h-[44px] items-center gap-2 border-b border-[#1a2320] px-1 font-mono text-xs md:text-sm`}
              >
                <span className="shrink-0 text-lg" aria-hidden>
                  {it.missionIcon ?? "🌱"}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold text-[#e8f0e4]">
                    {it.userDisplayName}
                  </span>
                  <span className="mx-1 text-[#4e6659]">·</span>
                  <span className="text-[#c9c9c9]">{it.missionTitle}</span>
                </span>
                <span
                  className={`${styles.neonAmber} shrink-0 font-semibold tabular-nums`}
                >
                  +{it.acornsAwarded.toLocaleString("ko-KR")}🌰
                </span>
                <span className="shrink-0 tabular-nums text-[#7FA892]">
                  {formatTime(it.submittedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
