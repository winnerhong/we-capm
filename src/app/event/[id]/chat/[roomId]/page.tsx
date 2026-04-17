import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ChatRoom } from "./chat-room";

export const dynamic = "force-dynamic";

export default async function ChatRoomPage({
  params,
}: {
  params: Promise<{ id: string; roomId: string }>;
}) {
  const { id: eventId, roomId } = await params;
  const supabase = await createClient();
  const cookieStore = await cookies();

  const { data: room } = await supabase
    .from("chat_rooms")
    .select("id, name, type, event_id")
    .eq("id", roomId)
    .single();
  if (!room || room.event_id !== eventId) notFound();

  let myName = "참가자";
  const participantCookie = cookieStore.get("campnic_participant");
  if (participantCookie) {
    try {
      const data = JSON.parse(participantCookie.value);
      if (data.name) myName = data.name;
    } catch {}
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();
      if (profile) myName = profile.name;
    }
  }

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, sender_name, type, content, file_url, file_name, reply_to_id, is_deleted, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(100);

  await supabase
    .from("chat_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("participant_name", myName);

  return (
    <ChatRoom
      eventId={eventId}
      roomId={roomId}
      roomName={room.name ?? "채팅"}
      roomType={room.type}
      myName={myName}
      initialMessages={messages ?? []}
    />
  );
}
