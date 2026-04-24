import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { loadOrgQuestPacks } from "@/lib/missions/queries";
import {
  QUEST_PACK_STATUS_META,
  type OrgQuestPackRow,
  type QuestPackStatus,
} from "@/lib/missions/types";
import { loadPartnerDisplayNameForOrg } from "@/lib/org-partner";
import { DeletePackButton } from "./delete-pack-button";

export const dynamic = "force-dynamic";

type StatusFilter = "ALL" | QuestPackStatus;

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "LIVE", label: "진행중" },
  { key: "DRAFT", label: "초안" },
  { key: "ENDED", label: "종료" },
  { key: "ARCHIVED", label: "보관됨" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

async function loadMissionCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  packIds: string[]
): Promise<Record<string, number>> {
  if (packIds.length === 0) return {};
  const resp = (await (
    supabase.from("org_missions" as never) as unknown as {
      select: (c: string) => {
        in: (
          k: string,
          v: string[]
        ) => Promise<{
          data: Array<{ quest_pack_id: string | null }> | null;
        }>;
      };
    }
  )
    .select("quest_pack_id")
    .in("quest_pack_id", packIds)) as {
    data: Array<{ quest_pack_id: string | null }> | null;
  };
  const counts: Record<string, number> = {};
  for (const r of resp.data ?? []) {
    if (!r.quest_pack_id) continue;
    counts[r.quest_pack_id] = (counts[r.quest_pack_id] ?? 0) + 1;
  }
  return counts;
}

export default async function OrgQuestPacksPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { orgId } = await params;
  const session = await requireOrg();

  const sp = await searchParams;
  const statusFilter: StatusFilter =
    sp.status === "DRAFT" ||
    sp.status === "LIVE" ||
    sp.status === "ENDED" ||
    sp.status === "ARCHIVED"
      ? sp.status
      : "ALL";

  const [all, partnerName] = await Promise.all([
    loadOrgQuestPacks(orgId),
    loadPartnerDisplayNameForOrg(orgId),
  ]);
  const supabase = await createClient();
  const counts = await loadMissionCounts(
    supabase,
    all.map((p) => p.id)
  );

  const list = all.filter((p) => {
    if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
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
        <span className="font-semibold text-[#2D5A3D]">스탬프북 관리</span>
      </nav>

      {/* Header */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#4A7C59] to-[#2D5A3D] p-6 text-white shadow-sm md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#D4E4BC]">
              Org · Quest Packs
            </p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold md:text-3xl">
              <span aria-hidden>🌲</span>
              <span>우리 기관 스탬프북</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[#E8F0E4]">
              아이들에게 나눠줄 스탬프북을 만들고, {partnerName}에서 개발한
              미션을 담아 공개하세요.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/org/${orgId}/quest-packs/from-preset`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700"
            >
              <span aria-hidden>✨</span>
              <span>프리셋으로 빠르게 시작</span>
            </Link>
            <Link
              href={`/org/${orgId}/quest-packs/new`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#2D5A3D] shadow-sm transition hover:bg-[#F5F1E8]"
            >
              <span aria-hidden>➕</span>
              <span>새 스탬프북</span>
            </Link>
          </div>
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
                : all.filter((p) => p.status === tab.key).length;
            const href =
              tab.key === "ALL"
                ? `/org/${orgId}/quest-packs`
                : `/org/${orgId}/quest-packs?status=${tab.key}`;
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
        <EmptyState hasAny={all.length > 0} orgId={orgId} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <PackCard
              key={p.id}
              pack={p}
              missionCount={counts[p.id] ?? 0}
              orgId={orgId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PackCard({
  pack,
  missionCount,
  orgId,
}: {
  pack: OrgQuestPackRow;
  missionCount: number;
  orgId: string;
}) {
  const statusMeta = QUEST_PACK_STATUS_META[pack.status];
  const isLive = pack.status === "LIVE";
  return (
    <li
      className={`relative overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-md ${
        isLive
          ? "border-2 border-emerald-500 shadow-emerald-100 ring-2 ring-emerald-300/40 hover:border-emerald-600"
          : "border border-[#D4E4BC] hover:border-[#2D5A3D]"
      }`}
    >
      {/* LIVE 강조 코너 리본 */}
      {isLive && (
        <div className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-md ring-2 ring-white">
          <span className="relative inline-flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          <span>📡 공개중</span>
        </div>
      )}

      {pack.cover_image_url ? (
        <div
          className="h-28 w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${pack.cover_image_url})` }}
          role="img"
          aria-label={`${pack.name} 커버 이미지`}
        />
      ) : (
        <div
          className={`flex h-28 w-full items-center justify-center text-5xl ${
            isLive
              ? "bg-gradient-to-br from-emerald-100 via-[#D4E4BC] to-emerald-200"
              : "bg-gradient-to-br from-[#E8F0E4] to-[#D4E4BC]"
          }`}
          aria-hidden
        >
          🌲
        </div>
      )}
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              isLive
                ? "border-emerald-500 bg-emerald-500 text-white"
                : statusMeta.color
            }`}
          >
            {isLive ? "🟢 진행중" : statusMeta.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
            <span aria-hidden>🎯</span>
            <span>{missionCount}개 미션</span>
          </span>
        </div>
        <h3
          className={`truncate text-base font-bold ${
            isLive ? "text-emerald-900" : "text-[#2C2C2C]"
          }`}
        >
          {pack.name || "(이름 없음)"}
        </h3>
        <p className="text-[11px] text-[#6B6560]">
          📅 {fmtDate(pack.starts_at)} ~ {fmtDate(pack.ends_at)}
        </p>
        {pack.description && (
          <p className="line-clamp-2 text-xs text-[#6B6560]">
            {pack.description}
          </p>
        )}
        <div className="mt-1 flex gap-2 pt-2">
          <Link
            href={`/org/${orgId}/quest-packs/${pack.id}/edit`}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#234a30]"
          >
            <span aria-hidden>✏️</span>
            <span>편집</span>
          </Link>
          <Link
            href={`/org/${orgId}/quest-packs/${pack.id}/preview`}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
          >
            <span aria-hidden>👀</span>
            <span>미리보기</span>
          </Link>
          <DeletePackButton
            packId={pack.id}
            packName={pack.name}
            disabled={isLive}
            disabledReason={
              isLive
                ? "공개중인 스탬프북은 바로 삭제할 수 없어요. 먼저 '종료' 또는 '보관'을 눌러 주세요."
                : undefined
            }
          />
        </div>
      </div>
    </li>
  );
}

function EmptyState({ hasAny, orgId }: { hasAny: boolean; orgId: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
      <div className="text-5xl" aria-hidden>
        {hasAny ? "🔍" : "🌱"}
      </div>
      <p className="mt-3 text-base font-bold text-[#2D5A3D]">
        {hasAny
          ? "조건에 맞는 스탬프북이 없어요"
          : "첫 스탬프북을 만들어 아이들에게 나눠주세요"}
      </p>
      <p className="mt-1 max-w-sm text-xs text-[#6B6560]">
        {hasAny
          ? "다른 상태를 선택해 보세요."
          : "기간과 미션을 담아 공개하면, 아이들이 숲길을 따라 스탬프를 모을 수 있어요."}
      </p>
      {!hasAny && (
        <Link
          href={`/org/${orgId}/quest-packs/new`}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#234a30]"
        >
          <span aria-hidden>➕</span>
          <span>새 스탬프북 만들기</span>
        </Link>
      )}
    </div>
  );
}
