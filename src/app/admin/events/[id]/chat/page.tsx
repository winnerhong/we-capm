import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAnnouncementRoomAction, sendAnnouncementAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
  if (!event) notFound();

  const { data: rooms } = await supabase
    .from("chat_rooms")
    .select("id, type, name, created_at")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  const announcementRoom = rooms?.find((r) => r.type === "ANNOUNCEMENT");

  const { data: recentMessages } = announcementRoom
    ? await supabase
        .from("chat_messages")
        .select("id, sender_name, content, created_at")
        .eq("room_id", announcementRoom.id)
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] };

  const typeIcon: Record<string, string> = {
    ANNOUNCEMENT: "📢", TEAM: "🤝", DIRECT: "👤", GROUP: "👥",
  };

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/admin/events/${id}`} className="text-sm hover:underline">← {event.name}</Link>
        <h1 className="text-2xl font-bold">채팅 관리</h1>
      </div>

      {!announcementRoom && (
        <form action={createAnnouncementRoomAction.bind(null, id)}>
          <button className="w-full rounded-lg bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700">
            📢 전체 공지방 만들기
          </button>
        </form>
      )}

      {announcementRoom && (
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <h2 className="font-semibold">📢 전체 공지 보내기</h2>
          <form action={sendAnnouncementAction.bind(null, id, announcementRoom.id)} className="flex gap-2">
            <input
              name="content"
              type="text"
              required
              placeholder="공지 내용 입력"
              className="flex-1 rounded-lg border px-3 py-2"
            />
            <button type="submit" className="rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-700">
              전송
            </button>
          </form>
          {recentMessages && recentMessages.length > 0 && (
            <ul className="divide-y text-sm">
              {recentMessages.map((m) => (
                <li key={m.id} className="py-2 flex justify-between">
                  <span>{m.content}</span>
                  <span className="text-xs text-neutral-400">
                    {new Date(m.created_at).toLocaleString("ko-KR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <section>
        <h2 className="mb-2 font-semibold">채팅방 목록 ({rooms?.length ?? 0}개)</h2>
        {rooms && rooms.length > 0 ? (
          <ul className="space-y-2">
            {rooms.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg border bg-white p-3">
                <div className="flex items-center gap-2">
                  <span>{typeIcon[r.type] ?? "💬"}</span>
                  <span className="font-medium">{r.name ?? r.type}</span>
                </div>
                <span className="text-xs text-neutral-400">
                  {new Date(r.created_at).toLocaleString("ko-KR")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-center p-8">채팅방이 없습니다</p>
        )}
      </section>
    </div>
  );
}
