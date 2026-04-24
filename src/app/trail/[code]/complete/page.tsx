import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TrailRow, TrailStopRow } from "@/lib/trails/types";
import { Certificate } from "./certificate";

export const dynamic = "force-dynamic";

// /trail/[code]/complete — code 는 실제로는 slug 를 기대
export default async function TrailCompletePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
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
    .eq("slug", code)
    .maybeSingle();

  if (!trail) notFound();

  // 지점 목록 (인증서에 표시)
  const stopsSel = supabase.from("partner_trail_stops" as never) as unknown as {
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
  const { data: stopsData } = await stopsSel
    .select("id, trail_id, order, name, qr_code, reward_points, mission_type")
    .eq("trail_id", trail.id)
    .eq("is_active", true)
    .order("order", { ascending: true });

  const stops = stopsData ?? [];
  const totalPoints = stops.reduce((sum, s) => sum + (s.reward_points ?? 0), 0);

  return (
    <main className="min-h-dvh bg-gradient-to-b from-[#E8F0E4] via-[#FFF8F0] to-white pb-16">
      <div className="mx-auto w-full max-w-md px-4 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href={`/trail/${code}`}
            className="text-sm text-[#2D5A3D] hover:underline"
          >
            ← 숲길 보기
          </Link>
          <span className="text-xs text-zinc-500">완주 인증</span>
        </div>

        <Certificate
          trailId={trail.id}
          trailName={trail.name}
          stops={stops.map((s) => ({
            id: s.id,
            order: s.order,
            name: s.name,
            qr_code: s.qr_code,
            reward_points: s.reward_points ?? 0,
          }))}
          totalPoints={totalPoints}
        />
      </div>
    </main>
  );
}
