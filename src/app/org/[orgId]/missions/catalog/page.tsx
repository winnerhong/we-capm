import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  loadAvailableMissionsForOrg,
  loadOrgMissionsByQuestPack,
  loadOrgQuestPackById,
} from "@/lib/missions/queries";
import {
  MISSION_KIND_META,
  type MissionKind,
  type PartnerMissionRow,
} from "@/lib/missions/types";
import { CopyToOrgButton } from "./copy-button";
import { AcornIcon } from "@/components/acorn-icon";

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

type PartnerInfoMap = Record<string, string>; // partner_id → name

async function loadPartnerNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  partnerIds: string[]
): Promise<PartnerInfoMap> {
  if (partnerIds.length === 0) return {};
  const resp = (await (
    supabase.from("partners" as never) as unknown as {
      select: (c: string) => {
        in: (
          k: string,
          v: string[]
        ) => Promise<{
          data: Array<{ id: string; name: string | null }> | null;
        }>;
      };
    }
  )
    .select("id, name")
    .in("id", Array.from(new Set(partnerIds)))) as {
    data: Array<{ id: string; name: string | null }> | null;
  };
  const map: PartnerInfoMap = {};
  for (const r of resp.data ?? []) {
    map[r.id] = r.name ?? "(지사)";
  }
  return map;
}

