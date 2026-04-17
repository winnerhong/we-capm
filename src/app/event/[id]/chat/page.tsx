import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";
import { ChatRoom } from "./[roomId]/chat-room";

export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getParticipant(id);
  if (!p) redirect("/join");

  const supabase = await createClient();

  const { data: room } = await supabase
    .from("chat_rooms").select("id, name")
    .eq("event_id", id).eq("type", "GROUP").maybeSingle();

  if (!room) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6 pb-20">
        <div className="text-center text-sm">아직 채팅이 준비되지 않았습니다</div>
      </main>
    );
  }

  const myName = p.name === "참가자" ? p.phone : `${p.name} 가족`;

  // 멤버 자동 추가
  const { data: member } = await supabase.from("chat_members").select("id")
    .eq("room_id", room.id).eq("participant_phone", p.phone).maybeSingle();
  if (!member) {
    await supabase.from("chat_members").insert({
      room_id: room.id, participant_name: myName, participant_phone: p.phone,
    });
  }

  await supabase.from("chat_members").update({ last_read_at: new Date().toISOString() })
    .eq("room_id", room.id).eq("participant_phone", p.phone);

  const { data: messages } = await supabase.from("chat_messages")
    .select("id, sender_name, type, content, file_url, file_name, reply_to_id, is_deleted, created_at")
    .eq("room_id", room.id).order("created_at", { ascending: true }).limit(200);

  const { count: memberCount } = await supabase.from("chat_members")
    .select("*", { count: "exact", head: true }).eq("room_id", room.id).is("left_at", null);

  return (
    <ChatRoom eventId={id} roomId={room.id} roomName={room.name ?? "채팅"}
      roomType="GROUP" myName={myName} initialMessages={messages ?? []}
      memberCount={memberCount ?? 0} />
  );
}
