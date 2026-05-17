import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "../control-room.module.css";

type Props = {
  stamps: ControlRoomSnapshot["stamps"];
  isTvMode: boolean;
};

// 원형 게이지 파라미터 — 컴팩트 모드용 작은 사이즈
const RADIUS = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function StampsTile({ stamps }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(stamps.avgPackCompletePct)));
  const dashOffset = CIRCUMFERENCE * (1 - pct / 100);
  const isEmpty = stamps.submissionsToday === 0;

  return (
    <div className={`${styles.surface} flex items-center gap-2 px-3 py-2`}>
      <span className="text-sm" aria-hidden>
        🌱
      </span>
      <h2 className="text-[10px] font-semibold tracking-[0.15em] text-[#a8b8d0]">
        오늘의 스탬프
      </h2>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-[9px] text-[#a8b8d0]">제출</span>
          <span
            className={`${styles.neonGreen} font-mono text-xl font-extrabold leading-none tabular-nums`}
          >
            {stamps.submissionsToday.toLocaleString("ko-KR")}
          </span>
        </div>
        {!isEmpty && (
          <span className="text-[10px] text-[#a8b8d0]">
            {stamps.participantsSubmittedToday.toLocaleString("ko-KR")}명
          </span>
        )}

        {/* 작은 원형 게이지 */}
        <svg
          width={40}
          height={40}
          viewBox="0 0 40 40"
          role="img"
          aria-label={`평균 완료율 ${pct}퍼센트`}
        >
          <circle
            cx={20}
            cy={20}
            r={RADIUS}
            fill="none"
            strokeWidth={4}
            className={styles.gaugeTrack}
          />
          <circle
            cx={20}
            cy={20}
            r={RADIUS}
            fill="none"
            strokeWidth={4}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 20 20)"
            className={styles.gaugeFill}
          />
          <text
            x={20}
            y={24}
            textAnchor="middle"
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              fontSize: 10,
              fontWeight: 800,
              fill: "#ffc83d",
            }}
          >
            {pct}%
          </text>
        </svg>
      </div>
    </div>
  );
}
