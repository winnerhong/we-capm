import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "../control-room.module.css";

type Props = { snapshot: ControlRoomSnapshot };

function formatRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const fmt = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(
      2,
      "0"
    )}`;
  return `${fmt(s)} - ${fmt(e)}`;
}

export function FmTile({ snapshot }: Props) {
  const { session, recentRequests, totalHeartsToday } = snapshot.fm;
  const requests = recentRequests.slice(0, 8);

  return (
    <div className={`${styles.surface} flex h-full flex-col p-5`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>
            📻
          </span>
          <h2 className="text-xs font-semibold tracking-[0.15em] text-[#7FA892]">
            토리FM
          </h2>
        </div>
        {session?.isLive ? (
          <span className="flex items-center gap-1.5 rounded-full border border-[#3a1616] bg-[#1a0a0a] px-2 py-0.5 text-[10px] font-bold tracking-widest text-[#ff5a5a]">
            <span
              className={`${styles.liveDot} ${styles.livePulse}`}
              aria-hidden
              style={{ width: 6, height: 6 }}
            />
            방송중
          </span>
        ) : session ? (
          <span className="rounded-full border border-[#2a2f1f] bg-[#191a0e] px-2 py-0.5 text-[10px] font-bold tracking-widest text-[#FFC83D]">
            예정
          </span>
        ) : null}
      </div>

      {session ? (
        <div className="mb-3">
          <div className="truncate text-sm font-bold text-[#e8f0e4]">
            {session.name}
          </div>
          <div className="font-mono text-xs text-[#7FA892]">
            {formatRange(session.scheduledStart, session.scheduledEnd)}
          </div>
        </div>
      ) : (
        <div className="mb-3 text-xs text-[#7FA892]">세션 없음</div>
      )}

      <div className="mb-3">
        <div className="text-[10px] text-[#7FA892]">오늘 하트</div>
        <div
          className={`${styles.neonPink} font-mono text-3xl font-extrabold leading-none md:text-4xl`}
        >
          ♥ {totalHeartsToday.toLocaleString("ko-KR")}
        </div>
      </div>

      <div className="mt-auto">
        <div className="mb-1 text-[10px] text-[#7FA892]">신청곡</div>
        {requests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#1f2a24] px-3 py-2 text-xs text-[#7FA892]">
            🌲 아직 신청곡이 없어요
          </div>
        ) : (
          <div className="overflow-hidden">
            <div className={styles.marqueeTrack}>
              {/* 2회 반복해서 seamless loop */}
              {[...requests, ...requests].map((r, i) => (
                <span
                  key={`${r.id}-${i}`}
                  className="inline-flex items-center gap-2 text-xs text-[#e8f0e4]"
                >
                  <span className={styles.neonPink}>♥{r.heartCount}</span>
                  <span className="font-semibold">{r.songTitle}</span>
                  {r.artist && (
                    <span className="text-[#7FA892]">— {r.artist}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
