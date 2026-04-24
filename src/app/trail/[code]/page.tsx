import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TrailRow, TrailStopRow } from "@/lib/trails/types";
import { MISSION_TYPE_META } from "@/lib/trails/types";
import { MissionForm } from "./mission-form";
import { TrailProgress } from "./trail-progress";
import { TrailOverviewProgress } from "./trail-overview-progress";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────
// /trail/[code] — code 가 qr_code면 "지점 미션 페이지",
//                 slug면 "숲길 전체 보기" 로 분기
// ─────────────────────────────────────────────────────────────────────────
export default async function TrailCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();

  // 1) qr_code로 stop 찾기 (지점 미션 페이지)
  const stopSel = supabase.from("partner_trail_stops" as never) as unknown as {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        maybeSingle: () => Promise<{ data: TrailStopRow | null }>;
      };
    };
  };
  const { data: stop } = await stopSel
    .select(
      "id, trail_id, order, name, description, location_hint, lat, lng, photo_url, qr_code, mission_type, mission_config, reward_points, is_active, created_at"
    )
    .eq("qr_code", code)
    .maybeSingle();

  if (stop) {
    return <StopView stop={stop} />;
  }

  // 2) slug로 trail 찾기 (숲길 전체 보기)
  const trailSel = supabase.from("partner_trails" as never) as unknown as {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        maybeSingle: () => Promise<{ data: TrailRow | null }>;
      };
    };
  };
  const { data: trailBySlug } = await trailSel
    .select(
      "id, partner_id, name, description, cover_image_url, difficulty, estimated_minutes, distance_km, total_slots, theme, is_public, slug, view_count, completion_count, status, created_at, updated_at"
    )
    .eq("slug", code)
    .maybeSingle();

  if (trailBySlug) {
    return <TrailOverview trail={trailBySlug} />;
  }

  notFound();
}

