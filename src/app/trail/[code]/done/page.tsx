import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TrailRow, TrailStopRow } from "@/lib/trails/types";
import { DoneActions } from "./done-actions";
import { DoneProgress } from "./done-progress";

export const dynamic = "force-dynamic";

export default async function TrailDonePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ score?: string }>;
}) {
  const { code } = await params;
  const { score } = await searchParams;
  const earned = Number(score ?? 0) || 0;

  const supabase = await createClient();

  // 현재 stop
  const stopSel = supabase.from("partner_trail_stops" as never) as unknown as {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        maybeSingle: () => Promise<{ data: TrailStopRow | null }>;
      };
    };
  };
  const { data: stop } = await stopSel
    .select(
      "id, trail_id, order, name, qr_code, mission_type, reward_points"
    )
    .eq("qr_code", code)
    .maybeSingle();

  if (!stop) notFound();

  // 숲길 정보
  const trailSel = supabase.from("partner_trails" as never) as unknown as {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        maybeSingle: () => Promise<{ data: TrailRow | null }>;
      };
    };
  };
  const { data: trail } = await trailSel
    .select("id, name, slug, total_slots")
    .eq("id", stop.trail_id)
    .maybeSingle();

  if (!trail) notFound();

  // 다음 지점
  const nextSel = supabase.from("partner_trail_stops" as never) as unknown as {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        eq: (k: string, v: boolean) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: TrailStopRow[] | null }>;
        };
      };
    };
  };
  const { data: stopsList } = await nextSel
    .select(
      "id, trail_id, order, name, qr_code, location_hint, mission_type, reward_points"
    )
    .eq("trail_id", trail.id)
    .eq("is_active", true)
    .order("order", { ascending: true });

  const stops = stopsList ?? [];
  const nextStop = stops.find((s) => s.order > stop.order) ?? null;
  const totalStops = stops.length;

  return (
    <main className="min-h-dvh bg-gradient-to-b from-[#E8F0E4] via-[#FFF8F0] to-white pb-16">
      <div className="mx-auto w-full max-w-md px-4 pt-10">
        {/* 축하 카드 */}
        <section className="rounded-3xl bg-white shadow-xl p-6 text-center">
          <div className="text-6xl mb-2" aria-hidden>
            🎉
          </div>
          <h1 className="text-3xl font-extrabold text-[#2D5A3D]">미션 완료!</h1>
          <p className="mt-1 text-sm text-zinc-600">
            <b>{stop.name}</b> 지점을 통과했어요
          </p>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#FFD700] px-5 py-2 text-[#2D5A3D] font-extrabold text-lg shadow">
            <span aria-hidden>⭐</span>
            <span>+{earned}점</span>
          </div>
        </section>

        {/* 진행률 */}
        <DoneProgress
          trailId={trail.id}
          totalStops={totalStops}
          className="mt-4"
        />

        {/* 다음 지점 or 완주 */}
        {nextStop ? (
          <section className="mt-4 rounded-3xl bg-white shadow-lg p-5">
            <p className="text-xs font-semibold text-zinc-500 mb-1">다음 지점</p>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 h-12 w-12 rounded-full bg-[#E8F0E4] flex items-center justify-center font-extrabold text-[#2D5A3D] text-lg">
                {nextStop.order}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[#2D5A3D] truncate">{nextStop.name}</p>
                {nextStop.location_hint && (
                  <p className="text-xs text-zinc-500 truncate">
                    📍 {nextStop.location_hint}
                  </p>
                )}
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-500 leading-relaxed">
              다음 지점에 도착하면 QR 코드를 스캔해 주세요.
            </p>
          </section>
        ) : (
          <section className="mt-4 rounded-3xl bg-gradient-to-br from-[#FFD700]/40 to-[#C4956A]/30 border-2 border-[#FFD700] p-6 text-center">
            <div className="text-5xl mb-2" aria-hidden>
              🏆
            </div>
            <p className="text-xl font-extrabold text-[#2D5A3D]">전체 완주 완료!</p>
            <p className="text-sm text-zinc-700 mt-1">모든 지점을 통과했어요</p>
            {trail.slug && (
              <Link
                href={`/trail/${trail.slug}/complete`}
                className="mt-4 inline-block w-full h-12 rounded-xl bg-[#2D5A3D] text-white font-bold leading-[3rem]"
              >
                완주 인증서 받기 →
              </Link>
            )}
          </section>
        )}

        {/* 공유 + 홈 버튼 */}
        <DoneActions
          trailName={trail.name}
          stopName={stop.name}
          score={earned}
          slug={trail.slug}
          className="mt-4"
        />
      </div>
    </main>
  );
}
