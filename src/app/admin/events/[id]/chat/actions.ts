"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createAnnouncementRoomAction(eventId: string) {
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("name").eq("id", eventId).single();

  await supabase.from("chat_rooms").insert({
    event_id: eventId,
    type: "ANNOUNCEMENT",
    name: `📢 ${event?.name ?? "행사"} 공지`,
  });

  revalidatePath(`/admin/events/${eventId}/chat`);
}

export async function sendAnnouncementAction(eventId: string, roomId: string, formData: FormData) {
  const supabase = await createClient();

  const content = String(formData.get("content") ?? "").trim();
  if (!content) throw new Error("내용을 입력해주세요");

  await supabase.from("chat_messages").insert({
    room_id: roomId,
    sender_name: "관리자",
    type: "ANNOUNCEMENT",
    content,
  });

  revalidatePath(`/admin/events/${eventId}/chat`);
}

export async function createTeamChatRoom(eventId: string, teamId: string, teamName: string) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("chat_rooms")
    .select("id")
    .eq("event_id", eventId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: room } = await supabase
    .from("chat_rooms")
    .insert({
      event_id: eventId,
      type: "TEAM",
      name: `🤝 ${teamName}`,
      team_id: teamId,
    })
    .select("id")
    .single();

  if (!room) return null;
  return room.id;
}
