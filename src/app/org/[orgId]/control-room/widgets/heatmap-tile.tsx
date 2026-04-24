import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "../control-room.module.css";

type Props = {
  heatmap: ControlRoomSnapshot["heatmap"];
  isTvMode: boolean;
};

/**
 * 24시간 활동 히트맵 — 24개 셀 가로 스트립.
 * intensity 0~1 을 네온 그린 알파 채널로 매핑.
 * peakHour 셀만 glow+border 강조.
 */
export function HeatmapTile({ heatmap, isTvMode }: Props) {
  const { hours, peakHour, totalLast24h } = heatmap;
  const isEmpty = totalLast24h === 0;

  // 4시간 간격 레이블 노출 인덱스
  const labelIndexes = new Set([0, 6, 12, 18, 23]);

  // TV 모드: em 기반 상대 높이(글로벌 tvScale font-size 에 비례 확대)
  // 일반 모드: 고정 px
  const stripHeightClass = isTvMode ? "h-[4em]" : "h-16 md:h-20";

  return (
    <div className={`${styles.surface} flex h-full flex-col p-5`}>
      {/* 헤더 */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base" aria-hidden>
          🗓
        </span>
        <h2 className="text-xs font-semibold tracking-[0.15em] text-[#7FA892]">
          24시간 활동 히트맵
        </h2>
      </div>

      {/* 부제 */}
      <div className="mb-3 flex items-center justify-between text-[11px] text-[#7FA892]">
        <span>
          총{" "}
          <span className="font-mono font-semibold text-[#e8f0e4]">
            {totalLast24h.toLocaleString("ko-KR")}
          </span>
          건
        </span>
        <span>
          피크:{" "}
          <span className="font-mono font-semibold text-[#e8f0e4]">
            {peakHour ?? "—"}
          </span>
        </span>
      </div>

      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
          <div className="text-5xl" aria-hidden>
            🌱
          </div>
          <div className="text-sm text-[#7FA892]">
            아직 조용한 24시간이에요
          </div>
        </div>
      ) : (
        <>
          {/* 히트맵 스트립 */}
          <div className={`flex w-full items-stretch gap-[2px] ${stripHeightClass}`}>
            {hours.map((h, i) => {
              const isPeak = h.intensity >= 1;
              // 최소 0.05, 최대 0.95 로 클램프 — 완전 검정/완전 백색 방지
              const alpha = h.intensity * 0.9 + 0.05;
              return (
                <div
                  key={i}
                  title={`${h.hourLabel} · ${h.count.toLocaleString("ko-KR")}건`}
                  className={`${styles.heatmapCell} ${
                    isPeak ? styles.heatmapPeak : ""
                  } flex-1 rounded-sm`}
                  style={{
                    backgroundColor: `rgba(57, 255, 136, ${alpha})`,
                  }}
                  aria-label={`${h.hourLabel} ${h.count}건`}
                />
              );
            })}
          </div>

          {/* 4h 간격 시간 레이블 — 셀 하단에 5개만 */}
          <div className="mt-1 flex w-full items-start gap-[2px] font-mono text-[10px] text-[#4e6659]">
            {hours.map((h, i) => (
              <div key={i} className="flex-1 text-center">
                {labelIndexes.has(i) ? h.hourLabel : " "}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
