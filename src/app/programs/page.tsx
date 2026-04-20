import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "숲지기 프로그램 · 토리로",
  description:
    "전국의 토리로 숲지기들이 운영하는 체험 프로그램을 카테고리별로 찾아보세요.",
};

export const dynamic = "force-dynamic";

type ProgramCategory = "FOREST" | "CAMPING" | "KIDS" | "FAMILY" | "TEAM" | "ART";
type SortKey = "popular" | "price_asc" | "price_desc" | "latest";

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
  image_url: string | null;
  tags: string[] | null;
  rating_avg: number | null;
  rating_count: number;
  booking_count: number;
  created_at: string;
};

const CATEGORY_META: Record<
  ProgramCategory,
  { label: string; icon: string; chip: string }
> = {
  FOREST: {
    label: "숲 체험",
    icon: "🌲",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  CAMPING: {
    label: "캠핑",
    icon: "⛺",
    chip: "border-amber-200 bg-amber-50 text-amber-800",
  },
  KIDS: {
    label: "유아·키즈",
    icon: "👶",
    chip: "border-rose-200 bg-rose-50 text-rose-700",
  },
  FAMILY: {
    label: "가족",
    icon: "👨‍👩‍👧",
    chip: "border-sky-200 bg-sky-50 text-sky-700",
  },
  TEAM: {
    label: "기업 팀빌딩",
    icon: "🏢",
    chip: "border-violet-200 bg-violet-50 text-violet-700",
  },
  ART: {
    label: "아트·공예",
    icon: "🎨",
    chip: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  },
};

const SORT_LABELS: Record<SortKey, string> = {
  popular: "인기순",
  price_asc: "가격 낮은순",
  price_desc: "가격 높은순",
  latest: "최신순",
};

function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

function renderStars(avg: number | null, count: number): string {
  if (!avg || count === 0) return "리뷰 없음";
  const rounded = Math.round(avg);
  return `${"★".repeat(Math.max(0, Math.min(5, rounded)))}${"☆".repeat(
    Math.max(0, 5 - Math.min(5, rounded))
  )} ${avg.toFixed(1)} (${count})`;
}

async function loadPrograms(): Promise<Program[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_programs")
    .select(
      "id,partner_id,title,description,category,duration_hours,capacity_min,capacity_max,price_per_person,b2b_price_per_person,location_region,image_url,tags,rating_avg,rating_count,booking_count,created_at"
    )
    .eq("is_published", true)
    .order("booking_count", { ascending: false })
    .limit(60);
  if (error) {
    console.error("[programs] load error", error);
    return [];
  }
  return (data ?? []) as Program[];
}

type SearchParams = Promise<{
  category?: ProgramCategory | "ALL";
  sort?: SortKey;
}>;

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const category = sp.category ?? "ALL";
  const sort: SortKey = (sp.sort as SortKey) ?? "popular";

  const all = await loadPrograms();

  let filtered = all;
  if (category !== "ALL") {
    filtered = filtered.filter((p) => p.category === category);
  }
  if (sort === "price_asc") {
    filtered = [...filtered].sort(
      (a, b) => a.price_per_person - b.price_per_person
    );
  } else if (sort === "price_desc") {
    filtered = [...filtered].sort(
      (a, b) => b.price_per_person - a.price_per_person
    );
  } else if (sort === "latest") {
    filtered = [...filtered].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } else {
    filtered = [...filtered].sort(
      (a, b) => b.booking_count - a.booking_count
    );
  }

  function hrefWith(updates: {
    category?: ProgramCategory | "ALL";
    sort?: SortKey;
  }): string {
    const params = new URLSearchParams();
    const nextCat = updates.category ?? category;
    const nextSort = updates.sort ?? sort;
    if (nextCat !== "ALL") params.set("category", nextCat);
    if (nextSort !== "popular") params.set("sort", nextSort);
    const qs = params.toString();
    return qs ? `/programs?${qs}` : "/programs";
  }

  return (
    <div className="min-h-dvh bg-[#FFF8F0] text-[#2C2C2C]">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-[#D4E4BC] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-bold text-[#2D5A3D]">
            <span className="text-xl" aria-hidden>
              🌰
            </span>
            <span>토리로</span>
          </Link>
          <Link
            href="/events"
            className="rounded-full border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            숲길 찾기 →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1F3D2B] via-[#2D5A3D] to-[#4A7C59] text-white">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute left-6 top-8 text-6xl">🌲</div>
          <div className="absolute right-10 top-16 text-5xl">⛺</div>
          <div className="absolute bottom-6 left-1/3 text-5xl">🎨</div>
        </div>
        <div className="relative z-10 mx-auto max-w-6xl px-4 py-12 md:py-16">
          <p className="text-xs font-semibold tracking-[0.4em] text-[#D4E4BC]">
            PARTNER PROGRAMS
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight md:text-4xl">
            🏡 토리로 숲지기 프로그램
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#E8F0E4] md:text-base">
            전국의 숲지기들이 직접 운영하는 체험 프로그램을 만나보세요
          </p>
        </div>
      </section>

      {/* Category filters */}
      <section className="sticky top-[48px] z-10 border-b border-[#D4E4BC] bg-[#FFF8F0]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <nav
            aria-label="카테고리"
            className="flex flex-wrap gap-2"
          >
            <Link
              href={hrefWith({ category: "ALL" })}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                category === "ALL"
                  ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                  : "border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#E8F0E4]"
              }`}
            >
              전체
            </Link>
            {(Object.keys(CATEGORY_META) as ProgramCategory[]).map((c) => {
              const meta = CATEGORY_META[c];
              const active = category === c;
              return (
                <Link
                  key={c}
                  href={hrefWith({ category: c })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                      : "border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#E8F0E4]"
                  }`}
                >
                  <span className="mr-1" aria-hidden>
                    {meta.icon}
                  </span>
                  {meta.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1 text-xs text-[#6B6560]">
            <span className="font-semibold">정렬:</span>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((s) => {
              const active = sort === s;
              return (
                <Link
                  key={s}
                  href={hrefWith({ sort: s })}
                  className={`rounded-md px-2 py-1 font-semibold ${
                    active
                      ? "bg-[#E8F0E4] text-[#2D5A3D]"
                      : "text-[#6B6560] hover:text-[#2D5A3D]"
                  }`}
                >
                  {SORT_LABELS[s]}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Results */}
      <main className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-bold text-[#2D5A3D]">
            프로그램 {filtered.length.toLocaleString("ko-KR")}개
          </h2>
          {(category !== "ALL" || sort !== "popular") && (
            <Link
              href="/programs"
              className="text-xs text-[#8B6F47] underline-offset-2 hover:underline"
            >
              필터 초기화
            </Link>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center md:p-16">
            <div className="text-5xl" aria-hidden>
              🌱
            </div>
            <p className="mt-3 text-base font-semibold text-[#2D5A3D]">
              아직 등록된 프로그램이 없어요
            </p>
            <p className="mt-1 text-sm text-[#6B6560]">
              토리로 숲지기가 되어 첫 프로그램을 등록해보세요
            </p>
            <Link
              href="/partner"
              className="mt-5 inline-flex rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-bold text-white hover:bg-[#234a30]"
            >
              숲지기 되기 →
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const meta = CATEGORY_META[p.category] ?? CATEGORY_META.FOREST;
              return (
                <li key={p.id}>
                  <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
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
                      <span
                        className={`absolute left-3 top-3 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.chip}`}
                      >
                        <span className="mr-1" aria-hidden>
                          {meta.icon}
                        </span>
                        {meta.label}
                      </span>
                    </div>

                    {/* Body */}
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="line-clamp-2 text-base font-bold text-[#2D5A3D]">
                        {p.title}
                      </h3>
                      {p.location_region && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-[#6B6560]">
                          <span aria-hidden>📍</span>
                          <span>{p.location_region}</span>
                        </p>
                      )}
                      {p.duration_hours && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-[#6B6560]">
                          <span aria-hidden>⏱️</span>
                          <span>{p.duration_hours}시간</span>
                        </p>
                      )}
                      {p.description && (
                        <p className="mt-2 line-clamp-2 text-xs text-[#6B6560]">
                          {p.description}
                        </p>
                      )}

                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-lg font-extrabold text-[#2D5A3D]">
                          {formatWon(p.price_per_person)}
                        </span>
                        <span className="text-[11px] text-[#6B6560]">/ 1인</span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-[#6B6560]">
                        <span className="text-amber-600">
                          {renderStars(p.rating_avg, p.rating_count)}
                        </span>
                        <span>예약 {p.booking_count.toLocaleString("ko-KR")}건</span>
                      </div>

                      <div className="mt-auto pt-4">
                        <a
                          href={`mailto:hello@toriro.kr?subject=${encodeURIComponent(
                            `[프로그램 문의] ${p.title}`
                          )}`}
                          className="block rounded-xl bg-[#2D5A3D] px-3 py-2 text-center text-xs font-bold text-white hover:bg-[#234a30]"
                        >
                          문의하기 →
                        </a>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#D4E4BC] bg-white py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-[#8B6F47]">
          <p className="flex items-center justify-center gap-1 font-bold text-[#2D5A3D]">
            <span aria-hidden>🌰</span>
            <span>토리로</span>
          </p>
          <p className="mt-2">
            프로그램 제휴 문의: partner@toriro.kr · 기업 단체 문의: enterprise@toriro.kr
          </p>
        </div>
      </footer>
    </div>
  );
}
