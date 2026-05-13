import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "../control-room.module.css";

type Props = {
  stamps: ControlRoomSnapshot["stamps"];
  isTvMode: boolean;
};

// 원형 게이지 파라미터 — 컴팩트 모드용 작은 사이즈
const RADIUS = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function StampsTile({ stamps }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(stamps.avgPackCompletePct)));
  const dashOffset = CIRCUMFERENCE * (1 - pct / 100);
  const isEmpty = stamps.submissionsToday === 0;

  return (
    <div className={`${styles.surface} flex flex-col p-3`}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-sm" aria-hidden>
          🌱
        </span>
        <h2 className="text-[10px] font-semibold tracking-[0.15em] text-[#a8b8d0]">
          오늘의 스탬프
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-[9px] text-[#a8b8d0]">오늘 제출</span>
          <span
            className={`${styles.neonGreen} font-mono text-3xl font-extrabold leading-none tabular-nums`}
          >
            {stamps.submissionsToday.toLocaleString("ko-KR")}
          </span>
        </div>

        {/* 작은 원형 게이지 — 우측 정렬 */}
        <div className="ml-auto">
          <svg
            width={56}
            height={56}
            viewBox="0 0 56 56"
            role="img"
            aria-label={`평균 완료율 ${pct}퍼센트`}
          >
            <circle
              cx={28}
              cy={28}
              r={RADIUS}
              fill="none"
              strokeWidth={5}
              className={styles.gaugeTrack}
            />
            <circle
              cx={28}
              cy={28}
              r={RADIUS}
              fill="none"
              strokeWidth={5}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform="rotate(-90 28 28)"
              className={styles.gaugeFill}
            />
            <text
              x={28}
              y={32}
              textAnchor="middle"
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: 12,
                fontWeight: 800,
                fill: "#ffc83d",
              }}
            >
              {pct}%
            </text>
          </svg>
        </div>
      </div>

      <div className="mt-1.5 text-[10px] text-[#a8b8d0]">
        {isEmpty
          ? "🌱 오늘은 아직 조용해요"
          : `${stamps.participantsSubmittedToday.toLocaleString("ko-KR")}명 참여`}
      </div>
    </div>
  );
}
