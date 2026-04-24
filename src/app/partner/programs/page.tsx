import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";
import {
  deleteProgramAction,
  updateProgramVisibilityAction,
  setProgramAssignmentsAction,
  type ProgramCategory,
} from "./actions";
import {
  VISIBILITY_META,
  type ProgramVisibility,
} from "@/lib/partner-programs/types";
import { VisibilityQuickControl } from "@/components/visibility-quick-control";
import { ListSearchBar } from "@/components/list-search-bar";

type Program = {
  id: string;
  partner_id: string | null;
  title: string;
  description: string | null;
  category: ProgramCategory;
  duration_hours: number | null;
  capacity_min: number | null;
  capacity_max: number | null;
  price_per_person: number;
  b2b_price_per_person: number | null;
  location_region: string | null;
  location_detail: string | null;
  image_url: string | null;
  tags: string[] | null;
  rating_avg: number | null;
  rating_count: number;
  booking_count: number;
  is_published: boolean;
  visibility: ProgramVisibility;
  created_at: string;
};

const CATEGORY_META: Record<
  ProgramCategory,
  { label: string; icon: string; chip: string }
> = {
  FOREST: {
    label: "숲 체험",
    icon: "🌲",
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  CAMPING: {
    label: "캠핑",
    icon: "⛺",
    chip: "bg-amber-50 text-amber-800 border-amber-200",
  },
  KIDS: {
    label: "유아·키즈",
    icon: "👶",
    chip: "bg-rose-50 text-rose-700 border-rose-200",
  },
  FAMILY: {
    label: "가족",
    icon: "👨‍👩‍👧",
    chip: "bg-sky-50 text-sky-700 border-sky-200",
  },
  TEAM: {
    label: "기업 팀빌딩",
    icon: "🏢",
    chip: "bg-violet-50 text-violet-700 border-violet-200",
  },
  ART: {
    label: "아트·공예",
    icon: "🎨",
    chip: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  },
};

function formatWon(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  return `${n.toLocaleString("ko-KR")}원`;
}

function formatHours(h: number | null): string {
  if (h === null || h === undefined) return "-";
  return `${h}시간`;
}

function renderStars(avg: number | null, count: number): string {
  if (!avg || count === 0) return "리뷰 없음";
  const rounded = Math.round(avg);
  return `${"★".repeat(Math.max(0, Math.min(5, rounded)))}${"☆".repeat(
    Math.max(0, 5 - Math.min(5, rounded))
  )} ${avg.toFixed(1)} (${count})`;
}

async function loadPrograms(partnerId: string | null): Promise<Program[]> {
  const supabase = await createClient();
  const columns =
    "id,partner_id,title,description,category,duration_hours,capacity_min,capacity_max,price_per_person,b2b_price_per_person,location_region,location_detail,image_url,tags,rating_avg,rating_count,booking_count,is_published,visibility,created_at";

  const query = supabase
    .from("partner_programs")
    .select(columns)
    .order("created_at", { ascending: false });

  const { data, error } = partnerId
    ? await query.eq("partner_id", partnerId)
    : await query;

  if (error) {
    console.error("[partner/programs] load error", error);
    return [];
  }
  return (data ?? []) as unknown as Program[];
}

async function loadPartnerOrgs(partnerId: string) {
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

async function loadProgramAssignments(programIds: string[]) {
  if (programIds.length === 0) return new Map<string, string[]>();
  const supabase = await createClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        in: (k: string, v: string[]) => Promise<{
          data: Array<{ program_id: string; org_id: string }> | null;
        }>;
      };
    };
  };
  const { data } = await sb
    .from("partner_program_assignments")
    .select("program_id,org_id")
    .in("program_id", programIds);
  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    if (!map.has(row.program_id)) map.set(row.program_id, []);
    map.get(row.program_id)!.push(row.org_id);
  }
  return map;
}

