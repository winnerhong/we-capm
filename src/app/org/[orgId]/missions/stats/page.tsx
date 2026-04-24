import Link from "next/link";
import type { ReactNode } from "react";
import { requireOrg } from "@/lib/org-auth-guard";
import { AcornIcon } from "@/components/acorn-icon";
import {
  loadOrgQuestPacks,
  loadSubmissionStatsByOrg,
} from "@/lib/missions/queries";
import {
  MISSION_KIND_META,
  type MissionKind,
  type ViewMissionSubmissionStatsRow,
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

export default async function OrgMissionStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ kind?: string; pack?: string }>;
}) {
  const { orgId } = await params;
  const session = await requireOrg();

  const sp = await searchParams;
  const kindFilter: KindFilter = ALL_KINDS.includes(sp.kind as MissionKind)
    ? (sp.kind as MissionKind)
    : "ALL";
  const packFilter: string | "ALL" | "NONE" =
    sp.pack === "NONE"
      ? "NONE"
      : typeof sp.pack === "string" && sp.pack.length > 0
        ? sp.pack
        : "ALL";

  const [stats, packs] = await Promise.all([
    loadSubmissionStatsByOrg(orgId),
    loadOrgQuestPacks(orgId),
  ]);

  const packMap = new Map<string, string>();
  for (const p of packs) packMap.set(p.id, p.name);

  const filtered = stats
    .filter((s) => (kindFilter === "ALL" ? true : s.kind === kindFilter))
    .filter((s) => {
      if (packFilter === "ALL") return true;
      if (packFilter === "NONE") return s.quest_pack_id == null;
      return s.quest_pack_id === packFilter;
    })
    .slice()
    .sort((a, b) => b.total_count - a.total_count);

  // Summary
  const totalSubmissions = stats.reduce(
    (s, r) => s + (r.total_count ?? 0),
    0
  );
  const totalApproved = stats.reduce(
    (s, r) => s + (r.approved_count ?? 0),
    0
  );
  const totalPending = stats.reduce((s, r) => s + (r.pending_count ?? 0), 0);
  const totalAcorns = stats.reduce(
    (s, r) => s + (r.total_acorns_awarded ?? 0),
    0
  );
  const approvalRate =
    totalSubmissions > 0
      ? Math.round((totalApproved / totalSubmissions) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관홈
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/org/${orgId}/missions/catalog`}
          className="hover:text-[#2D5A3D]"
        >
          미션
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">통계</span>
      </nav>

      {/* Header */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#4A7C59] to-[#2D5A3D] p-6 text-white shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#D4E4BC]">
          Org · Mission Stats
        </p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold md:text-3xl">
          <span aria-hidden>📊</span>
          <span>우리 기관 미션 통계</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-[#E8F0E4]">
          어떤 미션이 아이들에게 호응이 좋고, 어디에서 검토 병목이 생기는지
          한눈에 확인해요.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard
            label="총 제출 수"
            value={totalSubmissions}
            icon="📝"
          />
          <SummaryCard
            label="승인률"
            value={approvalRate}
            icon="✅"
            suffix="%"
          />
          <SummaryCard
            label="검토 대기"
            value={totalPending}
            icon="⏳"
            tone={totalPending > 0 ? "warn" : undefined}
          />
          <SummaryCard
            label="지급된 도토리"
            value={totalAcorns}
            icon={<AcornIcon size={20} />}
          />
        </div>
      </section>

      {/* Filters */}
      <section aria-label="필터" className="space-y-3">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-[#6B6560]">종류</p>
          <div className="flex flex-wrap gap-2">
            <KindChip
              active={kindFilter === "ALL"}
              href={buildHref(orgId, { pack: sp.pack })}
              label="전체"
              icon="🗂"
              count={stats.length}
            />
            {ALL_KINDS.map((k) => {
              const meta = MISSION_KIND_META[k];
              const count = stats.filter((m) => m.kind === k).length;
              if (count === 0) return null;
              return (
                <KindChip
                  key={k}
                  active={kindFilter === k}
                  href={buildHref(orgId, { kind: k, pack: sp.pack })}
                  label={meta.label}
                  icon={meta.icon}
                  count={count}
                />
              );
            })}
          </div>
        </div>

        {packs.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-[#6B6560]">스탬프북</p>
            <div className="flex flex-wrap gap-2">
              <PackChip
                active={packFilter === "ALL"}
                href={buildHref(orgId, { kind: sp.kind })}
                label="전체"
                count={stats.length}
              />
              {packs.map((p) => {
                const n = stats.filter((s) => s.quest_pack_id === p.id).length;
                if (n === 0) return null;
                return (
                  <PackChip
                    key={p.id}
                    active={packFilter === p.id}
                    href={buildHref(orgId, { kind: sp.kind, pack: p.id })}
                    label={p.name}
                    count={n}
                  />
                );
              })}
              {stats.some((s) => s.quest_pack_id == null) && (
                <PackChip
                  active={packFilter === "NONE"}
                  href={buildHref(orgId, { kind: sp.kind, pack: "NONE" })}
                  label="독립 미션"
                  count={stats.filter((s) => s.quest_pack_id == null).length}
                />
              )}
            </div>
          </div>
        )}
      </section>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="text-5xl" aria-hidden>
            🌱
          </div>
          <p className="mt-3 text-base font-bold text-[#2D5A3D]">
            아직 제출 기록이 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            아이들이 미션을 완료하면 이곳에 통계가 쌓여요.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {filtered.map((row) => (
            <StatRowCard
              key={row.org_mission_id}
              row={row}
              packName={
                row.quest_pack_id ? packMap.get(row.quest_pack_id) : null
              }
              orgId={orgId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function buildHref(
  orgId: string,
  p: { kind?: string; pack?: string }
): string {
  const qs = new URLSearchParams();
  if (p.kind) qs.set("kind", p.kind);
  if (p.pack) qs.set("pack", p.pack);
  const s = qs.toString();
  return s
    ? `/org/${orgId}/missions/stats?${s}`
    : `/org/${orgId}/missions/stats`;
}

function SummaryCard({
  label,
  value,
  icon,
  suffix,
  tone,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  suffix?: string;
  tone?: "warn";
}) {
  const color =
    tone === "warn" && value > 0
      ? "bg-amber-50 text-amber-900"
      : "bg-white/95 text-[#2D5A3D]";
  return (
    <div className={`rounded-xl p-3 text-center ${color}`}>
      <div className="text-lg" aria-hidden>
        {icon}
      </div>
      <p className="text-[10px] font-semibold text-[#6B6560]">{label}</p>
      <p className="text-xl font-extrabold">
        {value.toLocaleString("ko-KR")}
        {suffix ?? ""}
      </p>
    </div>
  );
}

function StatRowCard({
  row,
  packName,
  orgId,
}: {
  row: ViewMissionSubmissionStatsRow;
  packName: string | null | undefined;
  orgId: string;
}) {
  const meta = MISSION_KIND_META[row.kind];
  const approvalRate =
    row.total_count > 0
      ? Math.round((row.approved_count / row.total_count) * 100)
      : 0;

  return (
    <li className="overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm transition hover:border-[#2D5A3D]">
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#E8F0E4] text-2xl"
            aria-hidden
          >
            {meta.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                {meta.label}
              </span>
              {packName && (
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                  📚 {packName}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                승인률 {approvalRate}%
              </span>
            </div>
            <h3 className="mt-1.5 truncate text-base font-bold text-[#2C2C2C]">
              {row.title || "(제목 없음)"}
            </h3>
            <p className="mt-1 text-[11px] text-[#6B6560]">
              <Link
                href={`/org/${orgId}/missions/${row.org_mission_id}/edit`}
                className="text-[#2D5A3D] underline-offset-2 hover:underline"
              >
                미션 편집 →
              </Link>
            </p>
          </div>
        </div>
        <div className="grid flex-shrink-0 grid-cols-2 gap-2 sm:grid-cols-5">
          <Metric
            label="총 제출"
            value={row.total_count}
            icon="📝"
          />
          <Metric
            label="승인"
            value={row.approved_count}
            icon="✅"
            tone="ok"
          />
          <Metric
            label="대기"
            value={row.pending_count}
            icon="⏳"
            tone={row.pending_count > 0 ? "warn" : "neutral"}
          />
          <Metric
            label="반려"
            value={row.rejected_count}
            icon="❌"
            tone={row.rejected_count > 0 ? "bad" : "neutral"}
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
  tone = "neutral",
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  const toneCls =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : tone === "bad"
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : "border-[#D4E4BC] bg-[#F5F1E8] text-[#2D5A3D]";
  return (
    <div className={`rounded-lg border px-2 py-2 text-center ${toneCls}`}>
      <p className="text-[10px] font-semibold opacity-80">
        <span className="mr-0.5" aria-hidden>
          {icon}
        </span>
        {label}
      </p>
      <p className="text-base font-extrabold">
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

function PackChip({
  active,
  href,
  label,
  count,
}: {
  active: boolean;
  href: string;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-violet-600 bg-violet-600 text-white"
          : "border-violet-200 bg-violet-50 text-violet-800 hover:border-violet-500"
      }`}
    >
      <span aria-hidden>📚</span>
      <span className="max-w-[200px] truncate">{label}</span>
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] ${
          active ? "bg-white/20" : "bg-white"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}
