import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "../control-room.module.css";

type Props = {
  stamps: ControlRoomSnapshot["stamps"];
  isTvMode: boolean;
};

// 원형 게이지 파라미터
const RADIUS = 32;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function StampsTile({ stamps }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(stamps.avgPackCompletePct)));
  const dashOffset = CIRCUMFERENCE * (1 - pct / 100);
  const isEmpty = stamps.submissionsToday === 0;

  return (
    <div className={`${styles.surface} flex h-full flex-col p-5`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-base" aria-hidden>
          🌱
        </span>
        <h2 className="text-xs font-semibold tracking-[0.15em] text-[#7FA892]">
          오늘의 스탬프
        </h2>
      </div>

      <div>
        <div className="text-[10px] text-[#7FA892]">오늘 제출</div>
        <div
          className={`${styles.neonGreen} font-mono text-5xl font-extrabold leading-none tabular-nums md:text-6xl`}
        >
          {stamps.submissionsToday.toLocaleString("ko-KR")}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center">
        <svg
          width={84}
          height={84}
          viewBox="0 0 80 80"
          role="img"
          aria-label={`평균 완료율 ${pct}퍼센트`}
        >
          <circle
            cx={40}
            cy={40}
            r={RADIUS}
            fill="none"
            strokeWidth={8}
            className={styles.gaugeTrack}
          />
          <circle
            cx={40}
            cy={40}
            r={RADIUS}
            fill="none"
            strokeWidth={8}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 40 40)"
            className={styles.gaugeFill}
          />
          <text
            x={40}
            y={45}
            textAnchor="middle"
            className={styles.neonGreen}
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              fontSize: 16,
              fontWeight: 800,
              fill: "#39FF88",
            }}
          >
            {pct}%
          </text>
        </svg>
      </div>

      <div className="mt-auto pt-2 text-[11px] text-[#7FA892]">
        {isEmpty
          ? "오늘은 아직 조용해요 🌱"
          : `${stamps.participantsSubmittedToday.toLocaleString("ko-KR")}명 참여`}
      </div>
    </div>
  );
}
