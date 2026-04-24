import Link from "next/link";
import type { ReactNode } from "react";
import { requirePartner } from "@/lib/auth-guard";
import { AcornIcon } from "@/components/acorn-icon";
import { loadPartnerMissionUsageStats } from "@/lib/missions/queries";
import {
  MISSION_KIND_META,
  MISSION_STATUS_META,
  type MissionKind,
  type ViewPartnerMissionUsageStatsRow,
} from "@/lib/missions/types";

export const dynamic = "force-dynamic";

const ALL_KINDS: MissionKind[] = [
  "PHOTO",
  "QR_QUIZ",
  "PHOTO_APPROVAL",
  "COOP",
  "BROADCAST",
  "TREASURE",
  "RADIO",
  "FINAL_REWARD",
];

type KindFilter = "ALL" | MissionKind;

export default async function PartnerMissionStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const partner = await requirePartner();
  const sp = await searchParams;
  const kindFilter: KindFilter = ALL_KINDS.includes(sp.kind as MissionKind)
    ? (sp.kind as MissionKind)
    : "ALL";

  const stats = await loadPartnerMissionUsageStats(partner.id);

  // 필터 적용 후 정렬 (total_approved_submissions DESC)
  const filtered = stats
    .filter((s) => (kindFilter === "ALL" ? true : s.kind === kindFilter))
    .slice()
    .sort(
      (a, b) => b.total_approved_submissions - a.total_approved_submissions
    );

  // Summary
  const totalMissions = stats.length;
  const totalCopied = stats.reduce((sum, s) => sum + (s.copied_count ?? 0), 0);
  const totalUsingOrgs = stats.reduce(
    (sum, s) => sum + (s.used_by_org_count ?? 0),
    0
  );
  const totalAcorns = stats.reduce(
    (sum, s) => sum + (s.total_acorns_awarded ?? 0),
    0
  );

  // Kind breakdown
  const kindBreakdown: Record<MissionKind, number> = {
    PHOTO: 0,
    QR_QUIZ: 0,
    PHOTO_APPROVAL: 0,
    COOP: 0,
    BROADCAST: 0,
    TREASURE: 0,
    RADIO: 0,
    FINAL_REWARD: 0,
  };
  for (const s of stats) {
    kindBreakdown[s.kind] = (kindBreakdown[s.kind] ?? 0) + 1;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/missions" className="hover:text-[#2D5A3D]">
          미션 라이브러리
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">통계</span>
      </nav>

      {/* Header */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#4A7C59] to-[#2D5A3D] p-6 text-white shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#D4E4BC]">
          Partner · Mission Stats
        </p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold md:text-3xl">
          <span aria-hidden>📊</span>
          <span>미션 통계</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-[#E8F0E4]">
          어떤 미션이 기관에서 가장 많이 복사되고, 실제로 어떤 미션이 아이들에게
          도달하고 있는지 확인해요.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="총 미션 수" value={totalMissions} icon="🎯" />
          <SummaryCard label="복사된 횟수" value={totalCopied} icon="📋" />
          <SummaryCard
            label="사용 중 기관"
            value={totalUsingOrgs}
            icon="🏫"
          />
          <SummaryCard
            label="지급된 도토리"
            value={totalAcorns}
            icon={<AcornIcon size={20} />}
          />
        </div>

        {/* kind chip breakdown */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {ALL_KINDS.map((k) => {
            const n = kindBreakdown[k];
            if (!n) return null;
            const meta = MISSION_KIND_META[k];
            return (
              <span
                key={k}
                className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur"
              >
                <span aria-hidden>{meta.icon}</span>
                <span>
                  {meta.label}: {n}
                </span>
              </span>
            );
          })}
        </div>
      </section>

      {/* Kind filter */}
      <section aria-label="종류 필터" className="space-y-2">
        <p className="text-[11px] font-semibold text-[#6B6560]">종류</p>
        <div className="flex flex-wrap gap-2">
          <KindChip
            active={kindFilter === "ALL"}
            href="/partner/missions/stats"
            label="전체"
            icon="🗂"
            count={stats.length}
          />
          {ALL_KINDS.map((k) => {
            const meta = MISSION_KIND_META[k];
            const count = stats.filter((m) => m.kind === k).length;
            return (
              <KindChip
                key={k}
                active={kindFilter === k}
                href={`/partner/missions/stats?kind=${k}`}
                label={meta.label}
                icon={meta.icon}
                count={count}
              />
            );
          })}
        </div>
      </section>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="text-5xl" aria-hidden>
            🌱
          </div>
          <p className="mt-3 text-base font-bold text-[#2D5A3D]">
            아직 통계가 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            미션이 기관에 배포되고 제출이 쌓이면 여기에 숫자가 나타나요.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {filtered.map((row) => (
            <StatRowCard key={row.partner_mission_id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white/95 p-3 text-center text-[#2D5A3D]">
      <div className="text-lg" aria-hidden>
        {icon}
      </div>
      <p className="text-[10px] font-semibold text-[#6B6560]">{label}</p>
      <p className="text-xl font-extrabold">{value.toLocaleString("ko-KR")}</p>
    </div>
  );
}

function StatRowCard({ row }: { row: ViewPartnerMissionUsageStatsRow }) {
  const kindMeta = MISSION_KIND_META[row.kind];
  const statusMeta = MISSION_STATUS_META[row.mission_status];

  return (
    <li className="overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm transition hover:border-[#2D5A3D]">
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#E8F0E4] text-2xl"
            aria-hidden
          >
            {kindMeta.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                {kindMeta.label}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.color}`}
              >
                {statusMeta.label}
              </span>
            </div>
            <h3 className="mt-1.5 truncate text-base font-bold text-[#2C2C2C]">
              {row.title || "(제목 없음)"}
            </h3>
            <p className="mt-1 text-[11px] text-[#6B6560]">
              <Link
                href={`/partner/missions/${row.partner_mission_id}/edit`}
                className="text-[#2D5A3D] underline-offset-2 hover:underline"
              >
                편집 화면으로 이동 →
              </Link>
            </p>
          </div>
        </div>
        <div className="grid flex-shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric
            label="복사 횟수"
            value={row.copied_count}
            icon="📋"
          />
          <Metric
            label="사용 기관"
            value={row.used_by_org_count}
            icon="🏫"
          />
          <Metric
            label="승인 제출"
            value={row.total_approved_submissions}
            icon="✅"
            highlight
          />
          <Metric
            label="도토리"
            value={row.total_acorns_awarded}
            icon={<AcornIcon size={14} />}
          />
        </div>
      </div>
    </li>
  );
}

function Metric({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-center ${
        highlight
          ? "border-emerald-200 bg-emerald-50"
          : "border-[#D4E4BC] bg-[#F5F1E8]"
      }`}
    >
      <p
        className={`text-[10px] font-semibold ${
          highlight ? "text-emerald-800" : "text-[#6B6560]"
        }`}
      >
        <span className="mr-0.5" aria-hidden>
          {icon}
        </span>
        {label}
      </p>
      <p
        className={`text-base font-extrabold ${
          highlight ? "text-emerald-900" : "text-[#2D5A3D]"
        }`}
      >
        {value.toLocaleString("ko-KR")}
      </p>
    </div>
  );
}

function KindChip({
  active,
  href,
  label,
  icon,
  count,
}: {
  active: boolean;
  href: string;
  label: string;
  icon: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
          : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-[#2D5A3D] hover:text-[#2D5A3D]"
      }`}
    >
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] ${
          active ? "bg-white/20" : "bg-[#F5F1E8]"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}
