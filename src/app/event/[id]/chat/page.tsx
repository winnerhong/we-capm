import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { NameEntryForm } from "./name-entry";

export const dynamic = "force-dynamic";

export default async function ChatListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const cookieStore = await cookies();
  const participantCookie = cookieStore.get("campnic_participant");

  let myName: string | null = null;
  let myPhone: string | null = null;

  if (participantCookie) {
    try {
      const data = JSON.parse(participantCookie.value);
      if (data.eventId === id) {
        myName = data.name;
        myPhone = data.phone;
      }
    } catch {}
  }

  if (!myName) {
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

  if (!myName) {
    const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
    return <NameEntryForm eventId={id} eventName={event?.name ?? "행사"} />;
  }

  const { data: rooms } = await supabase
    .from("chat_rooms")
    .select("id, type, name, created_at")
    .eq("event_id", id)
    .order("created_at", { ascending: false });

  const myRooms: typeof rooms = [];
  for (const room of rooms ?? []) {
    if (room.type === "ANNOUNCEMENT") {
      myRooms.push(room);
      continue;
    }
    const { data: membership } = await supabase
      .from("chat_members")
      .select("id")
      .eq("room_id", room.id)
      .or(`participant_name.eq.${myName},participant_phone.eq.${myPhone ?? ""}`)
      .is("left_at", null)
      .maybeSingle();
    if (membership) myRooms.push(room);
  }

  const lastMessages = new Map<string, { content: string | null; created_at: string; sender_name: string }>();
  const unreadCounts = new Map<string, number>();

  for (const room of myRooms) {
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("content, created_at, sender_name")
      .eq("room_id", room.id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(1);
    if (msgs?.[0]) lastMessages.set(room.id, msgs[0]);

    const { data: members } = await supabase
      .from("chat_members")
      .select("last_read_at")
      .eq("room_id", room.id)
      .eq("participant_name", myName ?? "")
      .limit(1);

    if (members?.[0]) {
      const { count } = await supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.id)
        .gt("created_at", members[0].last_read_at)
        .eq("is_deleted", false);
      unreadCounts.set(room.id, count ?? 0);
    }
  }

  const typeIcon: Record<string, string> = {
    ANNOUNCEMENT: "📢",
    TEAM: "🤝",
    DIRECT: "👤",
    GROUP: "👥",
  };

  return (
    <main className="min-h-dvh bg-white pb-20">
      <div className="mx-auto max-w-lg">
        <header className="border-b p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">💬 채팅</h1>
            <span className="text-sm">{myName}님</span>
          </div>
        </header>

        {myRooms.length > 0 ? (
          <ul className="divide-y">
            {myRooms.map((room) => {
              const last = lastMessages.get(room.id);
              const unread = unreadCounts.get(room.id) ?? 0;
              return (
                <li key={room.id}>
                  <Link
                    href={`/event/${id}/chat/${room.id}`}
                    className="flex items-center gap-3 p-4 hover:bg-neutral-50"
                  >
                    <span className="text-2xl">{typeIcon[room.type] ?? "💬"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{room.name ?? "채팅"}</div>
                      {last && (
                        <p className="truncate text-sm text-neutral-600">
                          {last.sender_name}: {last.content}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {last && (
                        <span className="text-xs text-neutral-400">
                          {new Date(last.created_at).toLocaleTimeString("ko-KR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                      {unread > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                          {unread}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-8 text-center text-sm text-neutral-500">
            채팅방이 없습니다
          </div>
        )}
      </div>
    </main>
  );
}
