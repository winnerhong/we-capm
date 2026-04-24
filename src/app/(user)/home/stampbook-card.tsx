// Server component — 홈 화면에 걸리는 "진행 중 스탬프북" 카드
import Link from "next/link";
import type { OrgQuestPackRow } from "@/lib/missions/types";
import { MISSION_KIND_META } from "@/lib/missions/types";
import type { PackProgress } from "@/lib/missions/progress";
import { AcornIcon } from "@/components/acorn-icon";

interface Props {
  pack: OrgQuestPackRow;
  progress: PackProgress;
}

export function StampbookCard({ pack, progress }: Props) {
  const { totalSlots, completedSlots, percent, nextMission } = progress;
  const pctDisplay = Math.max(4, Math.min(100, percent));
  const nextMeta = nextMission
    ? MISSION_KIND_META[nextMission.kind]
    : null;

  return (
    <Link
      href={`/stampbook/${pack.id}`}
      className="block overflow-hidden rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0]/40 p-5 shadow-sm transition hover:shadow-md active:scale-[0.995]"
      aria-label={`${pack.name} 스탬프북 열기`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B6560]">
            진행 중 스탬프북
          </p>
          <h3 className="mt-0.5 flex items-center gap-1.5 text-base font-bold text-[#2D5A3D]">
            <span aria-hidden>🌲</span>
            <span className="truncate">{pack.name}</span>
          </h3>
        </div>
        <div className="shrink-0 rounded-2xl border border-[#D4E4BC] bg-white/90 px-3 py-1.5 text-center">
          <p className="text-sm font-bold tabular-nums text-[#2D5A3D]">
            {completedSlots} <span className="text-[#8B7F75]">/</span>{" "}
            {totalSlots}
          </p>
          <p className="text-[10px] font-semibold text-[#6B6560]">스탬프</p>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/70"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`스탬프북 진행도 ${percent}%`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#3A7A52] to-[#4A7C59] transition-all"
          style={{ width: `${pctDisplay}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] font-semibold text-[#2D5A3D]">
        {percent}% 진행
      </p>

      {/* Next mission */}
      <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-white/80 px-3 py-2">
        {nextMission && nextMeta ? (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-[#6B6560]">
                다음 목표
              </p>
              <p className="truncate text-sm font-bold text-[#2D5A3D]">
                <span aria-hidden>{nextMeta.icon}</span>{" "}
                {nextMission.title}
              </p>
            </div>
            <div className="shrink-0 rounded-full bg-[#FAE7D0] px-2.5 py-1 text-xs font-bold text-[#6B4423]">
              <AcornIcon className="text-[#6B4423]" /> +{nextMission.acorns}
            </div>
          </>
        ) : progress.isComplete ? (
          <p className="flex-1 text-sm font-bold text-[#2D5A3D]">
            🎉 모든 미션을 완료했어요!
          </p>
        ) : (
          <p className="flex-1 text-sm font-semibold text-[#6B6560]">
            🔒 새 미션이 곧 열려요
          </p>
        )}
      </div>

      {/* CTA */}
      <p className="mt-3 text-right text-xs font-bold text-[#2D5A3D]">
        스탬프북 열기 →
      </p>
    </Link>
  );
}
