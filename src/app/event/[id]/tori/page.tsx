import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";
import { ToriChat } from "./tori-chat";
import type { StampTierConfig } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

function resolveTier(count: number, config: StampTierConfig | null): string {
  if (!config) return "씨앗";
  if (count >= config.keeper.goal_count) return config.keeper.label;
  if (count >= config.explorer.goal_count) return config.explorer.label;
  if (count >= config.sprout.goal_count) return config.sprout.label;
  return "씨앗";
}

export default async function ToriPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getParticipant(id);
  if (!p) redirect("/join");

  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", id)
    .single();
  if (!event) notFound();

  const { data: participant } = await supabase
    .from("participants")
    .select("id, total_score")
    .eq("event_id", id)
    .eq("phone", p.phone)
    .maybeSingle();

  // 완료한 숲길 수
  let completed = 0;
  let nextMissionTitle: string | null = null;
  if (participant) {
    const [{ data: subs }, { data: missions }] = await Promise.all([
      supabase
        .from("submissions")
        .select("mission_id, status")
        .eq("participant_id", participant.id)
        .in("status", ["APPROVED", "AUTO_APPROVED", "PENDING"]),
      supabase
        .from("missions")
        .select("id, title, order")
        .eq("event_id", id)
        .eq("is_active", true)
        .order("order", { ascending: true }),
    ]);
    const done = new Set((subs ?? []).map((s) => s.mission_id));
    completed = (missions ?? []).filter((m) => done.has(m.id)).length;
    const next = (missions ?? []).find((m) => !done.has(m.id));
    nextMissionTitle = next?.title ?? null;
  }

  // 도토리 단계 (첫 번째 스탬프 보드 기준)
  let tier = "씨앗";
  if (participant) {
    const { data: board } = await supabase
      .from("stamp_boards")
      .select("id, tier_config")
      .eq("event_id", id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (board) {
      const { count } = await supabase
        .from("stamp_records")
        .select("*", { count: "exact", head: true })
        .eq("participant_id", participant.id);
      tier = resolveTier(count ?? 0, board.tier_config as StampTierConfig | null);
    }
  }

  const acorns = participant?.total_score ?? 0;

  return (
    <main className="flex min-h-dvh flex-col bg-[#F5F1E8] pb-20">
      <header className="flex items-center justify-between bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] px-4 py-3 text-white shadow-lg">
        <Link
          href={`/event/${id}`}
          aria-label="뒤로"
          className="text-lg hover:opacity-80"
        >
          ←
        </Link>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 font-bold">
            🐿️ 토리와 대화하기
          </div>
          <div className="text-[11px] opacity-80">무엇이든 물어보세요</div>
        </div>
        <div className="w-6" />
      </header>

      <ToriChat
        eventId={id}
        context={{
          acorns,
          completedMissions: completed,
          tier,
          nextMissionTitle,
          eventName: event.name,
        }}
      />
    </main>
  );
}
