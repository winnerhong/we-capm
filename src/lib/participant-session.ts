import { cookies } from "next/headers";

export interface ParticipantSession {
  eventId: string;
  name: string;
  phone: string;
  registrationId?: string;
}

export async function getParticipant(eventId: string): Promise<ParticipantSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("campnic_participant")?.value;
  if (!raw) return null;

  try {
    const data = JSON.parse(raw);
    if (data.eventId === eventId && data.name && data.phone) {
      return {
        eventId: data.eventId,
        name: data.name,
        phone: data.phone,
        registrationId: data.registrationId,
      };
    }
  } catch {}

  return null;
}
