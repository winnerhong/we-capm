import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";
import { WinnerTalkIcon } from "@/components/winner-talk-icon";

export const dynamic = "force-dynamic";

export default async function ChatListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getParticipant(id);
  if (!p) redirect("/join");

  const supabase = await createClient();

  // 내가 속한 방 목록
  const { data: myMemberships } = await supabase
    .from("chat_members")
    .select("room_id")
    .eq("participant_phone", p.phone)
    .is("left_at", null);

  const roomIds = (myMemberships ?? []).map((m) => m.room_id);

  if (roomIds.length === 0) {
    // 아직 방이 없으면 전체 단톡방에 자동 입장 시도
    const { data: groupRoom } = await supabase
      .from("chat_rooms")
      .select("id")
      .eq("event_id", id)
      .eq("name", "💬 전체 단톡방")
      .maybeSingle();

    if (groupRoom) {
      const myName = p.name === "참가자" ? p.phone : `${p.name} 가족`;
      await supabase.from("chat_members").insert({
        room_id: groupRoom.id,
        participant_name: myName,
        participant_phone: p.phone,
      });
      roomIds.push(groupRoom.id);
    }
  }

  // 방 정보 + 마지막 메시지
  const rooms = await Promise.all(
    roomIds.map(async (roomId) => {
      const [{ data: room }, { data: lastMsgArr }, { count: memberCount }] = await Promise.all([
        supabase.from("chat_rooms").select("id, name, type, event_id").eq("id", roomId).single(),
        supabase.from("chat_messages")
          .select("content, sender_name, created_at")
          .eq("room_id", roomId).eq("is_deleted", false)
          .order("created_at", { ascending: false }).limit(1),
        supabase.from("chat_members")
          .select("*", { count: "exact", head: true })
          .eq("room_id", roomId).is("left_at", null),
      ]);

      const lastMsg = lastMsgArr?.[0];
      return {
        id: room?.id ?? roomId,
        name: room?.name ?? "채팅방",
        type: room?.type ?? "GROUP",
        eventId: room?.event_id ?? id,
        lastMessage: lastMsg?.content ?? "",
        lastSender: lastMsg?.sender_name ?? "",
        lastTime: lastMsg?.created_at ?? "",
        memberCount: memberCount ?? 0,
      };
    })
  );

  // 공지방 먼저, 그 다음 전체방, 그 다음 학급방
  rooms.sort((a, b) => {
    if (a.type === "ANNOUNCEMENT") return -1;
    if (b.type === "ANNOUNCEMENT") return 1;
    if (a.name.includes("전체")) return -1;
    if (b.name.includes("전체")) return 1;
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

  const cleanSender = (name: string) =>
    name.replace(/^\[기관\]\s*/, "").replace(/^\[선생님[^\]]*\]\s*/, "");

  return (
    <main className="flex min-h-dvh flex-col bg-neutral-50 pb-20">
      <header className="flex items-center justify-between px-4 py-3 bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] text-white shadow-lg">
        <Link href={`/event/${id}`} className="text-lg">←</Link>
        <div className="flex items-center gap-2">
          <WinnerTalkIcon size={24} className="brightness-200" />
          <span className="font-bold">🐿️ 토리톡</span>
        </div>
        <div className="w-6" />
      </header>

      {rooms.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[#6B6560] text-sm">
          숲에서 나누는 이야기가 아직 없어요 🌱
        </div>
      ) : (
        <div className="divide-y divide-[#D4E4BC] bg-white">
          {rooms.map((room) => (
            <Link key={room.id} href={`/event/${id}/chat/${room.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[#E8F0E4] active:bg-[#D4E4BC]">
              <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-white text-lg
                ${room.type === "ANNOUNCEMENT" ? "bg-[#C4956A]" : "bg-[#4A7C59]"}`}>
                {room.type === "ANNOUNCEMENT" ? "📢" : "🌿"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm truncate">{room.name}</span>
                  <span className="text-[10px] text-[#6B6560] flex-shrink-0 ml-2">
                    {formatTime(room.lastTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-[#6B6560] truncate">
                    {room.lastSender
                      ? `${cleanSender(room.lastSender)}: ${room.lastMessage}`
                      : "아직 이야기가 없어요"}
                  </span>
                  <span className="text-[10px] text-[#6B6560] flex-shrink-0 ml-2">
                    {room.memberCount}명
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
