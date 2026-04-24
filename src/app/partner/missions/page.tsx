import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { AcornIcon } from "@/components/acorn-icon";
import {
  loadPartnerMissions,
  countPendingContributionsForPartner,
} from "@/lib/missions/queries";
import {
  MISSION_KIND_META,
  MISSION_STATUS_META,
  type MissionKind,
  type MissionStatus,
  type MissionVisibility,
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
type StatusFilter = "ALL" | MissionStatus;

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "DRAFT", label: "초안" },
  { key: "PUBLISHED", label: "게시됨" },
  { key: "ARCHIVED", label: "보관됨" },
];

const VISIBILITY_META: Record<
  MissionVisibility,
  { label: string; color: string; icon: string }
> = {
  DRAFT: {
    label: "비공개",
    color: "bg-zinc-50 text-zinc-600 border-zinc-200",
    icon: "🔒",
  },
  ALL: {
    label: "전체 공개",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
    icon: "🌍",
  },
  SELECTED: {
    label: "선택 공개",
    color: "bg-sky-50 text-sky-800 border-sky-200",
    icon: "🎯",
  },
  ARCHIVED: {
    label: "보관됨",
    color: "bg-zinc-50 text-zinc-500 border-zinc-200",
    icon: "📦",
  },
};

function fmtDate(iso: string): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function PartnerMissionsListPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; status?: string }>;
}) {
  const partner = await requirePartner();
  const sp = await searchParams;

  const kindFilter: KindFilter = ALL_KINDS.includes(sp.kind as MissionKind)
    ? (sp.kind as MissionKind)
    : "ALL";
  const statusFilter: StatusFilter =
    sp.status === "DRAFT" ||
    sp.status === "PUBLISHED" ||
    sp.status === "ARCHIVED"
      ? sp.status
      : "ALL";

  const [all, pendingContributions] = await Promise.all([
    loadPartnerMissions(partner.id),
    countPendingContributionsForPartner(partner.id),
  ]);

  const list = all.filter((m) => {
    if (kindFilter !== "ALL" && m.kind !== kindFilter) return false;
    if (statusFilter !== "ALL" && m.status !== statusFilter) return false;
    return true;
  });

  const total = all.length;
  const published = all.filter((m) => m.status === "PUBLISHED").length;
  const draft = all.filter((m) => m.status === "DRAFT").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">미션 라이브러리</span>
      </nav>

      {/* Header card */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#4A7C59] to-[#2D5A3D] p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#D4E4BC]">
              Partner · Missions
            </p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold md:text-3xl">
              <span aria-hidden>🎯</span>
              <span>미션 라이브러리</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[#E8F0E4]">
              지사에서 만든 가이드 미션은 기관이 복사해 자유롭게 편집합니다.
              템플릿을 잘 다듬어 두면, 한 번의 작업으로 여러 기관에 동일한
              경험을 전달할 수 있어요.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/partner/missions/contributions"
              aria-label={
                pendingContributions > 0
                  ? `기관 제안함 — 검토 대기 ${pendingContributions}건`
                  : "기관 제안함"
              }
              className="relative inline-flex items-center gap-1.5 rounded-xl border border-white/50 bg-violet-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700"
            >
              <span aria-hidden>💌</span>
              <span>
                기관 제안함
                {pendingContributions > 0
                  ? ` · 대기 ${pendingContributions}`
                  : ""}
              </span>
              {pendingContributions > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-amber-900 ring-2 ring-white">
                  {pendingContributions > 99 ? "99+" : pendingContributions}
                </span>
              )}
            </Link>
            <Link
              href="/partner/missions/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#2D5A3D] shadow-sm transition hover:bg-[#F5F1E8]"
            >
              <span aria-hidden>➕</span>
              <span>새 미션 만들기</span>
            </Link>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 text-[#2D5A3D] sm:max-w-md">
          <div className="rounded-xl bg-white/95 p-3 text-center">
            <p className="text-[10px] font-semibold text-[#6B6560]">전체</p>
            <p className="text-xl font-extrabold">{total}</p>
          </div>
          <div className="rounded-xl bg-white/95 p-3 text-center">
            <p className="text-[10px] font-semibold text-emerald-700">게시됨</p>
            <p className="text-xl font-extrabold text-emerald-800">
              {published}
            </p>
          </div>
          <div className="rounded-xl bg-white/95 p-3 text-center">
            <p className="text-[10px] font-semibold text-zinc-600">초안</p>
            <p className="text-xl font-extrabold text-zinc-800">{draft}</p>
          </div>
        </div>
      </section>

      {/* Kind chip filters */}
      <section aria-label="종류 필터" className="space-y-2">
        <p className="text-[11px] font-semibold text-[#6B6560]">종류</p>
        <div className="flex flex-wrap gap-2">
          <KindChip
            active={kindFilter === "ALL"}
            href={buildHref({ kind: undefined, status: sp.status })}
            label="전체"
            icon="🗂"
            count={all.length}
          />
          {ALL_KINDS.map((k) => {
            const meta = MISSION_KIND_META[k];
            return (
              <KindChip
                key={k}
                active={kindFilter === k}
                href={buildHref({ kind: k, status: sp.status })}
                label={meta.label}
                icon={meta.icon}
                count={all.filter((m) => m.kind === k).length}
              />
            );
          })}
        </div>
      </section>

      {/* Status tab filters */}
      <section aria-label="상태 필터" className="space-y-2">
        <p className="text-[11px] font-semibold text-[#6B6560]">상태</p>
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => {
            const isActive = tab.key === statusFilter;
            const count =
              tab.key === "ALL"
                ? all.length
                : all.filter((m) => m.status === tab.key).length;
            const href = buildHref({
              kind: sp.kind,
              status: tab.key === "ALL" ? undefined : tab.key,
            });
            return (
              <Link
                key={tab.key}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                    : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-[#2D5A3D] hover:text-[#2D5A3D]"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    isActive ? "bg-white/20" : "bg-[#F5F1E8]"
                  }`}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* List */}
      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="text-5xl" aria-hidden>
            {all.length === 0 ? "🌱" : "🔍"}
          </div>
          <p className="mt-3 text-base font-bold text-[#2D5A3D]">
            {all.length === 0
              ? "아직 만든 미션이 없어요"
              : "조건에 맞는 미션이 없어요"}
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            {all.length === 0
              ? "첫 가이드 미션을 만들어 기관에 배포해 보세요."
              : "필터를 초기화하거나 다른 종류를 선택해 보세요."}
          </p>
          {all.length === 0 && (
            <Link
              href="/partner/missions/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#234a30]"
            >
              <span aria-hidden>➕</span>
              <span>새 미션 만들기</span>
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid gap-3">
          {list.map((m) => {
            const kindMeta = MISSION_KIND_META[m.kind];
            const statusMeta = MISSION_STATUS_META[m.status];
            const visMeta = VISIBILITY_META[m.visibility];
            return (
              <li
                key={m.id}
                className="overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm transition hover:border-[#2D5A3D] hover:shadow-md"
              >
                <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:p-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#E8F0E4] text-2xl"
                      aria-hidden
                    >
                      {m.icon || kindMeta.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                          <span aria-hidden>{kindMeta.icon}</span>
                          <span>{kindMeta.label}</span>
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.color}`}
                        >
                          {statusMeta.label}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${visMeta.color}`}
                        >
                          <span aria-hidden>{visMeta.icon}</span>
                          <span>{visMeta.label}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          <AcornIcon size={12} />
                          <span>+{m.default_acorns}</span>
                        </span>
                      </div>
                      <h3 className="mt-1.5 truncate text-base font-bold text-[#2C2C2C]">
                        {m.title || "(제목 없음)"}
                      </h3>
                      {m.description && (
                        <p className="mt-1 line-clamp-1 text-xs text-[#6B6560]">
                          {m.description}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-[#8B7F75]">
                        최종 수정: {fmtDate(m.updated_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-2">
                    <Link
                      href={`/partner/missions/${m.id}/edit`}
                      className="inline-flex items-center gap-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
                    >
                      <span aria-hidden>✏️</span>
                      <span>편집</span>
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function buildHref(p: {
  kind?: string;
  status?: string;
}): string {
  const qs = new URLSearchParams();
  if (p.kind) qs.set("kind", p.kind);
  if (p.status) qs.set("status", p.status);
  const s = qs.toString();
  return s ? `/partner/missions?${s}` : "/partner/missions";
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
