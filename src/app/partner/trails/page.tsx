import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  DIFFICULTY_META,
  STATUS_META,
  type TrailRow,
  type TrailStatus,
  type TrailDifficulty,
} from "@/lib/trails/types";
import {
  deleteTrailAction,
  updateTrailVisibilityAction,
  setTrailAssignmentsAction,
} from "./actions";
import { VisibilityQuickControl } from "@/components/visibility-quick-control";
import { ListSearchBar } from "@/components/list-search-bar";

export const dynamic = "force-dynamic";

type FilterKey = "ALL" | TrailStatus;

const DIFFICULTY_STYLE: Record<TrailDifficulty, string> = {
  EASY: "bg-[#F5F1E8] text-[#2D5A3D] border-[#D4E4BC]",
  MEDIUM: "bg-amber-50 text-amber-800 border-amber-200",
  HARD: "bg-rose-50 text-rose-800 border-rose-200",
};

const STATUS_ICON: Record<TrailStatus, string> = {
  DRAFT: "📝",
  PUBLISHED: "🌳",
  ARCHIVED: "📦",
};

const TAB_FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "DRAFT", label: "초안" },
  { key: "PUBLISHED", label: "공개중" },
  { key: "ARCHIVED", label: "보관" },
];

async function loadTrails(partnerId: string): Promise<TrailRow[]> {
  const supabase = await createClient();
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: unknown[] | null }>;
        };
      };
    };
  };
  const { data } = await client
    .from("partner_trails")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });
  return (data ?? []) as TrailRow[];
}

async function loadPartnerOrgsForTrails(partnerId: string) {
  const supabase = await createClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (c: string, o: { ascending: boolean }) => Promise<{
            data:
              | Array<{ id: string; org_name: string; org_type: string | null }>
              | null;
          }>;
        };
      };
    };
  };
  const { data } = await sb
    .from("partner_orgs")
    .select("id,org_name,org_type")
    .eq("partner_id", partnerId)
    .order("org_name", { ascending: true });
  return (data ?? []).map((o) => ({
    id: o.id,
    name: o.org_name,
    type: o.org_type,
  }));
}

async function loadTrailAssignments(trailIds: string[]) {
  if (trailIds.length === 0) return new Map<string, string[]>();
  const supabase = await createClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        in: (k: string, v: string[]) => Promise<{
          data: Array<{ trail_id: string; org_id: string }> | null;
        }>;
      };
    };
  };
  const { data } = await sb
    .from("partner_trail_assignments")
    .select("trail_id,org_id")
    .in("trail_id", trailIds);
  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    if (!map.has(row.trail_id)) map.set(row.trail_id, []);
    map.get(row.trail_id)!.push(row.org_id);
  }
  return map;
}

