"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { WinnerTalkIcon } from "@/components/winner-talk-icon";
import { createChatRoomAction, deleteChatRoomAction, createClassRoomsAction } from "./actions";

interface Room {
  id: string;
  name: string | null;
  type: string;
  created_at: string;
  lastMessage: string;
  lastSender: string;
  lastTime: string;
  memberCount: number;
}

interface Message {
  id: string;
  sender_name: string;
  type: string;
  content: string | null;
  file_url: string | null;
  is_deleted: boolean;
  created_at: string;
}

interface Props {
  eventId: string;
  eventName: string;
  eventStartAt: string;
  eventEndAt: string;
  rooms: Room[];
  myName: string;
  isAdmin: boolean;
}

function getInitial(name: string) {
  return (name ?? "?").replace(/[📢💬🤝]\s*/, "").charAt(0);
}

function getColor(name: string) {
  const colors = ["bg-green-500", "bg-blue-500", "bg-orange-500", "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-red-500", "bg-yellow-500"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  }
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

function cleanName(name: string) {
  return name.replace(/^\[기관\]\s*/, "").replace(/^\[선생님[^\]]*\]\s*/, "");
}

function getSenderStyle(name: string, isMe: boolean) {
  if (name === "시스템") return { badge: "", bg: "", isSystem: true };
  if (name.includes("[기관]")) return { badge: "📢 기관", bg: "bg-violet-100", isSystem: false };
  if (name.includes("선생님")) return { badge: "👩‍🏫", bg: "bg-blue-50", isSystem: false };
  if (isMe) return { badge: "", bg: "bg-violet-100", isSystem: false };
  return { badge: "", bg: "bg-neutral-100", isSystem: false };
}

