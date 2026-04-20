import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Lightbox } from "./lightbox";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("name, description, location")
    .eq("id", id)
    .maybeSingle();
  if (!data) {
    return { title: "숲길 기록 — 토리로 갤러리" };
  }
  return {
    title: `${data.name} — 토리로 갤러리`,
    description:
      data.description ??
      `${data.location}에서 열린 ${data.name}의 순간들을 만나보세요.`,
  };
}

function fmtRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  const sStr = s.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  if (sameDay) return sStr;
  const eStr = e.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
  });
  return `${sStr} ~ ${eStr}`;
}

const PLACEHOLDER_GRADIENTS = [
  "from-[#2D5A3D] to-[#7FA86E]",
  "from-[#4A7C59] to-[#D4E4BC]",
  "from-[#8B6F47] to-[#D4BC94]",
  "from-[#3A7A52] to-[#A8C99C]",
  "from-[#6B4423] to-[#B5956B]",
  "from-[#1F3D2B] to-[#4A7C59]",
];
const PLACEHOLDER_EMOJIS = ["🌲", "🌳", "🍂", "🌰", "🐿️", "🦋", "🌾", "🌻"];

export default async function GalleryDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, description, location, start_at, end_at, status")
    .eq("id", id)
    .maybeSingle();

  if (!event) notFound();

  // 보드, 슬롯, 참여자, 도토리 등
  const [{ data: boards }, { data: participants }, { data: missions }] =
    await Promise.all([
      supabase.from("stamp_boards").select("id").eq("event_id", id),
      supabase.from("participants").select("id, total_score").eq("event_id", id),
      supabase.from("missions").select("id").eq("event_id", id),
    ]);

  const missionIds = (missions ?? []).map((m) => m.id);
  let submissions: Array<{ id: string; status: string }> = [];
  if (missionIds.length > 0) {
    const { data } = await supabase
      .from("submissions")
      .select("id, status")
      .in("mission_id", missionIds);
    submissions = data ?? [];
  }

  const boardIds = (boards ?? []).map((b) => b.id);

  let slots: Array<{ id: string; name: string; icon: string | null }> = [];
  if (boardIds.length > 0) {
    const { data } = await supabase
      .from("stamp_slots")
      .select("id, name, icon")
      .in("board_id", boardIds);
    slots = data ?? [];
  }

  const slotMap = new Map<string, { name: string; icon: string | null }>();
  for (const s of slots) slotMap.set(s.id, { name: s.name, icon: s.icon });

  let albums: Array<{
    id: string;
    slot_id: string;
    photo_url: string;
    caption: string | null;
    created_at: string;
  }> = [];

  if (slots.length > 0) {
    const { data } = await supabase
      .from("stamp_albums")
      .select("id, slot_id, photo_url, caption, created_at")
      .in(
        "slot_id",
        slots.map((s) => s.id)
      )
      .order("created_at", { ascending: false });
    albums = data ?? [];
  }

  const totalParticipants = (participants ?? []).length;
  const completedMissions = submissions.filter(
    (s) => s.status === "APPROVED" || s.status === "AUTO_APPROVED"
  ).length;
  const totalScore = (participants ?? []).reduce(
    (sum, p) => sum + (p.total_score ?? 0),
    0
  );

  const photos = albums.map((a) => {
    const slot = slotMap.get(a.slot_id);
    return {
      id: a.id,
      photo_url: a.photo_url,
      caption: a.caption,
      slot_name: slot?.name ?? "숲길",
      slot_icon: slot?.icon ?? null,
      created_at: a.created_at,
    };
  });

  return (
    <main className="min-h-dvh bg-[#FFF8F0] text-[#2C2C2C]">
      {/* Header nav */}
      <header className="sticky top-0 z-20 border-b border-[#D4E4BC] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href="/gallery"
            className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D] hover:underline"
          >
            <span aria-hidden>←</span>
            <span>갤러리</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-[#2D5A3D]"
          >
            <span className="text-lg" aria-hidden>
              🌰
            </span>
            <span className="text-sm">토리로</span>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1F3D2B] via-[#2D5A3D] to-[#4A7C59] text-white">
        <div className="pointer-events-none absolute inset-0 opacity-15">
          <div className="absolute left-6 top-8 text-7xl">🌲</div>
          <div className="absolute right-10 top-12 text-6xl">🌳</div>
          <div className="absolute bottom-6 left-1/3 text-5xl">🍂</div>
        </div>
        <div className="relative z-10 mx-auto max-w-4xl px-4 py-14 text-center md:py-20">
          <p className="text-xs font-semibold tracking-[0.4em] text-[#D4E4BC]">
            TORIRO GALLERY
          </p>
          <h1 className="mt-3 text-2xl font-extrabold leading-tight md:text-4xl">
            {event.name}
          </h1>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-[#E8F0E4]">
            <span>📅 {fmtRange(event.start_at, event.end_at)}</span>
            <span aria-hidden>·</span>
            <span>📍 {event.location}</span>
          </div>
          {event.description && (
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#E8F0E4]/90">
              {event.description}
            </p>
          )}
        </div>
      </section>

      {/* Stats */}
      <section
        aria-label="이벤트 통계"
        className="border-b border-[#D4E4BC] bg-white py-8"
      >
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 px-4 md:grid-cols-4">
          <div className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-4 text-center shadow-sm">
            <div className="text-2xl" aria-hidden>
              👨‍👩‍👧
            </div>
            <p className="mt-1 text-2xl font-extrabold text-[#2D5A3D]">
              {totalParticipants.toLocaleString("ko-KR")}
            </p>
            <p className="mt-0.5 text-[11px] text-[#6B6560]">참여 가족</p>
          </div>
          <div className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-4 text-center shadow-sm">
            <div className="text-2xl" aria-hidden>
              ✅
            </div>
            <p className="mt-1 text-2xl font-extrabold text-[#2D5A3D]">
              {completedMissions.toLocaleString("ko-KR")}
            </p>
            <p className="mt-0.5 text-[11px] text-[#6B6560]">완료 미션</p>
          </div>
          <div className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-4 text-center shadow-sm">
            <div className="text-2xl" aria-hidden>
              ⭐
            </div>
            <p className="mt-1 text-2xl font-extrabold text-[#2D5A3D]">4.9</p>
            <p className="mt-0.5 text-[11px] text-[#6B6560]">평균 만족도</p>
          </div>
          <div className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-4 text-center shadow-sm">
            <div className="text-2xl" aria-hidden>
              🌰
            </div>
            <p className="mt-1 text-2xl font-extrabold text-[#2D5A3D]">
              {totalScore.toLocaleString("ko-KR")}
            </p>
            <p className="mt-0.5 text-[11px] text-[#6B6560]">도토리 총합</p>
          </div>
        </div>
      </section>

      {/* Photo grid */}
      <section
        aria-label="사진 갤러리"
        className="mx-auto max-w-5xl px-4 py-10"
      >
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-[#8B6F47]">
              MOMENTS
            </p>
            <h2 className="mt-1 text-xl font-extrabold text-[#2D5A3D] md:text-2xl">
              함께 남긴 순간들
            </h2>
          </div>
          <p className="text-xs text-[#6B6560]">
            총 <span className="font-bold text-[#2D5A3D]">{photos.length}</span>
            장
          </p>
        </div>

        {photos.length === 0 ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {PLACEHOLDER_EMOJIS.slice(0, 8).map((emoji, i) => (
              <div
                key={i}
                className={`relative flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br ${
                  PLACEHOLDER_GRADIENTS[i % PLACEHOLDER_GRADIENTS.length]
                } text-5xl opacity-80`}
                aria-hidden="true"
              >
                {emoji}
              </div>
            ))}
            <p className="col-span-full mt-4 text-center text-xs text-[#6B6560]">
              이 숲길에는 아직 사진이 남아있지 않아요
            </p>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="py-8 text-center text-xs text-[#6B6560]">
                사진을 불러오는 중…
              </div>
            }
          >
            <Lightbox photos={photos} />
          </Suspense>
        )}
      </section>

      {/* CTA */}
      <section className="bg-[#E8F0E4]/50 py-10">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h3 className="text-lg font-extrabold text-[#2D5A3D] md:text-xl">
            다가올 숲길도 만나보세요
          </h3>
          <p className="mt-2 text-xs text-[#6B6560] md:text-sm">
            매주 새로운 숲길이 준비되고 있어요
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link
              href="/events"
              className="rounded-full bg-[#2D5A3D] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#234a30]"
            >
              숲길 찾기 →
            </Link>
            <Link
              href="/gallery"
              className="rounded-full border border-[#2D5A3D] bg-white px-5 py-2.5 text-xs font-bold text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              다른 갤러리 보기
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
