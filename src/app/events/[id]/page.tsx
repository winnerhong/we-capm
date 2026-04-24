import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  EventStatus,
  EventType,
  ParticipationType,
  RewardType,
  TemplateType,
} from "@/lib/supabase/database.types";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

type EventDetail = {
  id: string;
  name: string;
  description: string | null;
  type: EventType;
  start_at: string;
  end_at: string;
  location: string;
  location_lat: number | null;
  location_lng: number | null;
  join_code: string;
  status: EventStatus;
  participation_type: ParticipationType;
  max_team_size: number;
  max_team_count: number | null;
  manager_id: string | null;
  created_at: string;
};

type Mission = {
  id: string;
  title: string;
  description: string;
  points: number;
  template_type: TemplateType;
  order: number;
  is_active: boolean;
};

type Reward = {
  id: string;
  name: string;
  description: string | null;
  reward_type: RewardType;
  is_active: boolean;
};

type Review = {
  id: string;
  participant_name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
};

const TYPE_LABEL: Record<EventType, string> = {
  FAMILY: "가족",
  CORPORATE: "기업",
  CLUB: "동호회",
  SCHOOL: "학교",
  ETC: "기타",
};

const PARTICIPATION_LABEL: Record<ParticipationType, { emoji: string; label: string }> = {
  INDIVIDUAL: { emoji: "🙋", label: "개인 참여" },
  TEAM: { emoji: "👥", label: "팀 참여" },
  BOTH: { emoji: "👨‍👩‍👧", label: "개인 · 팀 모두 가능" },
};

const TEMPLATE_META: Record<TemplateType, { emoji: string; label: string }> = {
  PHOTO: { emoji: "📸", label: "사진" },
  VIDEO: { emoji: "🎬", label: "영상" },
  LOCATION: { emoji: "📍", label: "위치" },
  QUIZ: { emoji: "🧩", label: "퀴즈" },
  MIXED: { emoji: "✨", label: "복합" },
  TEAM: { emoji: "🤝", label: "팀 미션" },
  TIMEATTACK: { emoji: "⏱️", label: "타임어택" },
};