// ─────────────────────────────────────────────────────────────────────────
// 뷰 1: 지점 미션
// ─────────────────────────────────────────────────────────────────────────
async function StopView({ stop }: { stop: TrailStopRow }) {
  const supabase = await createClient();

  const trailSel = supabase.from("partner_trails" as never) as unknown as {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        maybeSingle: () => Promise<{ data: TrailRow | null }>;
      };
    };
  };
  const { data: trail } = await trailSel
    .select(
      "id, partner_id, name, description, cover_image_url, difficulty, estimated_minutes, distance_km, total_slots, theme, is_public, slug, view_count, completion_count, status, created_at, updated_at"
    )
    .eq("id", stop.trail_id)
    .maybeSingle();

  if (!trail) notFound();

  if (trail.status === "ARCHIVED") {
    return <ArchivedNotice name={trail.name} />;
  }

  // view_count += 1 (에러 무시)
  try {
    const updater = supabase.from("partner_trails" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: unknown }>;
      };
    };
    await updater.update({ view_count: (trail.view_count ?? 0) + 1 }).eq("id", trail.id);
  } catch {
    /* ignore */
  }

  // 전체 지점 수
  const allStopsSel = supabase.from("partner_trail_stops" as never) as unknown as {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        eq: (
          k: string,
          v: boolean
        ) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: TrailStopRow[] | null }>;
        };
      };
    };
  };
  const { data: allStops } = await allStopsSel
    .select("id, trail_id, order, name, qr_code, location_hint, reward_points, mission_type")
    .eq("trail_id", trail.id)
    .eq("is_active", true)
    .order("order", { ascending: true });

  const stops = allStops ?? [];
  const totalStops = stops.length;
  const meta = MISSION_TYPE_META[stop.mission_type];

  return (
    <main className="min-h-dvh bg-gradient-to-b from-[#E8F0E4] via-[#FFF8F0] to-white pb-16">
      <div className="mx-auto w-full max-w-md px-4 pt-6">
        {/* 헤더 */}
        <header className="mb-4">
          <Link
            href={trail.slug ? `/trail/${trail.slug}` : "#"}
            className="inline-flex items-center gap-1 text-sm text-[#2D5A3D] hover:underline"
          >
            <span>🌲</span>
            <span className="font-semibold">{trail.name}</span>
          </Link>
          <TrailProgress
            trailId={trail.id}
            totalStops={totalStops}
            className="mt-3"
          />
        </header>

        {/* 지점 카드 */}
        <section className="rounded-3xl bg-white shadow-lg overflow-hidden">
          {/* 이미지 영역 */}
          <div className="relative h-52 w-full bg-gradient-to-br from-[#D4E4BC] to-[#A8C686] flex items-center justify-center">
            {stop.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={stop.photo_url}
                alt={stop.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-7xl drop-shadow-sm" aria-hidden>
                🌲
              </span>
            )}
            <div className="absolute top-3 left-3 rounded-full bg-white/90 backdrop-blur px-3 py-1 text-xs font-bold text-[#2D5A3D] shadow">
              {stop.order}/{totalStops || "?"} 지점
            </div>
            <div className="absolute top-3 right-3 rounded-full bg-[#FFD700] px-3 py-1 text-xs font-bold text-[#2D5A3D] shadow">
              ⭐ {stop.reward_points}점
            </div>
          </div>

          <div className="p-6">
            <h1 className="text-2xl font-extrabold text-[#2D5A3D] leading-tight">
              {stop.name}
            </h1>

            {stop.description && (
              <p className="mt-2 text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
                {stop.description}
              </p>
            )}

            {stop.location_hint && (
              <div className="mt-3 rounded-xl bg-[#E8F0E4] px-3 py-2 text-sm text-[#2D5A3D] flex items-start gap-2">
                <span aria-hidden>📍</span>
                <span className="leading-relaxed">{stop.location_hint}</span>
              </div>
            )}

            {/* 미션 타입 뱃지 */}
            <div
              className="mt-4 inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 text-sm font-semibold"
              style={{
                borderColor: "#D4E4BC",
                backgroundColor: "#E8F0E4",
                color: "#2D5A3D",
              }}
            >
              <span aria-hidden>{meta.icon}</span>
              <span>{meta.label}</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">{meta.desc}</p>
          </div>
        </section>

        {/* 미션 폼 */}
        <section className="mt-4 rounded-3xl bg-white shadow-lg p-6">
          <h2 className="text-lg font-bold text-[#2D5A3D] mb-3">🎯 미션 수행</h2>
          <MissionForm
            qrCode={stop.qr_code}
            trailId={trail.id}
            missionType={stop.mission_type}
            missionConfig={stop.mission_config as Record<string, unknown>}
            targetLat={stop.lat}
            targetLng={stop.lng}
          />
        </section>

        {/* 방문 지점 표시 */}
        <section className="mt-4 rounded-3xl bg-white/60 p-5">
          <h3 className="text-sm font-bold text-[#2D5A3D] mb-2">🗺️ 지점 목록</h3>
          <ol className="space-y-2">
            {stops.map((s) => (
              <li
                key={s.id}
                className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
                  s.qr_code === stop.qr_code
                    ? "bg-[#2D5A3D] text-white font-bold"
                    : "bg-white text-zinc-700"
                }`}
              >
                <span className="w-6 text-center">{s.order}</span>
                <span className="flex-1 truncate">{s.name}</span>
                <span
                  className={`text-xs ${
                    s.qr_code === stop.qr_code ? "text-[#FFD700]" : "text-zinc-400"
                  }`}
                >
                  ⭐ {s.reward_points}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 뷰 2: 숲길 전체 보기 (slug 매칭 시)
// ─────────────────────────────────────────────────────────────────────────
async function TrailOverview({ trail }: { trail: TrailRow }) {
  const supabase = await createClient();

  if (trail.status === "ARCHIVED") {
    return <ArchivedNotice name={trail.name} />;
  }

  const stopsSel = supabase.from("partner_trail_stops" as never) as unknown as {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        eq: (
          k: string,
          v: boolean
        ) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: TrailStopRow[] | null }>;
        };
      };
    };
  };
  const { data: stopsData } = await stopsSel
    .select(
      "id, trail_id, order, name, description, location_hint, qr_code, mission_type, reward_points"
    )
    .eq("trail_id", trail.id)
    .eq("is_active", true)
    .order("order", { ascending: true });

  const stops = stopsData ?? [];
  const totalPoints = stops.reduce((sum, s) => sum + (s.reward_points ?? 0), 0);

  return (
    <main className="min-h-dvh bg-gradient-to-b from-[#E8F0E4] via-[#FFF8F0] to-white pb-16">
      <div className="mx-auto w-full max-w-md px-4 pt-6">
        {/* 커버 */}
        <section className="rounded-3xl overflow-hidden shadow-lg bg-white">
          <div className="relative h-44 bg-gradient-to-br from-[#2D5A3D] via-[#4A7C59] to-[#A8C686] flex items-center justify-center">
            {trail.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={trail.cover_image_url}
                alt={trail.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-6xl" aria-hidden>
                🌳
              </span>
            )}
          </div>
          <div className="p-5">
            <h1 className="text-2xl font-extrabold text-[#2D5A3D]">{trail.name}</h1>
            {trail.description && (
              <p className="mt-2 text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
                {trail.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {trail.estimated_minutes && (
                <span className="rounded-full bg-[#E8F0E4] px-3 py-1 text-[#2D5A3D] font-semibold">
                  ⏱ 약 {trail.estimated_minutes}분
                </span>
              )}
              {trail.distance_km !== null && (
                <span className="rounded-full bg-[#E8F0E4] px-3 py-1 text-[#2D5A3D] font-semibold">
                  📏 {trail.distance_km}km
                </span>
              )}
              <span className="rounded-full bg-[#FFD700]/30 px-3 py-1 text-[#2D5A3D] font-semibold">
                ⭐ 총 {totalPoints}점
              </span>
            </div>
          </div>
        </section>

        <TrailOverviewProgress
          trailId={trail.id}
          totalStops={stops.length}
          slug={trail.slug}
          className="mt-4"
        />

        {/* 안내 */}
        <div className="mt-4 rounded-2xl bg-[#FFF8F0] border-2 border-[#C4956A]/30 p-4 text-sm text-[#2D5A3D] leading-relaxed">
          <p className="font-bold mb-1">📱 시작 방법</p>
          <p>
            각 지점에 있는 <b>QR 코드를 스캔</b>하면 미션이 열려요. 자유롭게 순서대로
            방문해 보세요!
          </p>
        </div>

        {/* 지점 리스트 */}
        <section className="mt-4 space-y-2">
          <h2 className="text-lg font-bold text-[#2D5A3D] px-1">🗺️ 지점 목록</h2>
          {stops.length === 0 ? (
            <p className="rounded-2xl bg-white p-4 text-sm text-zinc-500">
              아직 등록된 지점이 없어요.
            </p>
          ) : (
            stops.map((s) => {
              const meta = MISSION_TYPE_META[s.mission_type];
              return (
                <div
                  key={s.id}
                  className="rounded-2xl bg-white shadow p-4 flex items-start gap-3"
                >
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-[#E8F0E4] flex items-center justify-center font-bold text-[#2D5A3D]">
                    {s.order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#2D5A3D] truncate">{s.name}</p>
                    {s.location_hint && (
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">
                        📍 {s.location_hint}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[#2D5A3D] font-semibold">
                        {meta.icon} {meta.label}
                      </span>
                      <span className="text-[#C4956A] font-semibold">
                        ⭐ {s.reward_points}점
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 보관된 숲길 안내
// ─────────────────────────────────────────────────────────────────────────
function ArchivedNotice({ name }: { name: string }) {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-[#E8F0E4] to-white flex items-center justify-center p-6">
      <div className="max-w-md rounded-3xl bg-white shadow-lg p-8 text-center">
        <div className="text-5xl mb-3" aria-hidden>
          🗂️
        </div>
        <h1 className="text-xl font-extrabold text-[#2D5A3D]">
          이 숲길은 비공개되었습니다
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          &ldquo;{name}&rdquo; 은(는) 현재 보관 처리되어 이용할 수 없어요.
        </p>
      </div>
    </main>
  );
}
