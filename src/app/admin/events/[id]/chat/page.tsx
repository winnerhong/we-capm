import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ChatRoom } from "@/app/event/[id]/chat/[roomId]/chat-room";
import { sendAnnouncementAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
  if (!event) notFound();

  // GROUP 단톡방 찾기 (없으면 자동 생성)
  let room = (await supabase.from("chat_rooms").select("id, name")
    .eq("event_id", id).eq("type", "GROUP").maybeSingle()).data;

  if (!room) {
    const { data: newRoom } = await supabase.from("chat_rooms")
      .insert({ event_id: id, type: "GROUP", name: event.name })
      .select("id, name").single();
    room = newRoom;
  }

  if (!room) return <div>채팅방 생성 실패</div>;

  // 기관 이름 결정
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("campnic_admin")?.value;
  const managerCookie = cookieStore.get("campnic_manager")?.value;

  let myName = "[기관] 관리자";
  if (managerCookie) {
    try { myName = `[기관] ${JSON.parse(managerCookie).managerId}`; } catch {}
  } else if (adminCookie) {
    myName = "[기관] 관리자";
  }

  // 멤버 자동 추가
  const { data: member } = await supabase.from("chat_members").select("id")
    .eq("room_id", room.id).eq("participant_name", myName).maybeSingle();
  if (!member) {
    await supabase.from("chat_members").insert({
      room_id: room.id, participant_name: myName, role: "ADMIN",
    });
  }

  const { data: messages } = await supabase.from("chat_messages")
    .select("id, sender_name, type, content, file_url, file_name, reply_to_id, is_deleted, created_at")
    .eq("room_id", room.id).order("created_at", { ascending: true }).limit(200);

  const { count: memberCount } = await supabase.from("chat_members")
    .select("*", { count: "exact", head: true }).eq("room_id", room.id).is("left_at", null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/admin/events/${id}`} className="text-sm hover:underline">← {event.name}</Link>
          <h1 className="text-2xl font-bold">💬 채팅</h1>
        </div>
      </div>

      {/* 공지 보내기 */}
      <form action={sendAnnouncementAction.bind(null, id, room.id)} className="flex gap-2">
        <input name="content" type="text" required placeholder="📢 공지 메시지 입력"
          className="flex-1 rounded-lg border px-3 py-2" />
        <button type="submit" className="rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-700">공지</button>
      </form>

      {/* 채팅방 */}
      <div className="rounded-2xl border overflow-hidden" style={{ height: "60vh" }}>
        <ChatRoom eventId={id} roomId={room.id} roomName={event.name}
          roomType="GROUP" myName={myName} initialMessages={messages ?? []}
          memberCount={memberCount ?? 0} />
      </div>
    </div>
  );
}
