import Link from "next/link";
import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "../control-room.module.css";
import { ServerClock } from "./server-clock";

type Props = {
  snapshot: ControlRoomSnapshot;
  orgId: string;
  isTvMode: boolean;
};

export function HeaderBar({ snapshot, orgId, isTvMode }: Props) {
  const names = snapshot.liveEventNames.slice(0, 2);
  const extra = Math.max(0, snapshot.liveEventCount - names.length);
  const isLive = snapshot.liveEventCount > 0;

  return (
    <div
      className={`${styles.surface} flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-2xl md:text-3xl" aria-hidden>
          🎛️
        </span>
        <div className="min-w-0">
          <div className="text-xs tracking-[0.15em] text-[#7FA892]">
            🎛️ 관제실
          </div>
          <h1 className="truncate text-xl font-extrabold md:text-2xl">
            {snapshot.orgName}
          </h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {isLive ? (
          <div className="flex items-center gap-2 rounded-full border border-[#3a1616] bg-[#1a0a0a] px-3 py-1.5">
            <span
              className={`${styles.liveDot} ${styles.livePulse}`}
              aria-hidden
            />
            <span className="text-xs font-bold text-[#ff5a5a] tracking-widest">
              실시간
            </span>
            <span className={`${styles.neonRed} text-sm font-mono font-bold`}>
              {snapshot.liveEventCount}
            </span>
            <span className="text-xs text-[#c9c9c9]">
              {names.join(" · ")}
              {extra > 0 ? ` 외 ${extra}` : ""}
            </span>
          </div>
        ) : (
          <div className="rounded-full border border-[#1f2a24] bg-[#0e1513] px-3 py-1.5 text-xs text-[#7FA892]">
            진행 중 행사 없음
          </div>
        )}

        <ServerClock serverNowIso={snapshot.serverNowIso} />

        {!isTvMode && (
          <Link
            href={`/org/${orgId}/control-room/tv`}
            className={`rounded-xl border border-[#1f3a3d] bg-[#0e1d1f] px-3 py-2 text-xs font-semibold ${styles.neonCyan} hover:bg-[#12292c]`}
          >
            📺 TV 모드
          </Link>
        )}
        {isTvMode && (
          <Link
            href={`/org/${orgId}/control-room`}
            className="rounded-xl border border-[#1f2a24] bg-[#0e1513] px-3 py-2 text-xs font-semibold text-[#7FA892] hover:bg-[#12201c]"
          >
            ← 관리자 뷰
          </Link>
        )}
      </div>
    </div>
  );
}