export default async function PartnerProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const partner = await requirePartner();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const categoryFilter = (sp.category ?? "").trim();

  const allPrograms = await loadPrograms(partner.id);
  const [orgs, assignmentsMap] = await Promise.all([
    loadPartnerOrgs(partner.id),
    loadProgramAssignments(allPrograms.map((p) => p.id)),
  ]);

  // 모든 실제 사용된 카테고리 수집 (검색 드롭다운 옵션용)
  const usedCategories = Array.from(
    new Set(allPrograms.map((p) => p.category).filter(Boolean))
  ).sort();
  const categoryOptions = usedCategories.map((c) => {
    const meta = CATEGORY_META[c as keyof typeof CATEGORY_META];
    return {
      value: c,
      label: meta ? `${meta.icon} ${meta.label}` : c,
    };
  });

  // 필터 적용
  const programs = allPrograms.filter((p) => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (q && !p.title.toLowerCase().includes(q)) return false;
    return true;
  });

  const total = allPrograms.length;
  const publishedCount = allPrograms.filter(
    (p) => p.visibility === "ALL" || p.visibility === "SELECTED"
  ).length;
  const hiddenCount = total - publishedCount;
  const totalBookings = allPrograms.reduce((sum, p) => sum + (p.booking_count ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">프로그램 관리</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              🗺️
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
                내 프로그램
              </h1>
              <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
                체험 상품을 등록하고 게시 상태를 관리하세요.
              </p>
            </div>
          </div>
          <Link
            href="/partner/programs/new"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40"
          >
            <span aria-hidden>+</span>
            <span>새 프로그램</span>
          </Link>
        </div>
      </header>

      {/* 통계 */}
      <section aria-label="프로그램 통계" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-[#6B6560]">총 프로그램</p>
          <p className="mt-1 text-2xl font-extrabold text-[#2D5A3D]">{total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[11px] font-semibold text-emerald-700">게시 중</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-900">{publishedCount}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-[11px] font-semibold text-zinc-600">숨김</p>
          <p className="mt-1 text-2xl font-extrabold text-zinc-800">{hiddenCount}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[11px] font-semibold text-amber-700">총 예약</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-900">
            {totalBookings.toLocaleString("ko-KR")}
          </p>
        </div>
      </section>

      {/* 검색 & 카테고리 필터 */}
      {allPrograms.length > 0 && (
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-3 shadow-sm">
          <ListSearchBar
            queryKey="q"
            selectKey="category"
            selectLabel="전체 카테고리"
            selectOptions={categoryOptions}
            placeholder="프로그램 이름으로 검색..."
          />
          {(q || categoryFilter) && (
            <p className="mt-2 text-[11px] text-[#6B6560]">
              🔍 검색 결과 {programs.length}개
              {categoryFilter && (
                <span className="ml-1">
                  · 카테고리: <strong>{categoryFilter}</strong>
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

      {/* 목록 */}
      {programs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="text-5xl" aria-hidden>
            {allPrograms.length === 0 ? "🌱" : "🔍"}
          </div>
          <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
            {allPrograms.length === 0
              ? "아직 등록된 프로그램이 없어요"
              : "검색 결과가 없어요"}
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            {allPrograms.length === 0
              ? "첫 번째 체험 프로그램을 등록해 보세요."
              : "키워드나 카테고리 필터를 바꿔보세요."}
          </p>
          {allPrograms.length === 0 && (
            <Link
              href="/partner/programs/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-bold text-white hover:bg-[#234a30]"
            >
              <span aria-hidden>+</span>
              <span>새 프로그램 만들기</span>
            </Link>
          )}
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {programs.map((p) => {
            const builtinMeta = CATEGORY_META[p.category];
            const meta = builtinMeta ?? {
              label: p.category,
              icon: "🏷️",
              chip: "bg-zinc-50 text-zinc-700 border-zinc-200",
            };
            return (
              <article
                key={p.id}
                className="overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm transition hover:shadow-md"
              >
                {/* Thumbnail */}
                <div className="relative flex h-40 w-full items-center justify-center bg-gradient-to-br from-[#E8F0E4] to-[#FAE7D0]">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-6xl" aria-hidden>
                      {meta.icon}
                    </span>
                  )}
                  {/* Visibility badge */}
                  {(() => {
                    const vm = VISIBILITY_META[p.visibility];
                    return (
                      <span
                        className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${vm.color}`}
                      >
                        {vm.icon} {vm.label}
                      </span>
                    );
                  })()}

                  {/* 우측 상단 아이콘 액션 (편집/삭제) */}
                  <div className="absolute right-2 top-2 flex items-center gap-1">
                    <Link
                      href={`/partner/programs/${p.id}/edit`}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E5D3B8] bg-white/90 text-sm shadow-sm backdrop-blur-sm transition hover:bg-[#FFF8F0]"
                      aria-label="편집"
                      title="편집"
                    >
                      ✏️
                    </Link>
                    <form
                      action={async () => {
                        "use server";
                        await deleteProgramAction(p.id);
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
                </div>

                {/* Body */}
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.chip}`}
                    >
                      <span aria-hidden>{meta.icon}</span>
                      <span>{meta.label}</span>
                    </span>
                    {p.duration_hours ? (
                      <span className="rounded-full border border-[#E5D3B8] bg-[#FFF8F0] px-2 py-0.5 text-[10px] font-medium text-[#8B6F47]">
                        ⏱ {formatHours(p.duration_hours)}
                      </span>
                    ) : null}
                    {p.location_region ? (
                      <span className="rounded-full border border-[#D4E4BC] bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-medium text-[#2D5A3D]">
                        📍 {p.location_region}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mt-2 text-base font-bold text-[#2D5A3D] truncate">
                    {p.title}
                  </h3>
                  {p.description ? (
                    <p className="mt-1 text-xs text-[#6B6560] line-clamp-2">
                      {p.description}
                    </p>
                  ) : null}

                  {/* Price */}
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-lg font-extrabold text-[#2D5A3D]">
                      {formatWon(p.price_per_person)}
                    </span>
                    <span className="text-[11px] text-[#6B6560]">/ 1인</span>
                    {p.b2b_price_per_person ? (
                      <span className="ml-2 text-[11px] text-[#8B6F47]">
                        B2B {formatWon(p.b2b_price_per_person)}
                      </span>
                    ) : null}
                  </div>

                  {/* Rating + bookings */}
                  <div className="mt-2 flex items-center justify-between text-[11px] text-[#6B6560]">
                    <span className="text-amber-600">
                      {renderStars(p.rating_avg, p.rating_count)}
                    </span>
                    <span>예약 {p.booking_count.toLocaleString("ko-KR")}건</span>
                  </div>

                  {/* 배포 대상 (visibility + assignments) */}
                  <div className="mt-3">
                    <VisibilityQuickControl
                      resourceId={p.id}
                      currentVisibility={p.visibility}
                      initialAssignedOrgIds={assignmentsMap.get(p.id) ?? []}
                      availableOrgs={orgs}
                      updateVisibilityAction={updateProgramVisibilityAction}
                      setAssignmentsAction={setProgramAssignmentsAction}
                      editHref={`/partner/programs/${p.id}/edit`}
                    />
                  </div>

                </div>
              </article>
            );
          })}
        </section>
      )}

    </div>
  );
}
