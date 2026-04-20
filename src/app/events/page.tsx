import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type {
  EventStatus,
  EventType,
  ParticipationType,
} from "@/lib/supabase/database.types";

export const metadata: Metadata = {
  title: "숲길 찾기",
  description: "전국의 토리로 숲길 모음",
};

export const dynamic = "force-dynamic";

type EventRow = {
  id: string;
  name: string;
  description: string | null;
  type: EventType;
  start_at: string;
  end_at: string;
  location: string;
  join_code: string;
  status: EventStatus;
  participation_type: ParticipationType;
  max_team_count: number | null;
  max_team_size: number;
};

type FilterKey = "today" | "weekend" | "next_week" | "all";
type SortKey = "latest" | "popular" | "soon";

const FILTER_LABELS: Record<FilterKey, string> = {
  today: "오늘",
  weekend: "이번 주말",
  next_week: "다음 주",
  all: "전체",
};

const SORT_LABELS: Record<SortKey, string> = {
  latest: "최신순",
  popular: "인기순",
  soon: "임박순",
};

const PARTICIPATION_LABEL: Record<ParticipationType, string> = {
  INDIVIDUAL: "개인",
  TEAM: "팀",
  BOTH: "개인 · 팀",
};

const TYPE_LABEL: Record<EventType, string> = {
  FAMILY: "가족",
  CORPORATE: "기업",
  CLUB: "동호회",
  SCHOOL: "학교",
  ETC: "기타",
};

// "기관 행사" 판정: 기업/학교 타입이면 B2B, 아니면 B2C
function isB2C(type: EventType): boolean {
  return type === "FAMILY" || type === "CLUB" || type === "ETC";
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function filterByDate(events: EventRow[], filter: FilterKey): EventRow[] {
  if (filter === "all") return events;
  const now = new Date();

  if (filter === "today") {
    const from = startOfDay(now).getTime();
    const to = endOfDay(now).getTime();
    return events.filter((e) => {
      const t = new Date(e.start_at).getTime();
      return t >= from && t <= to;
    });
  }

  if (filter === "weekend") {
    // 이번 주 토·일
    const day = now.getDay(); // 0=일, 6=토
    const sat = new Date(now);
    sat.setDate(now.getDate() + ((6 - day + 7) % 7));
    const sun = new Date(sat);
    sun.setDate(sat.getDate() + 1);
    const from = startOfDay(sat).getTime();
    const to = endOfDay(sun).getTime();
    return events.filter((e) => {
      const t = new Date(e.start_at).getTime();
      return t >= from && t <= to;
    });
  }

  if (filter === "next_week") {
    // 다음 주 월~일
    const day = now.getDay();
    const nextMon = new Date(now);
    nextMon.setDate(now.getDate() + ((8 - day) % 7 || 7));
    const nextSun = new Date(nextMon);
    nextSun.setDate(nextMon.getDate() + 6);
    const from = startOfDay(nextMon).getTime();
    const to = endOfDay(nextSun).getTime();
    return events.filter((e) => {
      const t = new Date(e.start_at).getTime();
      return t >= from && t <= to;
    });
  }

  return events;
}

function sortEvents(events: EventRow[], sort: SortKey): EventRow[] {
  const arr = [...events];
  if (sort === "latest") {
    return arr.sort(
      (a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
    );
  }
  if (sort === "soon") {
    const now = Date.now();
    return arr
      .filter((e) => new Date(e.start_at).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
      );
  }
  // popular: fallback에는 start_at 오름차순 (참가자 수 집계 전이므로)
  return arr.sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );
}

function formatKoreanDate(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(e: EventRow, participantCount: number): {
  label: string;
  className: string;
} {
  const now = Date.now();
  const start = new Date(e.start_at).getTime();
  const end = new Date(e.end_at).getTime();
  const max = e.max_team_count ? e.max_team_count * e.max_team_size : null;

  if (now > end || e.status === "ENDED" || e.status === "ARCHIVED") {
    return {
      label: "마감",
      className: "border-zinc-300 bg-zinc-100 text-zinc-600",
    };
  }
  if (max && participantCount >= max) {
    return {
      label: "마감",
      className: "border-zinc-300 bg-zinc-100 text-zinc-600",
    };
  }
  if (max && participantCount >= max * 0.8) {
    return {
      label: "마감 임박",
      className: "border-amber-300 bg-amber-50 text-amber-800",
    };
  }
  if (start - now < 1000 * 60 * 60 * 24 * 3 && start > now) {
    return {
      label: "모집 중",
      className: "border-emerald-300 bg-emerald-50 text-emerald-800",
    };
  }
  return {
    label: "모집 중",
    className: "border-emerald-300 bg-emerald-50 text-emerald-800",
  };
}

async function loadEvents(): Promise<{
  events: EventRow[];
  participantCounts: Record<string, number>;
}> {
  const supabase = await createClient();

  const { data: events, error } = await supabase
    .from("events")
    .select(
      "id,name,description,type,start_at,end_at,location,join_code,status,participation_type,max_team_count,max_team_size"
    )
    .in("status", ["ACTIVE", "DRAFT"])
    .order("start_at", { ascending: true })
    .limit(48);

  if (error || !events) {
    console.error("[events] load error", error);
    return { events: [], participantCounts: {} };
  }

  const ids = events.map((e) => e.id);
  const counts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: parts } = await supabase
      .from("participants")
      .select("event_id")
      .in("event_id", ids);
    for (const p of parts ?? []) {
      counts[p.event_id] = (counts[p.event_id] ?? 0) + 1;
    }
  }

  return { events: events as EventRow[], participantCounts: counts };
}

