import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";
import { NameEntryForm } from "./name-entry";

export const dynamic = "force-dynamic";

export default async function ChatListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getParticipant(id);
  const myName = p?.name ?? null;

  if (!myName) {
    const supabase = await createClient();
    const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
    return <NameEntryForm eventId={id} eventName={event?.name ?? "행사"} />;
  }

  const supabase = await createClient();
  const { data: rooms } = await supabase
    .from("chat_rooms").select("id, type, name, created_at")
    .eq("event_id", id).order("created_at", { ascending: false });

  const lastMessages = new Map<string, { content: string | null; created_at: string; sender_name: string }>();
  for (const room of rooms ?? []) {
    const { data: msgs } = await supabase
      .from("chat_messages").select("content, created_at, sender_name")
      .eq("room_id", room.id).eq("is_deleted", false)
      .order("created_at", { ascending: false }).limit(1);
    if (msgs?.[0]) lastMessages.set(room.id, msgs[0]);
  }

  const typeIcon: Record<string, string> = { ANNOUNCEMENT: "📢", TEAM: "🤝", DIRECT: "👤", GROUP: "👥" };

  return (
    <main className="min-h-dvh bg-white pb-20">
      <div className="mx-auto max-w-lg">
        <header className="border-b p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">💬 채팅</h1>
            <span className="text-sm">{myName}님</span>
          </div>
        </header>
        {(rooms ?? []).length > 0 ? (
          <ul className="divide-y">
            {(rooms ?? []).map((room) => {
              const last = lastMessages.get(room.id);
              return (
                <li key={room.id}>
                  <Link href={`/event/${id}/chat/${room.id}`} className="flex items-center gap-3 p-4 hover:bg-neutral-50">
                    <span className="text-2xl">{typeIcon[room.type] ?? "💬"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{room.name ?? "채팅"}</div>
                      {last && <p className="truncate text-sm">{last.sender_name}: {last.content}</p>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-8 text-center text-sm">채팅방이 없습니다</div>
        )}
      </div>
    </main>
  );
}
