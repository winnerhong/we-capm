import Link from "next/link";
import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import type { OrgEventStatus } from "@/lib/org-events/types";
import { EventStatusToggle } from "../../events/status-toggle";
import styles from "../control-room.module.css";
import { ServerClock } from "./server-clock";
import { BroadcastInlineLauncher } from "./broadcast-inline-launcher";

/** 헤더 상태 토글에 필요한 대표 행사 정보. */
export type HeaderBarCurrentEvent = {
  id: string;
  name: string;
  status: OrgEventStatus;
  startsAt: string | null;
  endsAt: string | null;
};

type Props = {
  snapshot: ControlRoomSnapshot;
  orgId: string;
  isTvMode: boolean;
  currentEvent?: HeaderBarCurrentEvent | null;
};

export function HeaderBar({
  snapshot,
  orgId,
  isTvMode,
  currentEvent = null,
}: Props) {
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
          <div className="text-xs tracking-[0.15em] text-[#a8b8d0]">
            🎛️ 관제실
          </div>
          <h1 className="truncate text-xl font-extrabold md:text-2xl">
            {snapshot.orgName}
          </h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* 대표 행사 상태 토글 — 예정/진행중/종료/보관 을 관제실에서 바로.
            다크 헤더에 맞게 칩만(bare) — 흰 카드·회색 안내문은 여기선 겉돈다. */}
        {!isTvMode && currentEvent && (
          <div className="flex items-center gap-2.5 rounded-xl border border-[#1a2a52] bg-[#0a1839] py-1.5 pl-3 pr-1.5">
            <span
              className="max-w-[180px] truncate text-xs font-semibold text-[#e5e5e5]"
              title={currentEvent.name}
            >
              📅 {currentEvent.name}
            </span>
            <EventStatusToggle
              eventId={currentEvent.id}
              initialStatus={currentEvent.status}
              startsAt={currentEvent.startsAt}
              endsAt={currentEvent.endsAt}
              variant="bare"
            />
          </div>
        )}
        {isLive ? (
          <div className="flex max-w-full items-center gap-2 whitespace-nowrap rounded-full border border-[#3a1616] bg-[#1a0a0a] py-1.5 pl-3 pr-4">
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
            <span className="text-[13px] font-medium leading-snug tracking-tight text-[#e5e5e5]">
              {names.join(" · ")}
              {extra > 0 ? ` 외 ${extra}` : ""}
            </span>
          </div>
        ) : (
          <div className="rounded-full border border-[#1a2a52] bg-[#0a1839] px-3 py-1.5 text-xs text-[#a8b8d0]">
            진행 중 행사 없음
          </div>
        )}

        <ServerClock serverNowIso={snapshot.serverNowIso} />

        {!isTvMode && (
          <>
            <BroadcastInlineLauncher orgId={orgId} />
            <Link
              href={`/org/${orgId}/control-room/tv`}
              className={`rounded-xl border border-[#1a2a52] bg-[#0a1839] px-3 py-2 text-xs font-semibold ${styles.neonCyan} hover:bg-[#12244a]`}
            >
              📺 TV 모드
            </Link>
          </>
        )}
        {isTvMode && (
          <Link
            href={`/org/${orgId}/control-room`}
            className="rounded-xl border border-[#1a2a52] bg-[#0a1839] px-3 py-2 text-xs font-semibold text-[#a8b8d0] hover:bg-[#12201c]"
          >
            ← 관리자 뷰
          </Link>
        )}
      </div>
    </div>
  );
}