export default async function TrailsListPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    q?: string;
    difficulty?: string;
  }>;
}) {
  const partner = await requirePartner();
  const sp = await searchParams;
  const filter = sp.filter;
  const q = (sp.q ?? "").trim().toLowerCase();
  const difficultyFilter = (sp.difficulty ?? "").trim();

  const activeFilter: FilterKey =
    filter === "DRAFT" ||
    filter === "PUBLISHED" ||
    filter === "ARCHIVED"
      ? filter
      : "ALL";

  const all = await loadTrails(partner.id);
  const list = all.filter((t) => {
    if (activeFilter !== "ALL" && t.status !== activeFilter) return false;
    if (difficultyFilter && t.difficulty !== difficultyFilter) return false;
    if (q && !t.name.toLowerCase().includes(q)) return false;
    return true;
  });
  const [orgs, assignmentsMap] = await Promise.all([
    loadPartnerOrgsForTrails(partner.id),
    loadTrailAssignments(list.map((t) => t.id)),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <nav className="text-xs text-[#6B6560]">
        <Link href="/partner/dashboard" className="hover:underline">
          대시보드
        </Link>
        <span className="mx-1">›</span>
        <span className="font-semibold text-[#2D5A3D]">나만의 숲길</span>
      </nav>

      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#4A7C59] to-[#2D5A3D] p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#D4E4BC]">
              Partner · Trails
            </p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold md:text-3xl">
              <span>🗺️</span>
              <span>나만의 숲길</span>
            </h1>
            <p className="mt-1 text-sm text-[#D4E4BC]">
              QR과 미션으로 우리 숲만의 특별한 코스를 만들어보세요.
            </p>
          </div>
          <Link
            href="/partner/trails/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#2D5A3D] shadow-sm transition hover:bg-[#F5F1E8]"
          >
            <span>➕</span>
            <span>새 숲길 만들기</span>
          </Link>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {TAB_FILTERS.map((tab) => {
          const isActive = tab.key === activeFilter;
          const count =
            tab.key === "ALL"
              ? all.length
              : all.filter((t) => t.status === tab.key).length;
          const href =
            tab.key === "ALL"
              ? "/partner/trails"
              : `/partner/trails?filter=${tab.key}`;
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

      {/* 검색 & 난이도 필터 */}
      {all.length > 0 && (
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-3 shadow-sm">
          <ListSearchBar
            queryKey="q"
            selectKey="difficulty"
            selectLabel="전체 난이도"
            selectOptions={[
              { value: "EASY", label: "🌱 쉬움" },
              { value: "MEDIUM", label: "🌿 보통" },
              { value: "HARD", label: "🌲 어려움" },
            ]}
            placeholder="숲길 이름으로 검색..."
            preserveKeys={["filter"]}
          />
          {(q || difficultyFilter) && (
            <p className="mt-2 text-[11px] text-[#6B6560]">
              🔍 검색 결과 {list.length}개
              {difficultyFilter && (
                <span className="ml-1">
                  · 난이도: <strong>{difficultyFilter}</strong>
                </span>
              )}
              {q && (
                <span className="ml-1">
                  · 키워드: <strong>&ldquo;{q}&rdquo;</strong>
                </span>
              )}
            </p>
          )}
        </section>
      )}

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="text-5xl">🌱</div>
          <p className="mt-3 text-base font-bold text-[#2D5A3D]">
            아직 나만의 숲길이 없어요. 우리 숲의 특별한 코스를 만들어보세요!
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            이름과 난이도만 정해도 시작할 수 있어요. 지점은 나중에 추가하세요.
          </p>
          <Link
            href="/partner/trails/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#4A7C59]"
          >
            <span>➕</span>
            <span>첫 숲길 만들기</span>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => {
            const diff = DIFFICULTY_META[t.difficulty];
            const diffClass = DIFFICULTY_STYLE[t.difficulty];
            const st = STATUS_META[t.status];
            const stIcon = STATUS_ICON[t.status];

            return (
              <article
                key={t.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm transition hover:border-[#2D5A3D] hover:shadow-md"
              >
                <Link
                  href={`/partner/trails/${t.id}`}
                  className="relative block aspect-[16/9] w-full bg-gradient-to-br from-[#D4E4BC] to-[#E8F0E4]"
                >
                  {t.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.cover_image_url}
                      alt={t.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl">
                      🌲
                    </div>
                  )}
                  <span
                    className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${st.color}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        t.status === "PUBLISHED"
                          ? "bg-emerald-500"
                          : t.status === "ARCHIVED"
                          ? "bg-zinc-400"
                          : "bg-amber-500"
                      }`}
                      aria-hidden
                    />
                    {stIcon} {st.label}
                  </span>
                </Link>

                {/* 우측 상단 아이콘 액션 (편집/삭제) */}
                <div className="absolute right-2 top-2 flex items-center gap-1">
                  <Link
                    href={`/partner/trails/${t.id}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E5D3B8] bg-white/90 text-sm shadow-sm backdrop-blur-sm transition hover:bg-[#FFF8F0]"
                    aria-label="편집"
                    title="편집"
                  >
                    ✏️
                  </Link>
                  <form
                    action={async () => {
                      "use server";
                      await deleteTrailAction(t.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 bg-white/90 text-sm shadow-sm backdrop-blur-sm transition hover:bg-rose-50"
                      aria-label="삭제"
                      title="삭제"
                    >
                      🗑
                    </button>
                  </form>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${diffClass}`}
                    >
                      {diff.icon} {diff.label}
                    </span>
                    {t.estimated_minutes !== null &&
                      t.estimated_minutes !== undefined && (
                        <span className="inline-flex items-center rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                          ⏱ {t.estimated_minutes}분
                        </span>
                      )}
                    <span className="inline-flex items-center rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                      📍 {t.total_slots}개 지점
                    </span>
                  </div>

                  <Link
                    href={`/partner/trails/${t.id}`}
                    className="mt-2 text-base font-bold text-[#2C2C2C] transition group-hover:text-[#2D5A3D]"
                  >
                    {t.name}
                  </Link>

                  {t.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-[#6B6560]">
                      {t.description}
                    </p>
                  )}

                  <div className="mt-auto pt-3 text-[10px] text-[#6B6560]">
                    👀 {t.view_count ?? 0} · 🏆 {t.completion_count ?? 0}
                  </div>

                  {/* 배포 대상 (visibility + assignments) */}
                  <div className="mt-3">
                    <VisibilityQuickControl
                      resourceId={t.id}
                      currentVisibility={t.visibility}
                      initialAssignedOrgIds={assignmentsMap.get(t.id) ?? []}
                      availableOrgs={orgs}
                      updateVisibilityAction={updateTrailVisibilityAction}
                      setAssignmentsAction={setTrailAssignmentsAction}
                      editHref={`/partner/trails/${t.id}`}
                    />
                  </div>

                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