export function EventChatView({ eventId, eventName, eventStartAt, eventEndAt, rooms, myName, isAdmin }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(rooms[0]?.id ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pending, startTransition] = useTransition();
  const [classResult, setClassResult] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const selectedRoom = rooms.find((r) => r.id === selectedId);

  // 메시지 로드
  useEffect(() => {
    if (!selectedId) return;
    supabase.from("chat_messages")
      .select("id, sender_name, type, content, file_url, is_deleted, created_at")
      .eq("room_id", selectedId).order("created_at", { ascending: true }).limit(200)
      .then(({ data }) => setMessages(data ?? []));
  }, [selectedId, supabase]);

  // 실시간
  useEffect(() => {
    if (!selectedId) return;
    const ch = supabase.channel(`chat-event-${selectedId}`)
      .on("postgres_changes" as "system",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${selectedId}` } as unknown as { event: "system" },
        (payload: { new: Message }) => { setMessages((prev) => [...prev, payload.new]); }
      ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedId, supabase]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = (type: "TEXT" | "ANNOUNCEMENT" = "TEXT") => {
    if (!input.trim() || !selectedId) return;
    const content = input.trim();
    setInput("");
    startTransition(async () => {
      await supabase.from("chat_messages").insert({
        room_id: selectedId, sender_name: myName, type, content,
      });
    });
  };

  const handleDeleteRoom = (roomId: string) => {
    if (!confirm("이 톡방을 삭제하시겠습니까? 모든 메시지가 삭제됩니다.")) return;
    startTransition(async () => {
      try {
        await deleteChatRoomAction(eventId, roomId);
        if (selectedId === roomId) setSelectedId(rooms.find((r) => r.id !== roomId)?.id ?? null);
        window.location.reload();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : "삭제 실패");
      }
    });
  };

  const handleCreateClassRooms = () => {
    startTransition(async () => {
      try {
        const result = await createClassRoomsAction(eventId);
        setClassResult(result.message);
        setTimeout(() => window.location.reload(), 1000);
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : "생성 실패");
      }
    });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };
  const formatHM = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  let lastDate = "";

  // 방이 삭제 가능한지 (전체방, 공지방은 불가)
  const canDelete = (room: Room) =>
    room.name !== "💬 전체 단톡방" && room.type !== "ANNOUNCEMENT";

  return (
    <>
      <div className="flex h-[calc(100vh-120px)] overflow-hidden rounded-2xl border bg-white">
        {/* 좌측: 톡방 목록 */}
        <div className="w-72 flex-shrink-0 border-r flex flex-col">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <WinnerTalkIcon size={20} />
                <span className="font-bold text-sm">윙크톡</span>
              </div>
              <button onClick={() => setShowCreateModal(true)}
                className="rounded-lg bg-violet-600 px-2 py-1 text-xs font-semibold text-white hover:bg-violet-700">
                + 톡방
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {rooms.map((room) => (
              <div key={room.id} className="relative group">
                <button onClick={() => setSelectedId(room.id)}
                  className={`w-full flex items-start gap-2.5 p-3 text-left hover:bg-neutral-50
                    ${selectedId === room.id ? "bg-violet-50 border-l-2 border-violet-600" : ""}`}>
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white text-sm font-bold
                    ${room.type === "ANNOUNCEMENT" ? "bg-yellow-500" : getColor(room.name ?? "")}`}>
                    {room.type === "ANNOUNCEMENT" ? "📢" : getInitial(room.name ?? "?")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-sm truncate">{room.name}</span>
                      <span className="text-[10px] text-neutral-400 flex-shrink-0">{formatTime(room.lastTime)}</span>
                    </div>
                    <div className="text-xs text-neutral-500 truncate mt-0.5">
                      {room.lastSender
                        ? `${cleanName(room.lastSender)}: ${room.lastMessage}`
                        : "메시지 없음"}
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">{room.memberCount}명</div>
                  </div>
                </button>
                {canDelete(room) && (
                  <button onClick={() => handleDeleteRoom(room.id)}
                    className="absolute right-2 top-2 hidden group-hover:block text-neutral-400 hover:text-red-500 text-xs"
                    title="톡방 삭제">🗑</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 우측: 채팅 */}
        <div className="flex-1 flex flex-col">
          {selectedRoom ? (
            <>
              {/* 헤더 */}
              <div className="flex items-center justify-between border-b px-4 py-3 bg-violet-600 text-white">
                <div className="flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold
                    ${selectedRoom.type === "ANNOUNCEMENT" ? "bg-yellow-400 text-yellow-900" : "bg-white/20"}`}>
                    {selectedRoom.type === "ANNOUNCEMENT" ? "📢" : getInitial(selectedRoom.name ?? "")}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{selectedRoom.name}</div>
                    <div className="text-[10px] opacity-80">
                      {formatDate(eventStartAt)} {formatHM(eventStartAt)}~{formatHM(eventEndAt)} | {eventName}
                    </div>
                  </div>
                </div>
                <Link href={isAdmin ? `/admin/events/${eventId}` : `/manager/${eventId}`}
                  className="rounded-lg border border-white/30 px-3 py-1 text-xs hover:bg-white/10">
                  행사 상세
                </Link>
              </div>

              {/* 메시지 */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-neutral-50">
                {messages.map((msg) => {
                  const isMe = msg.sender_name === myName;
                  const style = getSenderStyle(msg.sender_name, isMe);
                  const name = cleanName(msg.sender_name);

                  const msgDate = new Date(msg.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
                  let dateHeader = null;
                  if (msgDate !== lastDate) { lastDate = msgDate; dateHeader = <div className="text-center text-xs text-neutral-400 py-2 my-1">{msgDate}</div>; }

                  if (style.isSystem || msg.is_deleted) {
                    return (
                      <div key={msg.id}>
                        {dateHeader}
                        <div className="text-center text-xs text-neutral-400 py-1 bg-neutral-100 rounded-full mx-12">
                          {msg.is_deleted ? "삭제된 메시지" : msg.content}
                        </div>
                      </div>
                    );
                  }

                  if (msg.type === "ANNOUNCEMENT") {
                    return (
                      <div key={msg.id}>
                        {dateHeader}
                        <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-3 my-1">
                          <div className="flex items-center gap-1 text-xs text-yellow-700 font-semibold mb-1">
                            🔔 시스템 알림
                          </div>
                          <p className="text-sm font-medium">{msg.content}</p>
                          <div className="text-[10px] text-neutral-400 mt-1">{formatTime(msg.created_at)}</div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id}>
                      {dateHeader}
                      <div className={`flex ${isMe ? "justify-end" : "justify-start"} gap-2`}>
                        {!isMe && (
                          <div className="flex flex-col items-start max-w-[70%]">
                            <div className="flex items-center gap-1 mb-0.5">
                              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${getColor(msg.sender_name)}`}>
                                {getInitial(msg.sender_name)}
                              </div>
                              {style.badge && <span className="rounded-full bg-violet-600 text-white px-1.5 py-0.5 text-[9px]">{style.badge}</span>}
                              <span className="text-xs font-medium">{name}</span>
                            </div>
                            <div className={`rounded-2xl rounded-tl-sm ${style.bg} px-3.5 py-2`}>
                              <p className="text-sm break-words">{msg.content}</p>
                            </div>
                            <span className="text-[10px] text-neutral-400 mt-0.5">{formatTime(msg.created_at)}</span>
                          </div>
                        )}
                        {isMe && (
                          <div className="flex flex-col items-end max-w-[70%]">
                            <div className="rounded-2xl rounded-tr-sm bg-violet-100 px-3.5 py-2">
                              <p className="text-sm break-words">{msg.content}</p>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] text-neutral-400">{formatTime(msg.created_at)}</span>
                              <span className="text-[10px] text-neutral-400">나</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* 입력 */}
              <div className="border-t bg-white px-4 py-3">
                <div className="flex items-center gap-2">
                  <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="메시지를 입력하세요..."
                    className="flex-1 rounded-2xl border px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
                  <button onClick={() => sendMessage()} disabled={pending || !input.trim()}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                    title="전송">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M2 21l21-9L2 3v7l15 2-15 2z" /></svg>
                  </button>
                  <button onClick={() => sendMessage("ANNOUNCEMENT")} disabled={pending || !input.trim()}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50"
                    title="공지로 보내기">📢</button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-neutral-400">
              <div className="text-center">
                <WinnerTalkIcon size={48} />
                <p className="mt-2">톡방을 선택하세요</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 톡방 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowCreateModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl mx-4"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">톡방 만들기</h2>

            {/* 학급별 자동 생성 */}
            <div className="rounded-xl border-2 border-dashed border-violet-300 bg-violet-50 p-4 mb-4">
              <h3 className="font-semibold text-sm mb-2">📚 학급별 자동 생성</h3>
              <p className="text-xs text-neutral-500 mb-3">
                등록명단의 [학급명]을 기반으로 학급별 톡방을 자동으로 만듭니다.
              </p>
              <button onClick={handleCreateClassRooms} disabled={pending}
                className="w-full rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
                {pending ? "생성 중..." : "학급별 톡방 자동 생성"}
              </button>
              {classResult && <p className="text-xs text-green-600 mt-2 text-center">{classResult}</p>}
            </div>

            {/* 수동 생성 */}
            <form action={async (formData: FormData) => {
              await createChatRoomAction(eventId, formData);
              setShowCreateModal(false);
              window.location.reload();
            }}>
              <h3 className="font-semibold text-sm mb-2">✏️ 수동 생성</h3>
              <input type="hidden" name="type" value="GROUP" />
              <input name="name" type="text" required placeholder="톡방 이름 (예: 💬 특별반)"
                className="w-full rounded-lg border px-3 py-2 text-sm mb-3" />
              <button type="submit" disabled={pending}
                className="w-full rounded-lg bg-neutral-800 py-2 text-sm font-semibold text-white hover:bg-neutral-900 disabled:opacity-50">
                톡방 만들기
              </button>
            </form>

            <button onClick={() => setShowCreateModal(false)}
              className="w-full mt-3 rounded-lg border py-2 text-sm hover:bg-neutral-50">
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
