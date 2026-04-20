import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";
import { WelcomeWalkthrough } from "./welcome-walkthrough";

export const dynamic = "force-dynamic";

export default async function WelcomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getParticipant(id);
  if (!p) redirect("/join");

  const supabase = await createClient();
  const [eventRes, missionRes] = await Promise.all([
    supabase.from("events").select("id, name, location").eq("id", id).single(),
    supabase
      .from("missions")
      .select("id, title, points, template_type")
      .eq("event_id", id)
      .eq("is_active", true)
      .order("order", { ascending: true })
      .limit(1),
  ]);

  const event = eventRes.data;
  if (!event) notFound();

  const firstMission = missionRes.data?.[0] ?? null;

  return (
    <WelcomeWalkthrough
      eventId={id}
      eventName={event.name}
      firstMission={firstMission}
    />
  );
}
