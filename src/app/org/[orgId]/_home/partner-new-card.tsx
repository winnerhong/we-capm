import Link from "next/link";
import type { OrgHomeDashboard } from "@/lib/org-home/types";

type Props = {
  partnerNew: OrgHomeDashboard["partnerNew"];
  orgId: string;
};

export function PartnerNewCard({ partnerNew, orgId }: Props) {
  const total =
    partnerNew.newPresetsThisWeek + partnerNew.newMissionsThisWeek;
  if (total <= 0) return null;

  return (
    <section className="rounded-3xl bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] p-5 shadow-sm">
      <h2 className="text-base font-extrabold text-[#4C1D95]">
        ✨ {partnerNew.partnerName} 에서 새로 올렸어요
      </h2>
      <p className="mt-1 text-xs text-[#5B21B6]">
        이번 주 새로 업로드된 콘텐츠를 확인해 보세요
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {partnerNew.newMissionsThisWeek > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-[#4C1D95]">
            🎯 미션 {partnerNew.newMissionsThisWeek}개
          </span>
        )}
        {partnerNew.newPresetsThisWeek > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-[#4C1D95]">
            📚 프리셋 {partnerNew.newPresetsThisWeek}개
          </span>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Link
          href={`/org/${orgId}/quest-packs/from-preset`}
          className="flex-1 rounded-2xl bg-[#4C1D95] px-3 py-2.5 text-center text-xs font-bold text-white transition hover:bg-[#3B0F7A] active:scale-[0.98]"
        >
          프리셋 둘러보기 →
        </Link>
        <Link
          href={`/org/${orgId}/missions/catalog`}
          className="flex-1 rounded-2xl border border-[#8B5CF6]/40 bg-white/60 px-3 py-2.5 text-center text-xs font-bold text-[#4C1D95] transition hover:bg-white"
        >
          미션 카탈로그 →
        </Link>
      </div>
    </section>
  );
}
