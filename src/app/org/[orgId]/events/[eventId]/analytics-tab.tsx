// server component — no "use client"
// 행사 상세 "📊 성과" 탭. loadEventAnalytics 를 호출해 KPI/진행률/랭킹 렌더.
// 실패 시 빈 분석을 반환받아 "빈 상태" UI 로 자연스럽게 분기.

import Link from "next/link";
import type { ReactNode } from "react";
import { loadEventAnalytics } from "@/lib/org-events/queries";
import { AcornIcon } from "@/components/acorn-icon";

export async function AnalyticsTabPanel({
  orgId,
  eventId,
}: {
  orgId: string;
  eventId: string;
}) {
  const a = await loadEventAnalytics(eventId);

  // 빈 상태 1: 참가자 자체가 없음
  if (a.totalParticipants === 0) {
    return (
      <EmptyState
        icon="🙋"
        title="아직 참가자가 없어요"
        description="먼저 참가자를 등록해야 성과 집계를 시작할 수 있어요."
        ctaHref={`/org/${orgId}/events/${eventId}?tab=participants`}
        ctaLabel="참가자 등록하러 가기"
      />
    );
  }
  // 빈 상태 2: 참가자는 있지만 제출 0
  if (a.totalSubmissions === 0) {
    return (
      <div className="space-y-4">
        <KpiGrid analytics={a} />
        <EmptyState
          icon="🌱"
          title="아직 미션 제출이 없어요"
          description="행사가 본격 진행되면 여기에 참가자들의 미션 성과가 집계돼요."
          ctaHref={`/org/${orgId}/events/${eventId}?tab=questpacks`}
          ctaLabel="스탬프북 점검하기"
        />
        <CsvDownload eventId={eventId} />
      </div>
    );
  }

  // 정상 상태
  return (
    <div className="space-y-5">
      <KpiGrid analytics={a} />
      <StatusBreakdown analytics={a} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TopParticipants analytics={a} />
        <TopMissions analytics={a} />
      </div>
      <FmSummary analytics={a} />
      <CsvDownload eventId={eventId} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* KPI Grid                                                                   */
/* -------------------------------------------------------------------------- */

function KpiGrid({
  analytics: a,
}: {
  analytics: Awaited<ReturnType<typeof loadEventAnalytics>>;
}) {
  const completionPct = Math.round(a.completionRate * 100);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
      <KpiCard
        icon="🙋"
        label="참가자"
        value={a.totalParticipants.toLocaleString("ko-KR")}
        sub={`활성 ${a.activeParticipants.toLocaleString("ko-KR")}명`}
        tone="forest"
      />
      <KpiCard
        icon="✅"
        label="미션 완료율"
        value={`${completionPct}%`}
        sub={`승인 ${a.approvedSubmissions.toLocaleString("ko-KR")} / 전체 슬롯 ${(a.totalMissions * a.totalParticipants).toLocaleString("ko-KR")}`}
        tone="emerald"
      />
      <KpiCard
        icon={<AcornIcon size={20} />}
        label="도토리 지급"
        value={a.totalAcornsAwarded.toLocaleString("ko-KR")}
        sub={`1인 평균 ${a.avgAcornsPerParticipant.toFixed(1)}개`}
        tone="amber"
      />
      <KpiCard
        icon="📤"
        label="총 제출"
        value={a.totalSubmissions.toLocaleString("ko-KR")}
        sub={`미션 ${a.totalMissions.toLocaleString("ko-KR")}개 준비`}
        tone="emerald"
      />
      <KpiCard
        icon="⏳"
        label="대기 중"
        value={a.pendingSubmissions.toLocaleString("ko-KR")}
        sub={`반려 ${a.rejectedSubmissions.toLocaleString("ko-KR")}건`}
        tone="rose"
      />
      <KpiCard
        icon="🎙"
        label="토리FM"
        value={a.totalFmSessions.toLocaleString("ko-KR")}
        sub={`채팅 ${a.totalFmChatMessages.toLocaleString("ko-KR")} · 리액션 ${a.totalFmReactions.toLocaleString("ko-KR")}`}
        tone="sky"
      />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: "forest" | "emerald" | "amber" | "rose" | "sky";
}) {
  const toneMap: Record<typeof tone, { bg: string; text: string; border: string }> = {
    forest: {
      bg: "bg-white",
      text: "text-[#2D5A3D]",
      border: "border-[#D4E4BC]",
    },
    emerald: {
      bg: "bg-emerald-50/50",
      text: "text-emerald-800",
      border: "border-emerald-200",
    },
    amber: {
      bg: "bg-amber-50",
      text: "text-amber-800",
      border: "border-amber-200",
    },
    rose: {
      bg: "bg-rose-50/40",
      text: "text-rose-800",
      border: "border-rose-200",
    },
    sky: {
      bg: "bg-sky-50/60",
      text: "text-sky-800",
      border: "border-sky-200",
    },
  };
  const c = toneMap[tone];
  return (
    <div
      className={`rounded-2xl border ${c.border} ${c.bg} p-4 shadow-sm`}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-[#6B6560]">{label}</p>
        <span className="text-xl" aria-hidden>
          {icon}
        </span>
      </div>
      <p className={`mt-1 text-3xl font-extrabold md:text-4xl ${c.text}`}>
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[11px] font-medium text-[#6B6560]">{sub}</p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 상태 분포 바                                                                */
/* -------------------------------------------------------------------------- */

function StatusBreakdown({
  analytics: a,
}: {
  analytics: Awaited<ReturnType<typeof loadEventAnalytics>>;
}) {
  const total = a.totalSubmissions || 1; // 0 방지
  const rows: Array<{
    label: string;
    count: number;
    color: string;
    textColor: string;
  }> = [
    {
      label: "승인",
      count: a.approvedSubmissions,
      color: "bg-emerald-500",
      textColor: "text-emerald-800",
    },
    {
      label: "대기",
      count: a.pendingSubmissions,
      color: "bg-amber-400",
      textColor: "text-amber-800",
    },
    {
      label: "반려",
      count: a.rejectedSubmissions,
      color: "bg-rose-500",
      textColor: "text-rose-800",
    },
  ];
  return (
    <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
        <span aria-hidden>📊</span>
        <span>제출 상태 분포</span>
      </h2>
      <p className="mt-1 text-xs text-[#6B6560]">
        전체 {a.totalSubmissions.toLocaleString("ko-KR")}건의 제출을
        상태별로 나눈 비율이에요.
      </p>
      <ul className="mt-4 space-y-3">
        {rows.map((r) => {
          const pct = Math.round((r.count / total) * 100);
          return (
            <li key={r.label}>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className={r.textColor}>{r.label}</span>
                <span className="text-[#6B6560]">
                  {r.count.toLocaleString("ko-KR")}건 · {pct}%
                </span>
              </div>
              <div
                className="mt-1 h-3 w-full overflow-hidden rounded-full bg-[#F5F1E8]"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${r.label} ${pct}%`}
              >
                <div
                  className={`h-full rounded-full ${r.color} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Top 5 Participants                                                         */
/* -------------------------------------------------------------------------- */

function TopParticipants({
  analytics: a,
}: {
  analytics: Awaited<ReturnType<typeof loadEventAnalytics>>;
}) {
  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  return (
    <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
        <span aria-hidden>🏆</span>
        <span>탑 참가자 TOP 5</span>
      </h2>
      {a.topParticipants.length === 0 ? (
        <p className="mt-3 text-xs text-[#6B6560]">
          아직 제출이 집계되지 않았어요.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[#F5F1E8]">
          {a.topParticipants.map((p, i) => (
            <li
              key={p.user_id}
              className="flex items-center justify-between gap-3 py-2.5 transition hover:bg-[#FFFBF3]"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-lg" aria-hidden>
                  {medals[i] ?? "•"}
                </span>
                <span className="truncate text-sm font-semibold text-[#2D5A3D]">
                  {p.parent_name}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold text-[#6B6560]">
                <span>
                  📤 {p.submissions.toLocaleString("ko-KR")}
                </span>
                <span className="text-amber-700">
                  <AcornIcon size={12} /> {p.acorns.toLocaleString("ko-KR")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Top 5 Missions                                                             */
/* -------------------------------------------------------------------------- */

function TopMissions({
  analytics: a,
}: {
  analytics: Awaited<ReturnType<typeof loadEventAnalytics>>;
}) {
  return (
    <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
        <span aria-hidden>🎯</span>
        <span>인기 미션 TOP 5</span>
      </h2>
      {a.topMissions.length === 0 ? (
        <p className="mt-3 text-xs text-[#6B6560]">
          아직 제출이 집계되지 않았어요.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[#F5F1E8]">
          {a.topMissions.map((m) => (
            <li
              key={m.mission_id}
              className="flex items-center justify-between gap-3 py-2.5 transition hover:bg-[#FFFBF3]"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-lg" aria-hidden>
                  {m.icon ?? "🎯"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#2D5A3D]">
                    {m.title}
                  </p>
                  {m.kind && (
                    <p className="text-[10px] font-semibold uppercase text-[#8B7F75]">
                      {m.kind}
                    </p>
                  )}
                </div>
              </div>
              <span className="whitespace-nowrap text-xs font-semibold text-emerald-700">
                {m.submissionCount.toLocaleString("ko-KR")}명 제출
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* FM Summary                                                                 */
/* -------------------------------------------------------------------------- */

function FmSummary({
  analytics: a,
}: {
  analytics: Awaited<ReturnType<typeof loadEventAnalytics>>;
}) {
  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-bold text-sky-800">
        <span aria-hidden>🎙</span>
        <span>토리FM 요약</span>
      </h2>
      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[11px] font-semibold text-sky-700">세션</p>
          <p className="mt-0.5 text-2xl font-extrabold text-sky-900">
            {a.totalFmSessions.toLocaleString("ko-KR")}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-sky-700">채팅</p>
          <p className="mt-0.5 text-2xl font-extrabold text-sky-900">
            {a.totalFmChatMessages.toLocaleString("ko-KR")}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-sky-700">리액션</p>
          <p className="mt-0.5 text-2xl font-extrabold text-sky-900">
            {a.totalFmReactions.toLocaleString("ko-KR")}
          </p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* CSV 다운로드                                                               */
/* -------------------------------------------------------------------------- */

function CsvDownload({ eventId }: { eventId: string }) {
  const href = `/api/org/events/${eventId}/analytics.csv`;
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>
          📥
        </span>
        <div>
          <p className="text-sm font-bold text-[#2D5A3D]">
            참가자별 성과 CSV
          </p>
          <p className="text-[11px] text-[#6B6560]">
            순위·제출·승인·대기·반려·도토리 (Excel 한글 호환)
          </p>
        </div>
      </div>
      <a
        href={href}
        download
        className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-3 py-2 text-[11px] font-bold text-white transition hover:bg-[#234a30]"
      >
        ⬇ 다운로드
      </a>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                */
/* -------------------------------------------------------------------------- */

function EmptyState({
  icon,
  title,
  description,
  ctaHref,
  ctaLabel,
}: {
  icon: string;
  title: string;
  description: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
      <div className="text-5xl" aria-hidden>
        {icon}
      </div>
      <p className="mt-3 text-base font-bold text-[#2D5A3D]">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-[#6B6560]">{description}</p>
      <Link
        href={ctaHref}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#234a30]"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
