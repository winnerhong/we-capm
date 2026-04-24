import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "../control-room.module.css";
import { OrgPresenceCounter } from "@/components/presence/org-presence-counter";

type Props = { snapshot: ControlRoomSnapshot; orgId: string };

export function ParticipantsTile({ snapshot, orgId }: Props) {
  return (
    <div className={`${styles.surface} flex h-full flex-col p-5`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-base" aria-hidden>
          🧑‍🤝‍🧑
        </span>
        <h2 className="text-xs font-semibold tracking-[0.15em] text-[#7FA892]">
          참가자
        </h2>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3 py-2">
        <OrgPresenceCounter
          orgId={orgId}
          initialFallback={snapshot.todayActiveParticipants}
          render={(liveCount, isLive) => (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] text-[#7FA892]">
                {isLive ? (
                  <>
                    <span
                      className={`${styles.liveDot} ${styles.livePulse}`}
                      aria-hidden
                      style={{ width: 6, height: 6, background: "#39ff88", boxShadow: "0 0 8px rgba(57,255,136,0.8)" }}
                    />
                    <span>지금 접속</span>
                  </>
                ) : (
                  <span>오늘 활동</span>
                )}
              </div>
              <div
                className={`${styles.neonGreen} font-mono text-5xl font-extrabold leading-none md:text-6xl`}
                aria-live="polite"
              >
                {liveCount.toLocaleString("ko-KR")}
              </div>
              {isLive && (
                <div className="mt-1 text-[10px] text-[#7FA892]">
                  오늘 활동 {snapshot.todayActiveParticipants.toLocaleString("ko-KR")}
                </div>
              )}
            </div>
          )}
        />
        <div className={styles.divider} />
        <div>
          <div className="text-[10px] text-[#7FA892]">전체 참가자</div>
          <div className="font-mono text-3xl font-bold text-[#e8f0e4]">
            {snapshot.totalParticipants.toLocaleString("ko-KR")}
          </div>
        </div>
      </div>
    </div>
  );
}
