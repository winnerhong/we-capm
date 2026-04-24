import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "../control-room.module.css";

type Props = { snapshot: ControlRoomSnapshot };

function elapsedLabel(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime();
  const min = Math.max(0, Math.floor((nowMs - t) / 60000));
  if (min < 60) return `${min}분`;
  const hr = Math.floor(min / 60);
  const rm = min % 60;
  return rm ? `${hr}시간 ${rm}분` : `${hr}시간`;
}

function oldestColor(min: number | null): string {
  if (min === null) return "#7FA892";
  if (min >= 30) return "#FF4D8A";
  if (min >= 10) return "#FFC83D";
  return "#39FF88";
}

export function PendingTile({ snapshot }: Props) {
  const { total, oldestWaitingMinutes, items } = snapshot.pending;
  const list = items.slice(0, 5);
  const now = new Date(snapshot.serverNowIso).getTime();
  const oldestHex = oldestColor(oldestWaitingMinutes);

  return (
    <div className={`${styles.surface} flex h-full flex-col p-5`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base" aria-hidden>
          ⏳
        </span>
        <h2 className="text-xs font-semibold tracking-[0.15em] text-[#7FA892]">
          검토 대기
        </h2>
      </div>

      {total === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <div className="text-5xl" aria-hidden>
            🎉
          </div>
          <div className={`${styles.neonGreen} text-lg font-bold`}>
            검토 대기 없음
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-end gap-6">
            <div>
              <div className="text-[10px] text-[#7FA892]">대기 건수</div>
              <div
                className={`${styles.neonAmber} font-mono text-5xl font-extrabold leading-none md:text-6xl`}
              >
                {total.toLocaleString("ko-KR")}
              </div>
            </div>
            {oldestWaitingMinutes !== null && (
              <div>
                <div className="text-[10px] text-[#7FA892]">최장 대기</div>
                <div
                  className="font-mono text-2xl font-bold leading-none"
                  style={{
                    color: oldestHex,
                    filter: `drop-shadow(0 0 6px ${oldestHex}66)`,
                  }}
                >
                  {oldestWaitingMinutes}분
                </div>
              </div>
            )}
          </div>

          <ul className="flex flex-col gap-2 overflow-hidden">
            {list.map((it) => (
              <li
                key={it.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-[#1f2a24] bg-[#0e1513] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[#e8f0e4]">
                    {it.missionTitle}
                  </div>
                  <div className="truncate text-[11px] text-[#7FA892]">
                    {it.submitterName}
                    {it.packName ? ` · ${it.packName}` : ""}
                  </div>
                </div>
                <div className="shrink-0 font-mono text-xs font-bold text-[#FFC83D]">
                  {elapsedLabel(it.submittedAt, now)}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
