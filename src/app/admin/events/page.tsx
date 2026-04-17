import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EventListClient } from "./event-list-client";

export const dynamic = "force-dynamic";

export default async function EventsListPage() {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, name, status, start_at, end_at, location, manager_id, join_code")
    .order("start_at", { ascending: false });

  // 각 행사별 참가자/등록 수
  const enriched = await Promise.all(
    (events ?? []).map(async (e) => {
      const [{ count: regCount }, { count: participantCount }, { count: pendingCount }] = await Promise.all([
        supabase.from("event_registrations").select("*", { count: "exact", head: true }).eq("event_id", e.id).not("name", "like", "%선생님%"),
        supabase.from("participants").select("*", { count: "exact", head: true }).eq("event_id", e.id),
        supabase.from("submissions").select("missions!inner(event_id)", { count: "exact", head: true }).eq("missions.event_id", e.id).eq("status", "PENDING"),
      ]);
      return { ...e, regCount: regCount ?? 0, participantCount: participantCount ?? 0, pendingCount: pendingCount ?? 0 };
    })
  );

  return <EventListClient events={enriched} />;
}
