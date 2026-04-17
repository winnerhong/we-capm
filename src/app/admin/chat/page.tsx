import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { WinnerTalkIcon } from "@/components/winner-talk-icon";

export const dynamic = "force-dynamic";

export default async function AdminChatPage() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const isAdmin = !!cookieStore.get("campnic_admin")?.value;
  const managerCookie = cookieStore.get("campnic_manager")?.value;

  // 행사별로 그룹핑된 톡방 목록
  let eventIds: string[] = [];

  if (isAdmin) {
    const { data } = await supabase.from("events").select("id").order("created_at", { ascending: false });
    eventIds = (data ?? []).map((e) => e.id);
  } else if (managerCookie) {
    try {
      const { eventId } = JSON.parse(managerCookie);
      eventIds = [eventId];
    } catch {}
  }

  // 각 행사의 정보 + 톡방 수 + 마지막 메시지
  const events = await Promise.all(eventIds.map(async (eid) => {
    const [{ data: event }, { data: rooms }] = await Promise.all([
      supabase.from("events").select("id, name, start_at, status").eq("id", eid).single(),
      supabase.from("chat_rooms").select("id").eq("event_id", eid),
    ]);

    const roomIds = (rooms ?? []).map((r) => r.id);
    let lastTime = "";
    let lastMessage = "";

    if (roomIds.length > 0) {
      const { data: lastMsg } = await supabase.from("chat_messages")
        .select("content, created_at")
        .in("room_id", roomIds)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(1);
      if (lastMsg?.[0]) {
        lastTime = lastMsg[0].created_at;
        lastMessage = lastMsg[0].content ?? "";
      }
    }

    return {
      id: event?.id ?? eid,
      name: event?.name ?? "행사",
      startAt: event?.start_at ?? "",
      status: event?.status ?? "",
      roomCount: roomIds.length,
      lastTime,
      lastMessage,
    };
  }));

  // 최근 메시지가 있는 행사를 먼저
  events.sort((a, b) => {
    if (a.lastTime && b.lastTime) return b.lastTime.localeCompare(a.lastTime);
    if (a.lastTime) return -1;
    if (b.lastTime) return 1;
    return 0;
  });

  const formatTime = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    if (d.getDate() === now.getDate() && d.getMonth() === now.getMonth()) {
      return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    }
    return `${d.getMonth() + 1}.${d.getDate()}`;
  };

  const statusLabel: Record<string, { text: string; color: string }> = {
    DRAFT: { text: "준비중", color: "bg-neutral-100 text-neutral-600" },
    ACTIVE: { text: "진행중", color: "bg-green-100 text-green-700" },
    ENDED: { text: "종료", color: "bg-yellow-100 text-yellow-700" },
    CONFIRMED: { text: "확정", color: "bg-blue-100 text-blue-700" },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <WinnerTalkIcon size={28} />
        <h1 className="text-xl font-bold">위너톡</h1>
        <span className="text-sm text-neutral-400">{events.length}개 행사</span>
      </div>

      <div className="grid gap-3">
        {events.map((event) => {
          const st = statusLabel[event.status] ?? statusLabel.DRAFT;
          return (
            <Link key={event.id} href={`/admin/events/${event.id}/chat`}
              className="flex items-center gap-4 rounded-2xl border bg-white p-4 hover:shadow-md transition-shadow">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-violet-100">
                <WinnerTalkIcon size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold truncate">{event.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.color}`}>{st.text}</span>
                </div>
                <div className="text-xs text-neutral-500 mt-0.5 truncate">
                  {event.roomCount}개 톡방 · {event.lastMessage ? event.lastMessage : "메시지 없음"}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[10px] text-neutral-400">{formatTime(event.lastTime)}</div>
                <div className="text-xs text-violet-600 mt-1">→</div>
              </div>
            </Link>
          );
        })}

        {events.length === 0 && (
          <div className="rounded-2xl border bg-white p-12 text-center text-neutral-400">
            <WinnerTalkIcon size={48} />
            <p className="mt-3">아직 행사가 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
