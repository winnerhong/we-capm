import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "../control-room.module.css";

type Props = {
  acorns: ControlRoomSnapshot["acorns"];
  isTvMode: boolean;
};

export function AcornsTile({ acorns }: Props) {
  return (
    <div className={`${styles.surface} flex flex-col p-3`}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-sm" aria-hidden>
          🌰
        </span>
        <h2 className="text-[10px] font-semibold tracking-[0.15em] text-[#a8b8d0]">
          오늘의 도토리
        </h2>
      </div>

      <div className="flex items-baseline gap-3">
        <div className="flex flex-col">
          <span className="text-[9px] text-[#a8b8d0]">오늘 지급</span>
          <span
            className={`${styles.neonAmber} font-mono text-3xl font-extrabold leading-none tabular-nums`}
          >
            {acorns.awardedToday.toLocaleString("ko-KR")}
          </span>
        </div>
        <div className="ml-auto flex flex-col text-right">
          <span className="text-[9px] text-[#a8b8d0]">/시간</span>
          <span
            className={`${styles.neonAmber} font-mono text-lg font-bold leading-none tabular-nums`}
          >
            {acorns.perHourLast6h.toLocaleString("ko-KR")}
          </span>
        </div>
      </div>

      <div className="mt-1.5 text-[10px] text-[#a8b8d0]">
        누적{" "}
        <span className="font-mono font-semibold tabular-nums text-[#cad3e0]">
          {acorns.awardedAllTime.toLocaleString("ko-KR")}
        </span>
      </div>
    </div>
  );
}