const REWARD_META: Record<RewardType, { emoji: string; label: string; chip: string }> = {
  POINT: {
    emoji: "🔵",
    label: "점수 누적",
    chip: "border-sky-200 bg-sky-50 text-sky-800",
  },
  RANK: {
    emoji: "🏅",
    label: "순위 보상",
    chip: "border-amber-200 bg-amber-50 text-amber-800",
  },
  BADGE: {
    emoji: "🎖",
    label: "뱃지",
    chip: "border-violet-200 bg-violet-50 text-violet-800",
  },
  LOTTERY: {
    emoji: "🎁",
    label: "추첨",
    chip: "border-orange-200 bg-orange-50 text-orange-800",
  },
  INSTANT: {
    emoji: "⚡",
    label: "즉시 보상",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
};

function formatKoreanFull(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatKoreanShort(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function durationHours(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const hours = Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
  if (hours >= 24) return `${Math.round(hours / 24)}일`;
  return `${hours}시간`;
}

async function loadEventDetail(id: string): Promise<{
  event: EventDetail | null;
  missions: Mission[];
  rewards: Reward[];
  reviews: Review[];
  managerName: string | null;
  participantCount: number;
}> {
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select(
      "id,name,description,type,start_at,end_at,location,location_lat,location_lng,join_code,status,participation_type,max_team_size,max_team_count,manager_id,created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!event) {
    return {
      event: null,
      missions: [],
      rewards: [],
      reviews: [],
      managerName: null,
      participantCount: 0,
    };
  }

  const [{ data: missions }, { data: rewards }, { data: reviews }, { data: parts }] =
    await Promise.all([
      supabase
        .from("missions")
        .select("id,title,description,points,template_type,order,is_active")
        .eq("event_id", id)
        .eq("is_active", true)
        .order("order", { ascending: true })
        .limit(3),
      supabase
        .from("rewards")
        .select("id,name,description,reward_type,is_active")
        .eq("event_id", id)
        .eq("is_active", true)
        .limit(5),
      supabase
        .from("event_reviews")
        .select("id,participant_name,rating,comment,created_at")
        .eq("event_id", id)
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase.from("participants").select("id").eq("event_id", id),
    ]);

  let managerName: string | null = null;
  if (event.manager_id) {
    const { data: manager } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", event.manager_id)
      .maybeSingle();
    managerName = manager?.name ?? null;
  }

  return {
    event: event as EventDetail,
    missions: (missions ?? []) as Mission[],
    rewards: (rewards ?? []) as Reward[],
    reviews: (reviews ?? []) as Review[],
    managerName,
    participantCount: (parts ?? []).length,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { event } = await loadEventDetail(id);
  if (!event) {
    return { title: "숲길을 찾을 수 없어요 · 토리로" };
  }
  return {
    title: `${event.name} · 토리로`,
    description:
      event.description ??
      `${event.location}에서 열리는 토리로 숲길 — ${formatKoreanShort(event.start_at)}`,
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await loadEventDetail(id);
  if (!detail.event) {
    notFound();
  }

  const { event, missions, rewards, reviews, managerName, participantCount } = detail;
  const maxCapacity = event.max_team_count
    ? event.max_team_count * event.max_team_size
    : null;
  const participation = PARTICIPATION_LABEL[event.participation_type];
  const now = Date.now();
  const isClosed =
    now > new Date(event.end_at).getTime() ||
    event.status === "ENDED" ||
    event.status === "ARCHIVED" ||
    (maxCapacity !== null && participantCount >= maxCapacity);

  return (
    <div className="min-h-dvh bg-[#FFF8F0] pb-28 text-[#2C2C2C]">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-[#D4E4BC] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link
            href="/events"
            className="flex items-center gap-1.5 text-sm font-semibold text-[#2D5A3D] hover:text-[#234a30]"
          >
            <span aria-hidden>←</span>
            <span>숲길 찾기</span>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
            <AcornIcon size={18} />
            <span>토리로</span>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1F3D2B] via-[#2D5A3D] to-[#4A7C59] text-white">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute left-6 top-8 text-7xl">🌲</div>
          <div className="absolute right-10 top-20 text-6xl">🌳</div>
          <div className="absolute bottom-6 left-1/3 text-6xl">🍂</div>
          <div className="absolute bottom-4 right-1/4 text-5xl"><AcornIcon size={40} /></div>
        </div>
        <div className="relative z-10 mx-auto max-w-4xl px-4 py-12 md:py-16">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold backdrop-blur">
              {TYPE_LABEL[event.type]}
            </span>
            <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold backdrop-blur">
              {participation.emoji} {participation.label}
            </span>
            {isClosed && (
              <span className="rounded-full bg-zinc-800/80 px-3 py-1 text-[11px] font-bold text-white">
                마감
              </span>
            )}
          </div>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight md:text-4xl">
            {event.name}
          </h1>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-[#E8F0E4] md:text-base">
            <span aria-hidden>⏰</span>
            <span>{formatKoreanFull(event.start_at)}</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-[#E8F0E4] md:text-base">
            <span aria-hidden>📍</span>
            <span>{event.location}</span>
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 md:py-10">
        {/* Quick facts */}
        <section
          aria-label="행사 정보"
          className="grid grid-cols-2 gap-3 md:grid-cols-4"
        >
          <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
            <p className="text-[11px] font-semibold text-[#6B6560]">기간</p>
            <p className="mt-1 text-base font-extrabold text-[#2D5A3D]">
              {durationHours(event.start_at, event.end_at)}
            </p>
          </div>
          <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
            <p className="text-[11px] font-semibold text-[#6B6560]">참여 방식</p>
            <p className="mt-1 text-base font-extrabold text-[#2D5A3D]">
              {participation.emoji} {participation.label}
            </p>
          </div>
          <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
            <p className="text-[11px] font-semibold text-[#6B6560]">참여 인원</p>
            <p className="mt-1 text-base font-extrabold text-[#2D5A3D]">
              {participantCount.toLocaleString("ko-KR")}명
              {maxCapacity ? (
                <span className="text-xs font-semibold text-[#8B6F47]">
                  {" "}
                  / {maxCapacity.toLocaleString("ko-KR")}
                </span>
              ) : null}
            </p>
          </div>
          <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
            <p className="text-[11px] font-semibold text-[#6B6560]">종료</p>
            <p className="mt-1 text-base font-extrabold text-[#2D5A3D]">
              {formatKoreanShort(event.end_at)}
            </p>
          </div>
        </section>

        {/* 위치 / 지도 placeholder */}
        <section
          aria-label="위치"
          className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm"
        >
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>📍</span>
            <span>위치</span>
          </h2>
          <p className="mt-2 text-sm text-[#2C2C2C]">{event.location}</p>
          <div className="mt-3 flex h-40 items-center justify-center rounded-xl bg-gradient-to-br from-[#E8F0E4] via-[#D4E4BC] to-[#A8C686] text-[#2D5A3D]">
            <div className="text-center">
              <div className="text-4xl" aria-hidden>
                🗺️
              </div>
              <p className="mt-2 text-xs font-semibold">
                {event.location_lat && event.location_lng
                  ? "지도 보기는 준비 중이에요"
                  : "위치 좌표가 등록되지 않았어요"}
              </p>
            </div>
          </div>
        </section>

        {/* 설명 */}
        {event.description && (
          <section
            aria-label="행사 설명"
            className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm"
          >
            <h2 className="text-sm font-bold text-[#2D5A3D]">행사 소개</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#2C2C2C]">
              {event.description}
            </p>
          </section>
        )}

        {/* 주최 기관 */}
        <section
          aria-label="주최 기관"
          className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm"
        >
          <h2 className="text-sm font-bold text-[#2D5A3D]">주최 기관</h2>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F0E4] text-2xl" aria-hidden>
              🏡
            </div>
            <div>
              <p className="text-sm font-bold text-[#2D5A3D]">
                {managerName ?? "토리로 직영"}
              </p>
              <p className="text-xs text-[#6B6560]">
                행사 등록일 {formatKoreanShort(event.created_at)}
              </p>
            </div>
          </div>
        </section>

        {/* 미션 미리보기 */}
        <section
          aria-label="미션 미리보기"
          className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#2D5A3D]">미션 미리보기</h2>
            <span className="text-[11px] text-[#8B6F47]">
              참여 후 전체 공개
            </span>
          </div>
          {missions.length === 0 ? (
            <p className="mt-3 rounded-xl bg-[#FFF8F0] p-4 text-center text-xs text-[#6B6560]">
              아직 공개된 미션이 없어요
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {missions.map((m, idx) => {
                const meta =
                  TEMPLATE_META[m.template_type] ?? TEMPLATE_META.PHOTO;
                return (
                  <li
                    key={m.id}
                    className="flex items-start gap-3 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3"
                  >
                    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white text-sm font-bold text-[#2D5A3D]">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-bold text-[#2D5A3D]">
                          {m.title}
                        </span>
                        <span className="rounded-full border border-[#D4E4BC] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                          {meta.emoji} {meta.label}
                        </span>
                        <span className="rounded-full border border-[#E5D3B8] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#B8860B]">
                          {m.points}점
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-[#6B6560]">
                        {m.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 보상 미리보기 */}
        <section
          aria-label="보상 미리보기"
          className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm"
        >
          <h2 className="text-sm font-bold text-[#2D5A3D]">어떤 보상이 있나요?</h2>
          {rewards.length === 0 ? (
            <p className="mt-3 rounded-xl bg-[#FFF8F0] p-4 text-center text-xs text-[#6B6560]">
              이 숲길엔 아직 공개된 보상이 없어요
            </p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {rewards.map((r) => {
                const meta = REWARD_META[r.reward_type];
                return (
                  <li
                    key={r.id}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${meta.chip}`}
                  >
                    <span className="mr-1" aria-hidden>
                      {meta.emoji}
                    </span>
                    {r.name}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 후기 미리보기 */}
        <section
          aria-label="후기"
          className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm"
        >
          <h2 className="text-sm font-bold text-[#2D5A3D]">숲길을 걸어본 사람들</h2>
          {reviews.length === 0 ? (
            <p className="mt-3 rounded-xl bg-[#FFF8F0] p-4 text-center text-xs text-[#6B6560]">
              아직 후기가 없어요 — 첫 후기의 주인공이 되어주세요!
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {reviews.map((rv) => (
                <li
                  key={rv.id}
                  className="rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2D5A3D]">
                      {rv.participant_name ?? "익명 참가자"}
                    </span>
                    <span className="text-[11px] text-amber-600">
                      {"★".repeat(Math.max(0, Math.min(5, Math.round(rv.rating))))}
                      {"☆".repeat(
                        Math.max(0, 5 - Math.min(5, Math.round(rv.rating)))
                      )}
                    </span>
                  </div>
                  {rv.comment && (
                    <p className="mt-1.5 line-clamp-3 text-xs text-[#6B6560]">
                      {rv.comment}
                    </p>
                  )}
                  <p className="mt-1.5 text-[10px] text-[#8B6F47]">
                    {formatKoreanShort(rv.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* Sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#D4E4BC] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="hidden md:block">
            <p className="text-xs text-[#6B6560]">참여 인원</p>
            <p className="text-sm font-bold text-[#2D5A3D]">
              {participantCount.toLocaleString("ko-KR")}
              {maxCapacity ? ` / ${maxCapacity.toLocaleString("ko-KR")}` : ""}명
            </p>
          </div>
          <Link
            href={isClosed ? "/events" : `/join/${event.join_code}`}
            aria-disabled={isClosed}
            className={`flex-1 rounded-xl px-4 py-3 text-center text-sm font-bold shadow-md transition-all md:flex-none md:px-8 ${
              isClosed
                ? "cursor-not-allowed bg-zinc-200 text-zinc-500"
                : "bg-[#2D5A3D] text-white hover:bg-[#234a30]"
            }`}
          >
            {isClosed ? "마감된 숲길" : "참가 신청하기 →"}
          </Link>
        </div>
      </div>
    </div>
  );
}
