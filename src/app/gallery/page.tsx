import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { GalleryFilters } from "./gallery-filters";

export const metadata: Metadata = {
  title: "숲에서의 순간들 — 토리로 갤러리",
  description:
    "토리로 가족들이 남긴 숲의 추억. 과거 숲길에서 함께한 순간들을 만나보세요.",
};

export const dynamic = "force-dynamic";

type EventRow = {
  id: string;
  name: string;
  description: string | null;
  location: string;
  start_at: string;
  end_at: string;
  status: string;
};

const GRADIENTS = [
  "from-[#2D5A3D] via-[#4A7C59] to-[#7FA86E]",
  "from-[#4A7C59] via-[#7FA86E] to-[#D4E4BC]",
  "from-[#8B6F47] via-[#B5956B] to-[#D4BC94]",
  "from-[#3A7A52] via-[#6FA87F] to-[#A8C99C]",
  "from-[#1F3D2B] via-[#4A7C59] to-[#A8C99C]",
  "from-[#6B4423] via-[#8B6F47] to-[#D4BC94]",
];

const EMOJIS = ["🌲", "🌳", "🍂", "🌰", "🐿️", "🦋", "🌾", "🌻"];

function pickGradient(seed: string, idx: number) {
  let hash = idx;
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

function pickEmoji(seed: string, idx: number) {
  let hash = idx * 7;
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i)) >>> 0;
  return EMOJIS[hash % EMOJIS.length];
}

function extractRegion(location: string): string {
  // "서울특별시 성동구 ..." → "서울"
  const parts = location.trim().split(/\s+/);
  if (!parts[0]) return "기타";
  const first = parts[0]
    .replace(/특별시|광역시|특별자치시|특별자치도/g, "")
    .replace(/도$/, "");
  const map: Record<string, string> = {
    서울: "서울",
    부산: "부산",
    대구: "대구",
    인천: "인천",
    광주: "광주",
    대전: "대전",
    울산: "울산",
    세종: "세종",
    경기: "경기",
    강원: "강원",
    충북: "충북",
    충남: "충남",
    전북: "전북",
    전남: "전남",
    경북: "경북",
    경남: "경남",
    제주: "제주",
  };
  const matched = Object.keys(map).find((k) => first.startsWith(k));
  return matched ?? "기타";
}

function seasonOf(iso: string): "봄" | "여름" | "가을" | "겨울" {
  const m = new Date(iso).getMonth() + 1;
  if (m >= 3 && m <= 5) return "봄";
  if (m >= 6 && m <= 8) return "여름";
  if (m >= 9 && m <= 11) return "가을";
  return "겨울";
}