type SearchParams = Promise<{
  q?: string;
  region?: string;
  filter?: FilterKey;
  sort?: SortKey;
  participation?: ParticipationType | "ALL";
}>;

export default async function EventsDiscoveryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const region = (sp.region ?? "").trim();
  const filter: FilterKey = (sp.filter as FilterKey) ?? "all";
  const sort: SortKey = (sp.sort as SortKey) ?? "latest";
  const participation = sp.participation ?? "ALL";

  const { events: all, participantCounts } = await loadEvents();

  // 검색/필터
  let filtered = all;
  if (q) {
    const needle = q.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.name.toLowerCase().includes(needle) ||
        (e.description ?? "").toLowerCase().includes(needle) ||
        e.location.toLowerCase().includes(needle)
    );
  }
  if (region) {
    filtered = filtered.filter((e) =>
      e.location.toLowerCase().includes(region.toLowerCase())
    );
  }
  if (participation && participation !== "ALL") {
    filtered = filtered.filter(
      (e) =>
        e.participation_type === participation ||
        e.participation_type === "BOTH"
    );
  }
  filtered = filterByDate(filtered, filter);
  filtered = sortEvents(filtered, sort);

  // 빌드 query helper — 링크에 기존 params 유지
  function hrefWith(updates: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    const current: Record<string, string> = {
      q,
      region,
      filter,
      sort,
      participation: String(participation),
    };
    for (const [k, v] of Object.entries({ ...current, ...updates })) {
      if (v && v !== "ALL" && v !== "all" && v !== "latest") {
        params.set(k, v);
      }
    }
    const qs = params.toString();
    return qs ? `/events?${qs}` : "/events";
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
            href="/join"
            className="rounded-full border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            입장 코드로 참여 →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1F3D2B] via-[#2D5A3D] to-[#4A7C59] text-white">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute left-6 top-8 text-6xl">🌲</div>
          <div className="absolute right-10 top-16 text-5xl">🌳</div>
          <div className="absolute bottom-6 left-1/3 text-5xl">🍂</div>
        </div>
        <div className="relative z-10 mx-auto max-w-6xl px-4 py-12 md:py-16">
          <p className="text-xs font-semibold tracking-[0.4em] text-[#D4E4BC]">
            TORIRO EVENTS
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight md:text-4xl">
            🌲 토리로 숲길 찾기
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#E8F0E4] md:text-base">
            가족과 함께할 오늘의 숲길을 찾아보세요
          </p>

          {/* Search form */}
          <form
            action="/events"
            method="get"
            className="mt-6 grid grid-cols-1 gap-2 rounded-2xl bg-white/10 p-3 backdrop-blur md:grid-cols-[1fr_180px_160px_auto]"
          >
            {/* 기존 params 유지 */}
            <input type="hidden" name="filter" value={filter} />
            <input type="hidden" name="sort" value={sort} />

            <label className="sr-only" htmlFor="search-q">
              검색어
            </label>
            <input
              id="search-q"
              type="text"
              name="q"
              defaultValue={q}
              placeholder="🔍 행사명, 설명으로 찾기"
              autoComplete="off"
              className="w-full rounded-xl border border-white/20 bg-white/90 px-4 py-3 text-sm text-[#2C2C2C] outline-none focus:ring-2 focus:ring-[#D4E4BC]"
            />
            <label className="sr-only" htmlFor="search-region">
              지역
            </label>
            <input
              id="search-region"
              type="text"
              name="region"
              defaultValue={region}
              placeholder="📍 지역"
              autoComplete="off"
              className="w-full rounded-xl border border-white/20 bg-white/90 px-4 py-3 text-sm text-[#2C2C2C] outline-none focus:ring-2 focus:ring-[#D4E4BC]"
            />
            <label className="sr-only" htmlFor="search-participation">
              참여 방식
            </label>
            <select
              id="search-participation"
              name="participation"
              defaultValue={String(participation)}
              className="w-full rounded-xl border border-white/20 bg-white/90 px-4 py-3 text-sm text-[#2C2C2C] outline-none focus:ring-2 focus:ring-[#D4E4BC]"
            >
              <option value="ALL">참여 방식 전체</option>
              <option value="INDIVIDUAL">개인</option>
              <option value="TEAM">팀</option>
              <option value="BOTH">개인 · 팀</option>
            </select>
            <button
              type="submit"
              className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#2D5A3D] shadow-md transition-all hover:translate-y-[-1px] hover:shadow-lg"
            >
              검색
            </button>
          </form>
        </div>
      </section>

      {/* Filters + Sort */}
      <section className="sticky top-[48px] z-10 border-b border-[#D4E4BC] bg-[#FFF8F0]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <nav aria-label="기간 필터" className="flex flex-wrap gap-2">
            {(Object.keys(FILTER_LABELS) as FilterKey[]).map((k) => {
              const active = filter === k;
              return (
                <Link
                  key={k}
                  href={hrefWith({ filter: k })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                      : "border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#E8F0E4]"
                  }`}
                >
                  {FILTER_LABELS[k]}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 text-xs text-[#6B6560]">
            <span className="font-semibold">정렬:</span>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => {
              const active = sort === k;
              return (
                <Link
                  key={k}
                  href={hrefWith({ sort: k })}
                  className={`rounded-md px-2 py-1 font-semibold transition ${
                    active
                      ? "bg-[#E8F0E4] text-[#2D5A3D]"
                      : "text-[#6B6560] hover:text-[#2D5A3D]"
                  }`}
                >
                  {SORT_LABELS[k]}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-bold text-[#2D5A3D]">
            열린 숲길 {filtered.length.toLocaleString("ko-KR")}개
          </h2>
          {(q || region || filter !== "all" || participation !== "ALL") && (
            <Link
              href="/events"
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
              아직 열린 숲길이 없어요
            </p>
            <p className="mt-1 text-sm text-[#6B6560]">
              토리로에 행사를 열어보세요!
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link
                href="/enterprise"
                className="rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-bold text-white hover:bg-[#234a30]"
              >
                기업 프로그램 문의
              </Link>
              <Link
                href="/partner"
                className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-xs font-bold text-[#2D5A3D] hover:bg-[#E8F0E4]"
              >
                숲지기 되기
              </Link>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => {
              const participantCount = participantCounts[e.id] ?? 0;
              const badge = statusBadge(e, participantCount);
              const max = e.max_team_count
                ? e.max_team_count * e.max_team_size
                : null;
              const b2c = isB2C(e.type);
              return (
                <li key={e.id}>
                  <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    {/* Thumbnail */}
                    <Link
                      href={`/events/${e.id}`}
                      className="relative flex h-40 w-full items-center justify-center bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#A8C686] text-white"
                      aria-label={`${e.name} 상세 보기`}
                    >
                      <span className="pointer-events-none absolute left-4 top-4 text-4xl opacity-80" aria-hidden>
                        🌲
                      </span>
                      <span className="pointer-events-none absolute right-6 top-10 text-3xl opacity-60" aria-hidden>
                        🍂
                      </span>
                      <span className="pointer-events-none absolute bottom-3 right-4 text-4xl opacity-80" aria-hidden>
                        🌰
                      </span>
                      <span
                        className={`absolute left-3 top-3 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      {!b2c && (
                        <span className="absolute right-3 top-3 rounded-full border border-white/30 bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                          기관 행사
                        </span>
                      )}
                    </Link>

                    {/* Body */}
                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full border border-[#D4E4BC] bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                          {TYPE_LABEL[e.type]}
                        </span>
                        <span className="rounded-full border border-[#E5D3B8] bg-[#FFF8F0] px-2 py-0.5 text-[10px] font-medium text-[#8B6F47]">
                          👨‍👩‍👧 {PARTICIPATION_LABEL[e.participation_type]}
                        </span>
                      </div>

                      <h3 className="mt-2 line-clamp-2 text-base font-bold text-[#2D5A3D]">
                        <Link
                          href={`/events/${e.id}`}
                          className="hover:underline"
                        >
                          {e.name}
                        </Link>
                      </h3>

                      <p className="mt-1 flex items-center gap-1 text-xs text-[#6B6560]">
                        <span aria-hidden>📍</span>
                        <span className="line-clamp-1">{e.location}</span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-[#6B6560]">
                        <span aria-hidden>⏰</span>
                        <span>{formatKoreanDate(e.start_at)}</span>
                      </p>

                      {e.description && (
                        <p className="mt-2 line-clamp-2 text-xs text-[#6B6560]">
                          {e.description}
                        </p>
                      )}

                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#2D5A3D]">
                          참여 {participantCount.toLocaleString("ko-KR")}
                          {max ? ` / ${max.toLocaleString("ko-KR")}` : ""}명
                        </span>
                        {b2c ? (
                          <span className="font-bold text-[#B8860B]">무료</span>
                        ) : (
                          <span className="rounded-full border border-[#E5D3B8] bg-[#FFF8F0] px-2 py-0.5 text-[10px] font-semibold text-[#8B6F47]">
                            기관 행사
                          </span>
                        )}
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        <Link
                          href={`/events/${e.id}`}
                          className="flex-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-center text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
                        >
                          자세히
                        </Link>
                        <Link
                          href={`/join/${e.join_code}`}
                          className="flex-1 rounded-xl bg-[#2D5A3D] px-3 py-2 text-center text-xs font-bold text-white hover:bg-[#234a30]"
                        >
                          참여하기
                        </Link>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-[#D4E4BC] bg-white py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-[#8B6F47]">
          <p className="flex items-center justify-center gap-1 font-bold text-[#2D5A3D]">
            <span aria-hidden>🌰</span>
            <span>토리로</span>
          </p>
          <p className="mt-2">가족과 함께하는 숲길 · 기업 ESG 팀빌딩 · 숲지기 체험</p>
        </div>
      </footer>
    </div>
  );
}
