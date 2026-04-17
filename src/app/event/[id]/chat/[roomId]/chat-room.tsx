"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { WinnerTalkIcon } from "@/components/winner-talk-icon";

interface Message {
  id: string;
  sender_name: string;
  type: string;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  reply_to_id: string | null;
  is_deleted: boolean;
  created_at: string;
}

interface Props {
  eventId: string;
  roomId: string;
  roomName: string;
  roomType: string;
  myName: string;
  initialMessages: Message[];
  memberCount?: number;
}

function getSenderStyle(name: string, isMe: boolean) {
  if (name === "시스템") return { badge: "", bg: "", isSystem: true };
  if (name.includes("[기관]") || name.includes("기관")) return { badge: "📢 기관", bg: "bg-violet-100", isSystem: false };
  if (name.includes("선생님")) return { badge: "👩‍🏫 선생님", bg: "bg-blue-50", isSystem: false };
  if (isMe) return { badge: "", bg: "bg-violet-100", isSystem: false };
  return { badge: "", bg: "bg-neutral-100", isSystem: false };
}

function cleanName(name: string) {
  return name.replace(/^\[기관\]\s*/, "").replace(/^\[선생님[^\]]*\]\s*/, "");
}

export function ChatRoom({ eventId, roomId, roomName, roomType, myName, initialMessages, memberCount }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${roomId}`)
      .on("postgres_changes" as "system", {
        event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}`,
      } as unknown as { event: "system" }, (payload: { new: Message }) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, supabase]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const content = input.trim();
    setInput("");

    startTransition(async () => {
      await supabase.from("chat_messages").insert({
        room_id: roomId, sender_name: myName, type: "TEXT", content,
      });
    });
  };

  const sendFile = async (file: File) => {
    const path = `${roomId}/${Date.now()}_${file.name}`;
    await supabase.storage.from("chat-files").upload(path, file);
    const isImage = file.type.startsWith("image/");
    await supabase.from("chat_messages").insert({
      room_id: roomId, sender_name: myName,
      type: isImage ? "IMAGE" : "FILE",
      content: isImage ? null : file.name,
      file_url: path, file_name: file.name,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  let lastDate = "";

  return (
    <main className="flex h-dvh flex-col bg-white">
      {/* 헤더 */}
      <header className="flex items-center justify-between border-b px-4 py-3 bg-violet-600 text-white">
        <Link href={`/event/${eventId}`} className="text-lg">←</Link>
        <div className="flex items-center gap-2">
          <WinnerTalkIcon size={24} className="brightness-200" />
          <div className="text-center">
            <div className="font-bold">{roomName}</div>
            {memberCount !== undefined && <div className="text-xs opacity-80">{memberCount}명 참여</div>}
          </div>
        </div>
        <div className="w-6" />
      </header>

      {/* 메시지 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-neutral-50">
        {messages.map((msg) => {
          const isMe = msg.sender_name === myName;
          const style = getSenderStyle(msg.sender_name, isMe);
          const name = cleanName(msg.sender_name);

          // 날짜 구분선
          const msgDate = new Date(msg.created_at).toLocaleDateString("ko-KR");
          let dateHeader = null;
          if (msgDate !== lastDate) {
            lastDate = msgDate;
            dateHeader = <div className="text-center text-xs text-neutral-400 py-2">{msgDate}</div>;
          }

          // 시스템 메시지
          if (style.isSystem || msg.is_deleted) {
            return (
              <div key={msg.id}>
                {dateHeader}
                <div className="text-center text-xs text-neutral-400 py-1 bg-neutral-100 rounded-full mx-8 my-1">
                  {msg.is_deleted ? "삭제된 메시지" : msg.content}
                </div>
              </div>
            );
          }

          // 공지 메시지 (기관)
          if (msg.type === "ANNOUNCEMENT") {
            return (
              <div key={msg.id}>
                {dateHeader}
                <div className="rounded-xl bg-violet-50 border border-violet-200 p-3 my-1">
                  <div className="flex items-center gap-1 text-xs text-violet-600 font-semibold mb-1">
                    📢 공지
                  </div>
                  <p className="text-sm">{msg.content}</p>
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
                  <div className="flex flex-col items-start max-w-[75%]">
                    <div className="flex items-center gap-1 mb-0.5">
                      {style.badge && (
                        <span className="rounded-full bg-violet-600 text-white px-1.5 py-0.5 text-[10px]">{style.badge}</span>
                      )}
                      <span className="text-xs font-medium">{name}</span>
                    </div>
                    <div className={`rounded-2xl rounded-tl-sm ${style.bg} px-3.5 py-2`}>
                      {msg.type === "IMAGE" && msg.file_url && <ChatImage path={msg.file_url} />}
                      {msg.content && <p className="text-sm break-words">{msg.content}</p>}
                    </div>
                    <span className="text-[10px] text-neutral-400 mt-0.5">{formatTime(msg.created_at)}</span>
                  </div>
                )}
                {isMe && (
                  <div className="flex flex-col items-end max-w-[75%]">
                    <div className={`rounded-2xl rounded-tr-sm ${style.bg} px-3.5 py-2`}>
                      {msg.type === "IMAGE" && msg.file_url && <ChatImage path={msg.file_url} />}
                      {msg.content && <p className="text-sm break-words">{msg.content}</p>}
                    </div>
                    <span className="text-[10px] text-neutral-400 mt-0.5">{formatTime(msg.created_at)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 입력 */}
      <div className="border-t bg-white px-3 py-2 flex items-center gap-2">
        <label className="cursor-pointer text-lg">
          📷
          <input type="file" className="hidden" accept="image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) sendFile(f); e.target.value = ""; }} />
        </label>
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown} placeholder="메시지를 입력하세요"
          className="flex-1 rounded-2xl border px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
        <button onClick={sendMessage} disabled={pending || !input.trim()}
          className="rounded-2xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
          전송
        </button>
      </div>
    </main>
  );
}

function ChatImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string>("");
  const supabase = createClient();
  useEffect(() => {
    supabase.storage.from("chat-files").createSignedUrl(path, 3600).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl);
    });
  }, [path, supabase]);
  if (!url) return <div className="h-32 w-full animate-pulse rounded bg-neutral-200" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="max-h-48 rounded-lg" />;
}
