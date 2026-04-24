import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "../control-room.module.css";

type Props = {
  acorns: ControlRoomSnapshot["acorns"];
  isTvMode: boolean;
};

export function AcornsTile({ acorns }: Props) {
  return (
    <div className={`${styles.surface} flex h-full flex-col p-5`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-base" aria-hidden>
          🌰
        </span>
        <h2 className="text-xs font-semibold tracking-[0.15em] text-[#7FA892]">
          오늘의 도토리
        </h2>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3 py-2">
        <div>
          <div className="text-[10px] text-[#7FA892]">오늘 지급</div>
          <div
            className={`${styles.neonAmber} flex items-end gap-1 font-mono text-5xl font-extrabold leading-none tabular-nums md:text-6xl`}
          >
            <span>{acorns.awardedToday.toLocaleString("ko-KR")}</span>
            <span className={`${styles.acornPour} text-2xl md:text-3xl`} aria-hidden>
              🌰
            </span>
          </div>
        </div>

        <div className="font-mono text-sm text-[#e8f0e4]">
          <span className={styles.neonAmber}>
            {acorns.perHourLast6h.toLocaleString("ko-KR")}
          </span>
          <span className="ml-1 text-[#7FA892]">/시간</span>
        </div>
      </div>

      <div className={styles.divider} />
      <div className="pt-2 text-[11px] text-[#7FA892]">
        누적{" "}
        <span className="font-mono font-semibold tabular-nums text-[#c9c9c9]">
          {acorns.awardedAllTime.toLocaleString("ko-KR")}
        </span>
      </div>
    </div>
  );
}
