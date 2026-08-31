import Link from "next/link";
import type { OrgHomeDashboard } from "@/lib/org-home/types";

type Props = {
  dashboard: OrgHomeDashboard;
  orgId: string;
};

export function HeroCard({ dashboard, orgId }: Props) {
  const { orgName, todayStats, eventCount, profileCompleteness } = dashboard;

  // 행사를 한 번도 안 연 기관에게는 이 세 칸이 전부 0 이다. 화면에서 눈이 제일
  // 먼저 가는 자리를 "아직 아무것도 없음" 을 알리는 데 쓰게 된다. 그동안은
  // 진행률 한 줄로 바꾼다 — 아래 세 걸음 카드가 이어받는다.
  if (eventCount === 0) {
    const pct = Math.max(0, Math.min(100, profileCompleteness.percent));
    return (
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-white sm:text-xl">
              🌲 {orgName}
            </h1>
            <p className="mt-0.5 text-xs font-semibold text-[#D4E4BC]">
              문 열 준비 중
            </p>
          </div>
          <Link
            href={`/org/${orgId}/settings`}
            className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/25"
          >
            설정 →
          </Link>
        </div>
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/25"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="기관 준비 진행도"
        >
          <div
            className="h-full rounded-full bg-[#D4E4BC] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold text-white sm:text-2xl">
          🌲 {orgName}
        </h1>
        <Link
          href={`/org/${orgId}/settings`}
          className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/25"
        >
          설정 →
        </Link>
      </div>

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
