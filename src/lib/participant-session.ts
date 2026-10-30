import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { openSession } from "@/lib/session-cookie";

export interface ParticipantSession {
  eventId: string;
  name: string;
  phone: string;
  participantId?: string;
  registrationId?: string;
}

export async function getParticipant(eventId: string): Promise<ParticipantSession | null> {
  const cookieStore = await cookies();
  const data = await openSession<ParticipantSession & Record<string, unknown>>(
    cookieStore.get("campnic_participant")?.value
  );
  if (data && data.eventId === eventId && data.name && data.phone) {
    return {
      eventId: data.eventId,
      name: data.name,
      phone: data.phone,
      participantId: data.participantId,
      registrationId: data.registrationId,
    };
  }

  return null;
}

export async function getParticipantDb(eventId: string) {
  const session = await getParticipant(eventId);
  if (!session) return null;

  if (session.participantId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("participants")
      .select("id, total_score, team_id, phone")
      .eq("id", session.participantId)
      .single();
    return data ? { ...data, name: session.name } : null;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("participants")
    .select("id, total_score, team_id, phone")
    .eq("event_id", eventId)
    .eq("phone", session.phone)
    .maybeSingle();
  return data ? { ...data, name: session.name } : null;
}
