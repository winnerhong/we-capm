import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "../control-room.module.css";
import { AcornIcon } from "@/components/acorn-icon";

type Props = {
  acorns: ControlRoomSnapshot["acorns"];
  isTvMode: boolean;
};

export function AcornsTile({ acorns }: Props) {
  return (
    <div className={`${styles.surface} flex items-center gap-2 px-3 py-2`}>
      <AcornIcon size={14} className={styles.neonAmber} />
      <h2 className="text-[10px] font-semibold tracking-[0.15em] text-[#a8b8d0]">
        오늘의 도토리
      </h2>

      <div className="ml-auto flex items-baseline gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-[9px] text-[#a8b8d0]">지급</span>
          <span
            className={`${styles.neonAmber} font-mono text-xl font-extrabold leading-none tabular-nums`}
          >
            {acorns.awardedToday.toLocaleString("ko-KR")}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[9px] text-[#a8b8d0]">/시간</span>
          <span
            className={`${styles.neonAmber} font-mono text-base font-bold leading-none tabular-nums`}
          >
            {acorns.perHourLast6h.toLocaleString("ko-KR")}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[9px] text-[#a8b8d0]">누적</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-[#cad3e0] leading-none">
            {acorns.awardedAllTime.toLocaleString("ko-KR")}
          </span>
        </div>
      </div>
    </div>
  );
}