function buildHref(base: string, params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

export default async function OrgMissionCatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ kind?: string; packId?: string; inPack?: string }>;
}) {
  const { orgId } = await params;
  const session = await requireOrg();

  const sp = await searchParams;
  const kindFilter: KindFilter = ALL_KINDS.includes(sp.kind as MissionKind)
    ? (sp.kind as MissionKind)
    : "ALL";
  const packId = sp.packId && sp.packId.length > 0 ? sp.packId : undefined;
  const onlyInPack = sp.inPack === "1";

  const supabase = await createClient();

  // optional: validate pack ownership
  let targetPackName: string | null = null;
  if (packId) {
    const pack = await loadOrgQuestPackById(packId);
    if (pack && pack.org_id === session.orgId) {
      targetPackName = pack.name;
    }
  }

  const available = await loadAvailableMissionsForOrg(orgId);

  // partner name map
  const partnerNames = await loadPartnerNames(
    supabase,
    available.map((m) => m.partner_id)
  );

  // 이미 이 팩에 복사돼 있는 source_mission_id 집합
  const inPackSourceIds = new Set<string>();
  if (packId) {
    const inPack = await loadOrgMissionsByQuestPack(packId);
    for (const m of inPack) {
      if (m.source_mission_id) inPackSourceIds.add(m.source_mission_id);
    }
  }

  const filtered = available.filter((m) => {
    if (kindFilter !== "ALL" && m.kind !== kindFilter) return false;
    if (onlyInPack && !inPackSourceIds.has(m.id)) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관홈
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/org/${orgId}/quest-packs`}
          className="hover:text-[#2D5A3D]"
        >
          스탬프북 관리
        </Link>
        {packId && targetPackName && (
          <>
            <span className="mx-2">/</span>
            <Link
              href={`/org/${orgId}/quest-packs/${packId}/edit`}
              className="hover:text-[#2D5A3D]"
            >
              {targetPackName}
            </Link>
          </>
        )}
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">미션 카탈로그</span>
      </nav>

      {/* Header */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#4A7C59] to-[#2D5A3D] p-6 text-white shadow-sm md:p-7">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#D4E4BC]">
          Org · Mission Catalog
        </p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold md:text-3xl">
          <span aria-hidden>📋</span>
          <span>지사가 준비한 미션</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-[#E8F0E4]">
          마음에 드는 미션을 골라{" "}
          <span className="font-bold text-white">복사해서 쓰기</span>를
          누르세요. 우리 기관 전용으로 자유롭게 편집할 수 있어요.
        </p>
        {packId && targetPackName && (
          <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
            <span aria-hidden>🎒</span>
            <span>
              복사 시 <strong>{targetPackName}</strong> 스탬프북에 자동으로
              담겨요
            </span>
          </p>
        )}
      </section>

      {/* Kind filters */}
      <section aria-label="종류 필터" className="space-y-2">
        <p className="text-[11px] font-semibold text-[#6B6560]">종류</p>
        <div className="flex flex-wrap gap-2">
          <KindChip
            active={kindFilter === "ALL"}
            href={buildHref(`/org/${orgId}/missions/catalog`, {
              packId,
              inPack: onlyInPack ? "1" : undefined,
            })}
            label="전체"
            icon="🗂"
            count={available.length}
          />
          {ALL_KINDS.map((k) => {
            const meta = MISSION_KIND_META[k];
            const count = available.filter((m) => m.kind === k).length;
            return (
              <KindChip
                key={k}
                active={kindFilter === k}
                href={buildHref(`/org/${orgId}/missions/catalog`, {
                  kind: k,
                  packId,
                  inPack: onlyInPack ? "1" : undefined,
                })}
                label={meta.label}
                icon={meta.icon}
                count={count}
              />
            );
          })}
        </div>
      </section>

      {/* In-pack toggle */}
      {packId && (
        <section className="flex items-center justify-between gap-2 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-xs">
          <span className="text-[#6B6560]">
            이 스탬프북에 이미 담긴 미션만 보기
          </span>
          <Link
            href={buildHref(`/org/${orgId}/missions/catalog`, {
              kind: kindFilter === "ALL" ? undefined : kindFilter,
              packId,
              inPack: onlyInPack ? undefined : "1",
            })}
            className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
              onlyInPack
                ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                : "border-[#D4E4BC] bg-[#FFF8F0] text-[#2D5A3D] hover:bg-[#F5F1E8]"
            }`}
          >
            {onlyInPack ? "🧺 담긴 것만" : "🗂 전체 보기"}
          </Link>
        </section>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState hasAny={available.length > 0} orgId={orgId} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((m) => (
            <MissionCard
              key={m.id}
              mission={m}
              partnerName={partnerNames[m.partner_id]}
              packId={packId}
              alreadyInPack={inPackSourceIds.has(m.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function MissionCard({
  mission,
  partnerName,
  packId,
  alreadyInPack,
}: {
  mission: PartnerMissionRow;
  partnerName: string | undefined;
  packId: string | undefined;
  alreadyInPack: boolean;
}) {
  const kindMeta = MISSION_KIND_META[mission.kind];
  return (
    <li className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm transition hover:border-[#2D5A3D] hover:shadow-md">
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#E8F0E4] text-2xl"
          aria-hidden
        >
          {mission.icon || kindMeta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
              <span aria-hidden>{kindMeta.icon}</span>
              <span>{kindMeta.label}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              <AcornIcon size={12} />
              <span>+{mission.default_acorns}</span>
            </span>
            {alreadyInPack && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                <span aria-hidden>✓</span>
                <span>담김</span>
              </span>
            )}
          </div>
          <h3 className="mt-1.5 truncate text-base font-bold text-[#2C2C2C]">
            {mission.title || "(제목 없음)"}
          </h3>
          {mission.description && (
            <p className="mt-1 line-clamp-2 text-xs text-[#6B6560]">
              {mission.description}
            </p>
          )}
          <p className="mt-1 text-[10px] text-[#8B7F75]">
            🏢 지사: {partnerName ?? "(미상)"}
          </p>
        </div>
      </div>

      <div className="mt-auto pt-1">
        <CopyToOrgButton
          partnerMissionId={mission.id}
          questPackId={packId}
          alreadyInPack={alreadyInPack}
        />
      </div>
    </li>
  );
}

function EmptyState({
  hasAny,
  orgId,
}: {
  hasAny: boolean;
  orgId: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
      <div className="text-5xl" aria-hidden>
        {hasAny ? "🔍" : "🌱"}
      </div>
      <p className="mt-3 text-base font-bold text-[#2D5A3D]">
        {hasAny
          ? "조건에 맞는 미션이 없어요"
          : "아직 배포받은 미션이 없어요"}
      </p>
      <p className="mt-1 max-w-sm text-xs text-[#6B6560]">
        {hasAny
          ? "다른 종류를 선택하거나 필터를 초기화해 보세요."
          : "지사에 문의하시거나, 공개되기를 기다려 주세요."}
      </p>
      <Link
        href={`/org/${orgId}/quest-packs`}
        className="mt-4 inline-flex items-center gap-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] hover:bg-[#F5F1E8]"
      >
        ← 스탬프북으로 돌아가기
      </Link>
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
