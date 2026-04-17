"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createAnnouncementRoomAction(eventId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const { data: event } = await supabase.from("events").select("name").eq("id", eventId).single();

  await supabase.from("chat_rooms").insert({
    event_id: eventId,
    type: "ANNOUNCEMENT",
    name: `📢 ${event?.name ?? "행사"} 공지`,
    created_by: user.id,
  });

  revalidatePath(`/admin/events/${eventId}/chat`);
}

export async function sendAnnouncementAction(eventId: string, roomId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const content = String(formData.get("content") ?? "").trim();
  if (!content) throw new Error("내용을 입력해주세요");

  const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();

  await supabase.from("chat_messages").insert({
    room_id: roomId,
    sender_id: user.id,
    sender_name: profile?.name ?? "관리자",
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

  const { data: members } = await supabase
    .from("participants")
    .select("user_id")
    .eq("team_id", teamId);

  if (members) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", members.map((m) => m.user_id));

    if (profiles) {
      await supabase.from("chat_members").insert(
        profiles.map((p) => ({
          room_id: room.id,
          user_id: p.id,
          participant_name: p.name,
          role: "MEMBER" as const,
        }))
      );
    }
  }

  return room.id;
}
