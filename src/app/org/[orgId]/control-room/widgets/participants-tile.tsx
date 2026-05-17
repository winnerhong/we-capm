"use client";

// 'use client' 필요: OrgPresenceCounter 가 render-prop(함수) API 라서
// 부모도 client 여야 함수가 server→client 경계를 넘지 않는다.

import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "../control-room.module.css";
import { OrgPresenceCounter } from "@/components/presence/org-presence-counter";

type Props = { snapshot: ControlRoomSnapshot; orgId: string };

export function ParticipantsTile({ snapshot, orgId }: Props) {
  return (
    <div className={`${styles.surface} flex items-center gap-2 px-3 py-2`}>
      <span className="text-sm" aria-hidden>
        🧑‍🤝‍🧑
      </span>
      <h2 className="text-[10px] font-semibold tracking-[0.15em] text-[#a8b8d0]">
        참가자
      </h2>

      <OrgPresenceCounter
        orgId={orgId}
        initialFallback={snapshot.todayActiveParticipants}
        render={(liveCount, isLive) => (
          <div className="ml-auto flex items-baseline gap-3">
            <div className="flex items-baseline gap-1">
              <span className="flex items-center gap-0.5 text-[9px] text-[#a8b8d0]">
                {isLive ? (
                  <>
                    <span
                      className={`${styles.liveDot} ${styles.livePulse}`}
                      aria-hidden
                      style={{
                        width: 5,
                        height: 5,
                        background: "#6ee7b7",
                        boxShadow: "0 0 6px rgba(110,231,183,0.8)",
                      }}
                    />
                    <span>접속</span>
                  </>
                ) : (
                  <span>오늘</span>
                )}
              </span>
              <span
                className={`${styles.neonGreen} font-mono text-xl font-extrabold leading-none`}
                aria-live="polite"
              >
                {liveCount.toLocaleString("ko-KR")}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[9px] text-[#a8b8d0]">전체</span>
              <span className="font-mono text-base font-bold text-[#f4ecd8] leading-none">
                {snapshot.totalParticipants.toLocaleString("ko-KR")}
              </span>
            </div>
          </div>
        )}
      />
    </div>
  );
}
