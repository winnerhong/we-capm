// 전체 스탬프북 리스트 — 진행 중 / 완료 / 곧 마감 / 전체 필터
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/user-auth-guard";
import {
  loadOrgQuestPacks,
  loadOrgMissionsByQuestPack,
  loadUserSubmissions,
  sumAcornsForPack,
} from "@/lib/missions/queries";
import { computePackProgress, type PackProgress } from "@/lib/missions/progress";
import type { OrgQuestPackRow } from "@/lib/missions/types";
import { QUEST_PACK_STATUS_META } from "@/lib/missions/types";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

type FilterKey = "active" | "done" | "ending" | "all";

interface EnrichedPack {
  pack: OrgQuestPackRow;
  progress: PackProgress;
  isLiveNow: boolean;
  daysLeft: number | null;
}

function computeDaysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function isPackLiveNow(pack: OrgQuestPackRow): boolean {
  if (pack.status !== "LIVE") return false;
  const now = Date.now();
  const startsOk =
    !pack.starts_at || new Date(pack.starts_at).getTime() <= now;
  const endsOk = !pack.ends_at || new Date(pack.ends_at).getTime() >= now;
  return startsOk && endsOk;
}

function matchesFilter(p: EnrichedPack, filter: FilterKey): boolean {
  switch (filter) {
    case "active":
      return p.isLiveNow && !p.progress.isComplete;
    case "done":
      return p.progress.isComplete;
    case "ending":
      return (
        p.isLiveNow &&
        p.daysLeft !== null &&
        p.daysLeft >= 0 &&
        p.daysLeft <= 3
      );
    case "all":
    default:
      return true;
  }
}

function formatDateRange(starts: string | null, ends: string | null): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
    });
  if (starts && ends) return `${fmt(starts)} ~ ${fmt(ends)}`;
  if (ends) return `~ ${fmt(ends)}`;
  if (starts) return `${fmt(starts)} ~`;
  return "상시";
}

export default async function StampbookListPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requireAppUser();
  const { filter: rawFilter } = await searchParams;
  const filter: FilterKey =
    rawFilter === "done" ||
    rawFilter === "ending" ||
    rawFilter === "all"
      ? rawFilter
      : "active";

  const allPacks = await loadOrgQuestPacks(user.orgId);

  const enriched: EnrichedPack[] = await Promise.all(
    allPacks.map(async (pack) => {
      const [missions, submissions, acorns] = await Promise.all([
        loadOrgMissionsByQuestPack(pack.id),
        loadUserSubmissions(user.id, { packId: pack.id }),
        sumAcornsForPack(user.id, pack.id),
      ]);
      const progress = computePackProgress(missions, submissions, acorns);
      return {
        pack,
        progress,
        isLiveNow: isPackLiveNow(pack),
        daysLeft: computeDaysLeft(pack.ends_at),
      };
    })
  );

  // Hide DRAFT packs from users entirely
  const visible = enriched.filter(
    (e) => e.pack.status === "LIVE" || e.pack.status === "ENDED"
  );

  // 팩이 단 하나뿐이면 리스트를 건너뛰고 바로 상세로 이동
  // 필터 탭을 직접 선택한 경우(filter 쿼리 존재)에는 목록을 유지
  if (!rawFilter && visible.length === 1) {
    redirect(`/stampbook/${visible[0].pack.id}`);
  }

  const filtered = visible.filter((p) => matchesFilter(p, filter));

  // 정렬: 진행 중 먼저, 그 다음 updated_at DESC
  filtered.sort((a, b) => {
    if (a.isLiveNow !== b.isLiveNow) return a.isLiveNow ? -1 : 1;
    return (
      new Date(b.pack.updated_at).getTime() -
      new Date(a.pack.updated_at).getTime()
    );
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-[#2D5A3D]">📚 스탬프북</h1>
        <p className="mt-1 text-xs text-[#6B6560]">
          가족과 함께할 숲속 미션 모음
        </p>
      </header>

      {/* 필터 탭 */}
      <nav
        className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-[#D4E4BC] bg-white/80 p-1"
        aria-label="스탬프북 필터"
      >
        <FilterTab current={filter} value="active" label="진행 중" />
        <FilterTab current={filter} value="done" label="완료" />
        <FilterTab current={filter} value="ending" label="곧 마감" />
        <FilterTab current={filter} value="all" label="전체" />
      </nav>

      {/* List */}
      {filtered.length === 0 ? (
        <section className="rounded-3xl border-2 border-dashed border-[#D4E4BC] bg-white/70 px-6 py-12 text-center">
          <p className="text-4xl" aria-hidden>
            🌿
          </p>
          <p className="mt-3 text-sm font-bold text-[#2D5A3D]">
            {filter === "done"
              ? "완료한 스탬프북이 아직 없어요"
              : filter === "ending"
                ? "곧 마감되는 스탬프북이 없어요"
                : "진행 중인 스탬프북이 없어요"}
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            새로운 모험이 준비 중이에요!
          </p>
        </section>
      ) : (
        <ul className="space-y-3">
          {filtered.map((e) => (
            <li key={e.pack.id}>
              <PackListCard enriched={e} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterTab({
  current,
  value,
  label,
}: {
  current: FilterKey;
  value: FilterKey;
  label: string;
}) {
  const active = current === value;
  return (
    <Link
      href={`/stampbook?filter=${value}`}
      className={`min-h-[36px] flex-shrink-0 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition ${
        active
          ? "bg-[#2D5A3D] text-white shadow-sm"
          : "text-[#6B6560] hover:bg-[#F5F1E8]"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}

function PackListCard({ enriched }: { enriched: EnrichedPack }) {
  const { pack, progress, isLiveNow, daysLeft } = enriched;
  const meta = QUEST_PACK_STATUS_META[pack.status];
  const pctDisplay = Math.max(4, Math.min(100, progress.percent));
  const isEnding =
    isLiveNow && daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;

  return (
    <Link
      href={`/stampbook/${pack.id}`}
      className="block overflow-hidden rounded-3xl border border-[#D4E4BC] bg-white p-4 shadow-sm transition hover:shadow-md active:scale-[0.995]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.color}`}
            >
              {meta.label}
            </span>
            {isEnding && (
              <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                ⏰ {daysLeft === 0 ? "오늘 마감" : `${daysLeft}일 남음`}
              </span>
            )}
            {progress.isComplete && (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                🎉 완료
              </span>
            )}
          </div>
          <h3 className="mt-1 truncate text-base font-bold text-[#2D5A3D]">
            {pack.name}
          </h3>
          <p className="mt-0.5 text-[11px] text-[#6B6560]">
            📅 {formatDateRange(pack.starts_at, pack.ends_at)}
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-[#D4E4BC] bg-[#F5F1E8] px-2.5 py-1.5 text-center">
          <p className="text-sm font-bold tabular-nums text-[#2D5A3D]">
            {progress.completedSlots}/{progress.totalSlots}
          </p>
          <p className="text-[9px] font-semibold text-[#6B6560]">스탬프</p>
        </div>
      </div>

      {/* progress bar */}
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#F5F1E8]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#3A7A52] to-[#4A7C59] transition-all"
          style={{ width: `${pctDisplay}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px]">
        <span className="font-semibold text-[#2D5A3D]">
          {progress.percent}%
        </span>
        <span className="text-[#6B6560]">
          <AcornIcon /> {progress.acornsEarned} / {progress.acornsPossible}
        </span>
      </div>
    </Link>
  );
}
