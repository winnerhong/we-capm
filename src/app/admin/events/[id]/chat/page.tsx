import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { EventChatView } from "./event-chat-view";

export const dynamic = "force-dynamic";

export default async function AdminEventChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, start_at, end_at, manager_id")
    .eq("id", id)
    .single();

  if (!event) notFound();

  const cookieStore = await cookies();
  const isAdmin = !!cookieStore.get("campnic_admin")?.value;
  const managerCookie = cookieStore.get("campnic_manager")?.value;

  // 이 행사의 모든 채팅방
  const { data: rooms } = await supabase
    .from("chat_rooms")
    .select("id, name, type, created_at")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  // 각 방의 마지막 메시지 + 멤버 수
  const enriched = await Promise.all((rooms ?? []).map(async (room) => {
    const [lastMsgRes, memberCountRes] = await Promise.all([
      supabase.from("chat_messages")
        .select("content, sender_name, created_at")
        .eq("room_id", room.id).eq("is_deleted", false)
        .order("created_at", { ascending: false }).limit(1),
      supabase.from("chat_members")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.id).is("left_at", null),
    ]);
    const lastMsg = lastMsgRes.data?.[0];
    return {
      ...room,
      lastMessage: lastMsg?.content ?? "",
      lastSender: lastMsg?.sender_name ?? "",
      lastTime: lastMsg?.created_at ?? room.created_at,
      memberCount: memberCountRes.count ?? 0,
    };
  }));

  // 기관 이름
  let myName = "[기관] 관리자";
  if (managerCookie) {
    try { myName = `[기관] ${JSON.parse(managerCookie).managerId}`; } catch {}
  }

  // 기관을 멤버로 자동 추가 (모든 방)
  for (const room of enriched) {
    const { data: member } = await supabase
      .from("chat_members")
      .select("id")
      .eq("room_id", room.id)
      .eq("participant_name", myName)
      .maybeSingle();
    if (!member) {
      await supabase.from("chat_members").insert({
        room_id: room.id, participant_name: myName, role: "ADMIN",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href={isAdmin ? `/admin/events/${id}` : `/manager/${id}`}
          className="text-sm hover:underline">← {event.name}</Link>
      </div>
      <EventChatView
        eventId={id}
        eventName={event.name}
        eventStartAt={event.start_at}
        eventEndAt={event.end_at}
        rooms={enriched}
        myName={myName}
        isAdmin={isAdmin}
      />
    </div>
  );
}
