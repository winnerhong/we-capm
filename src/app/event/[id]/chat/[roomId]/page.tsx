import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";
import { ChatRoom } from "./chat-room";

export const dynamic = "force-dynamic";

export default async function ChatRoomPage({ params }: { params: Promise<{ id: string; roomId: string }> }) {
  const { id: eventId, roomId } = await params;
  const supabase = await createClient();

  const { data: room } = await supabase.from("chat_rooms").select("id, name, type, event_id").eq("id", roomId).single();
  if (!room || room.event_id !== eventId) notFound();

  const p = await getParticipant(eventId);
  const myName = p?.name ?? "참가자";

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, sender_name, type, content, file_url, file_name, reply_to_id, is_deleted, created_at")
    .eq("room_id", roomId).order("created_at", { ascending: true }).limit(100);

  await supabase.from("chat_members").update({ last_read_at: new Date().toISOString() })
    .eq("room_id", roomId).eq("participant_name", myName);

  return (
    <ChatRoom eventId={eventId} roomId={roomId} roomName={room.name ?? "채팅"}
      roomType={room.type} myName={myName} initialMessages={messages ?? []} />
  );
}
