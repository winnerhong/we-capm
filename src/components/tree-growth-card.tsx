"use client";
import { getProgress, TREE_LEVELS } from "@/lib/tree-growth";
import { AcornIcon } from "@/components/acorn-icon";

export function TreeGrowthCard({ acorns }: { acorns: number }) {
  const { current, next, percent, remaining } = getProgress(acorns);

  return (
    <div className="rounded-2xl border border-[#D4E4BC] bg-gradient-to-br from-[#FFF8F0] to-[#E8F0E4] p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-[#6B6560]">나의 나무</p>
          <h3 className="text-lg font-bold text-[#2D5A3D] flex items-center gap-1.5">
            <span className="text-2xl">{current.emoji}</span>
            <span>{current.name}</span>
          </h3>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-[#2D5A3D] flex items-center justify-end gap-1">{acorns}<AcornIcon size={14} /></div>
          <div className="text-[10px] text-[#6B6560]">도토리</div>
        </div>
      </div>

      {/* 진행률 바 */}
      <div className="relative h-3 overflow-hidden rounded-full bg-white/60 mb-2">
        <div className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-[#A8C686] to-[#4A7C59]" style={{ width: `${percent}%` }} />
      </div>

      {next ? (
        <p className="text-xs text-[#6B6560] text-center">
          {next.emoji} <strong className="text-[#2D5A3D]">{next.name}</strong>까지 <AcornIcon /> <strong>{remaining}개</strong>
        </p>
      ) : (
        <p className="text-xs text-[#2D5A3D] text-center font-semibold">🏞️ 최고 등급 달성! 당신은 진정한 숲지기</p>
      )}

      {/* 5단계 타임라인 */}
      <div className="mt-4 flex justify-between">
        {TREE_LEVELS.map((l) => {
          const isActive = acorns >= l.min;
          const isCurrent = l.level === current.level;
          return (
            <div key={l.level} className="text-center flex-1">
              <div className={`text-lg transition-all ${isActive ? "" : "opacity-30 grayscale"} ${isCurrent ? "scale-125" : ""}`}>{l.emoji}</div>
              <div className={`text-[9px] mt-0.5 ${isCurrent ? "font-bold text-[#2D5A3D]" : "text-[#6B6560]"}`}>{l.name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
