import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";
import {
  deleteProgramAction,
  togglePublishAction,
  type ProgramCategory,
} from "./actions";

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
    "id,partner_id,title,description,category,duration_hours,capacity_min,capacity_max,price_per_person,b2b_price_per_person,location_region,location_detail,image_url,tags,rating_avg,rating_count,booking_count,is_published,created_at";

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
  return (data ?? []) as Program[];
}

export default async function PartnerProgramsPage() {
  const partner = await requirePartner();
  const programs = await loadPrograms(partner.id);

  const total = programs.length;
  const publishedCount = programs.filter((p) => p.is_published).length;
  const hiddenCount = total - publishedCount;
  const totalBookings = programs.reduce((sum, p) => sum + (p.booking_count ?? 0), 0);

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

      {/* 목록 */}
      {programs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="text-5xl" aria-hidden>
            🌱
          </div>
          <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
            아직 등록된 프로그램이 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            첫 번째 체험 프로그램을 등록해 보세요.
          </p>
          <Link
            href="/partner/programs/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-bold text-white hover:bg-[#234a30]"
          >
            <span aria-hidden>+</span>
            <span>새 프로그램 만들기</span>
          </Link>
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {programs.map((p) => {
            const meta = CATEGORY_META[p.category] ?? CATEGORY_META.FOREST;
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
                  {/* Published badge */}
                  <span
                    className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      p.is_published
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-zinc-300 bg-white/90 text-zinc-600"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        p.is_published ? "bg-emerald-500" : "bg-zinc-400"
                      }`}
                      aria-hidden
                    />
                    {p.is_published ? "게시 중" : "숨김"}
                  </span>
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

                  {/* Actions */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await togglePublishAction(p.id);
                      }}
                    >
                      <button
                        type="submit"
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                          p.is_published
                            ? "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                            : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                        }`}
                      >
                        {p.is_published ? "숨기기" : "게시"}
                      </button>
                    </form>
                    <Link
                      href={`/partner/programs/new?edit=${p.id}`}
                      className="rounded-lg border border-[#E5D3B8] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B4423] hover:bg-[#FFF8F0]"
                    >
                      편집
                    </Link>
                    <form
                      action={async () => {
                        "use server";
                        await deleteProgramAction(p.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        삭제
                      </button>
                    </form>
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