async function loadGallery() {
  const supabase = await createClient();

  // 지난 이벤트 (ENDED, CONFIRMED, ARCHIVED)
  const { data: events } = await supabase
    .from("events")
    .select("id, name, description, location, start_at, end_at, status")
    .in("status", ["ENDED", "CONFIRMED", "ARCHIVED"])
    .order("end_at", { ascending: false })
    .limit(20);

  const list: EventRow[] = events ?? [];

  // 각 이벤트의 커버 사진 & 사진/참여자 수 집계
  const byId: Record<
    string,
    { cover: string | null; photoCount: number; participantCount: number }
  > = {};

  if (list.length > 0) {
    const ids = list.map((e) => e.id);

    const [{ data: boards }, { data: participants }] = await Promise.all([
      supabase
        .from("stamp_boards")
        .select("id, event_id")
        .in("event_id", ids),
      supabase
        .from("participants")
        .select("id, event_id")
        .in("event_id", ids),
    ]);

    const boardsByEvent = new Map<string, string[]>();
    for (const b of boards ?? []) {
      const arr = boardsByEvent.get(b.event_id) ?? [];
      arr.push(b.id);
      boardsByEvent.set(b.event_id, arr);
    }

    const participantCountByEvent = new Map<string, number>();
    for (const p of participants ?? []) {
      participantCountByEvent.set(
        p.event_id,
        (participantCountByEvent.get(p.event_id) ?? 0) + 1
      );
    }

    // 모든 슬롯을 한 번에 가져와서 event_id로 역매핑
    const allBoardIds = (boards ?? []).map((b) => b.id);
    const slotToEvent = new Map<string, string>();
    if (allBoardIds.length > 0) {
      const { data: slots } = await supabase
        .from("stamp_slots")
        .select("id, board_id")
        .in("board_id", allBoardIds);
      const boardToEvent = new Map<string, string>();
      for (const b of boards ?? []) boardToEvent.set(b.id, b.event_id);
      for (const s of slots ?? []) {
        const ev = boardToEvent.get(s.board_id);
        if (ev) slotToEvent.set(s.id, ev);
      }
    }

    const allSlotIds = Array.from(slotToEvent.keys());
    if (allSlotIds.length > 0) {
      const { data: albums } = await supabase
        .from("stamp_albums")
        .select("id, slot_id, photo_url, created_at")
        .in("slot_id", allSlotIds)
        .order("created_at", { ascending: false });

      for (const a of albums ?? []) {
        const ev = slotToEvent.get(a.slot_id);
        if (!ev) continue;
        if (!byId[ev]) {
          byId[ev] = { cover: null, photoCount: 0, participantCount: 0 };
        }
        byId[ev].photoCount += 1;
        // 가장 최근(정렬 desc 상 첫 번째)을 cover로
        if (!byId[ev].cover) byId[ev].cover = a.photo_url;
      }
    }

    // 참여자 수 주입
    for (const ev of ids) {
      if (!byId[ev]) {
        byId[ev] = { cover: null, photoCount: 0, participantCount: 0 };
      }
      byId[ev].participantCount = participantCountByEvent.get(ev) ?? 0;
    }
  }

  return list.map((e) => ({
    ...e,
    cover: byId[e.id]?.cover ?? null,
    photoCount: byId[e.id]?.photoCount ?? 0,
    participantCount: byId[e.id]?.participantCount ?? 0,
    region: extractRegion(e.location),
    season: seasonOf(e.start_at),
  }));
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export default async function GalleryPage() {
  const items = await loadGallery();

  const regions = Array.from(new Set(items.map((i) => i.region))).sort();
  const seasons = ["봄", "여름", "가을", "겨울"] as const;

  return (
    <main className="min-h-dvh bg-[#FFF8F0] text-[#2C2C2C]">
      {/* Header nav */}
      <header className="sticky top-0 z-20 border-b border-[#D4E4BC] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-[#2D5A3D]"
          >
            <span className="text-xl" aria-hidden>
              🌰
            </span>
            <span>토리로</span>
          </Link>
          <nav className="flex items-center gap-1 text-xs font-semibold">
            <Link
              href="/events"
              className="rounded-full px-3 py-1.5 text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              숲길 찾기
            </Link>
            <Link
              href="/gallery"
              className="rounded-full bg-[#E8F0E4] px-3 py-1.5 text-[#2D5A3D]"
            >
              갤러리
            </Link>
            <Link
              href="/partner"
              className="rounded-full bg-[#2D5A3D] px-3 py-1.5 text-white hover:bg-[#234a30]"
            >
              숲지기
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1F3D2B] via-[#2D5A3D] to-[#4A7C59] text-white">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute left-6 top-8 text-6xl">🌲</div>
          <div className="absolute right-10 top-16 text-5xl">📸</div>
          <div className="absolute bottom-8 left-1/4 text-5xl">🍂</div>
        </div>
        <div className="relative z-10 mx-auto max-w-4xl px-4 py-14 text-center md:py-20">
          <p className="text-xs font-semibold tracking-[0.4em] text-[#D4E4BC]">
            GALLERY
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight md:text-5xl">
            <span aria-hidden="true">🌲</span> 숲에서의 순간들
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[#E8F0E4] md:text-lg">
            토리로 가족들이 남긴 소중한 추억
          </p>
        </div>
      </section>

      {/* Filters */}
      <Suspense
        fallback={
          <div className="mx-auto max-w-5xl px-4 py-4 text-center text-xs text-[#6B6560]">
            불러오는 중…
          </div>
        }
      >
        <GalleryFilters regions={regions} seasons={Array.from(seasons)} />
      </Suspense>

      {/* Grid */}
      <section className="mx-auto max-w-5xl px-4 pb-16">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-[#D4E4BC] bg-white p-12 text-center">
            <div className="mb-3 text-5xl" aria-hidden="true">
              🌱
            </div>
            <h2 className="text-base font-bold text-[#2D5A3D]">
              아직 공개된 숲길 기록이 없어요
            </h2>
            <p className="mt-1 text-xs text-[#6B6560]">
              곧 더 많은 순간들이 이곳에 쌓일 거예요
            </p>
            <Link
              href="/events"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700"
            >
              다가올 숲길 보기 →
            </Link>
          </div>
        ) : (
          <ul
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-5"
            data-gallery-grid
          >
            {items.map((ev, idx) => {
              const gradient = pickGradient(ev.id, idx);
              const emoji = pickEmoji(ev.id, idx);
              return (
                <li
                  key={ev.id}
                  data-region={ev.region}
                  data-season={ev.season}
                  className="group overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <Link
                    href={`/gallery/${ev.id}`}
                    className="block focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <div
                      className={`relative aspect-[4/3] overflow-hidden bg-gradient-to-br ${gradient}`}
                    >
                      {ev.cover ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={ev.cover}
                            alt={`${ev.name} 커버 이미지`}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                        </>
                      ) : (
                        <div
                          className="absolute inset-0 flex items-center justify-center text-6xl opacity-70"
                          aria-hidden="true"
                        >
                          {emoji}
                        </div>
                      )}
                      <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#2D5A3D] shadow-sm">
                        {ev.season} · {ev.region}
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="line-clamp-2 text-sm font-extrabold text-[#2D5A3D] md:text-base">
                        {ev.name}
                      </h3>
                      <p className="mt-1 text-xs text-[#6B6560]">
                        📍 {ev.location}
                      </p>
                      <p className="mt-0.5 text-xs text-[#8B6F47]">
                        📅 {fmtDate(ev.start_at)}
                      </p>
                      <div className="mt-3 flex items-center justify-between border-t border-[#E8F0E4] pt-3">
                        <div className="text-[11px] text-[#6B6560]">
                          <span className="font-bold text-[#2D5A3D]">
                            {ev.photoCount}
                          </span>
                          장 · <span className="font-bold text-[#2D5A3D]">
                            {ev.participantCount}
                          </span>명 참여
                        </div>
                        <span className="text-xs font-bold text-violet-600 group-hover:translate-x-0.5">
                          자세히 →
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
