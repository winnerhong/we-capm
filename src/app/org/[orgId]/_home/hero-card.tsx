import Link from "next/link";
import type { OrgHomeDashboard } from "@/lib/org-home/types";

type Props = {
  dashboard: OrgHomeDashboard;
  orgId: string;
};

export function HeroCard({ dashboard, orgId }: Props) {
  const { orgName, managerName, todayStats } = dashboard;

  return (
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#D4E4BC]">
          🌲 {orgName}
        </p>
        <Link
          href={`/org/${orgId}/settings`}
          className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/25"
        >
          설정 →
        </Link>
      </div>

      <h1 className="mt-3 truncate text-xl font-bold text-white sm:text-2xl">
        👋 {managerName || "기관 관리자"} 선생님
      </h1>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniStat
          icon="🧑‍🤝‍🧑"
          value={todayStats.participantsTotal}
          label="참가자"
          hint={
            todayStats.participantsTotal === 0
              ? "초대 대기"
              : todayStats.participantsAddedToday > 0
                ? `오늘 +${todayStats.participantsAddedToday}`
                : undefined
          }
        />
        <MiniStat
          icon="🎯"
          value={todayStats.stampsToday}
          label="오늘 스탬프"
          hint={todayStats.stampsToday === 0 ? "아직 조용해요" : undefined}
        />
        <MiniStat
          icon="⏳"
          value={todayStats.pendingReview}
          label="검토 대기"
          hint={todayStats.pendingReview === 0 ? "깨끗해요 ✨" : undefined}
        />
      </div>
    </section>
  );
}

function MiniStat({
  icon,
  value,
  label,
  hint,
}: {
  icon: string;
  value: number;
  label: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-white/15 p-2.5 text-center backdrop-blur-sm">
      <p className="text-lg" aria-hidden>
        {icon}
      </p>
      <p className="mt-0.5 text-base font-bold tabular-nums text-white">
        {value}
      </p>
      <p className="text-[10px] font-semibold text-[#D4E4BC]">
        {hint ?? label}
      </p>
    </div>
  );
}
