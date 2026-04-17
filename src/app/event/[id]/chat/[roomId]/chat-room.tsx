"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

interface Props {
  eventId: string;
  roomId: string;
  roomName: string;
  roomType: string;
  myName: string;
  initialMessages: Message[];
}

export function ChatRoom({ eventId, roomId, roomName, roomType, myName, initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [pending, startTransition] = useTransition();
  const [typing, setTyping] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${roomId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        const msg = payload.new as Message;
        setMessages((prev) => [...prev, msg]);
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "chat_messages",
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        const updated = payload.new as Message;
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const names = Object.values(state)
          .flat()
          .map((p) => (p as Record<string, string>).name ?? "")
          .filter((n) => n !== myName);
        setTyping(names);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ name: myName });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [roomId, myName, supabase]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const content = input.trim();
    setInput("");

    startTransition(async () => {
      await supabase.from("chat_messages").insert({
        room_id: roomId,
        sender_name: myName,
        type: "TEXT",
        content,
        reply_to_id: replyTo?.id ?? null,
      });
      setReplyTo(null);
    });
  };

  const sendFile = async (file: File) => {
    const path = `${roomId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("chat-files").upload(path, file);
    if (error) return;

    const isImage = file.type.startsWith("image/");
    await supabase.from("chat_messages").insert({
      room_id: roomId,
      sender_name: myName,
      type: isImage ? "IMAGE" : "FILE",
      content: isImage ? null : file.name,
      file_url: path,
      file_name: file.name,
    });
  };

  const deleteMessage = async (msgId: string) => {
    await supabase.from("chat_messages").update({ is_deleted: true, content: null }).eq("id", msgId);
  };

  const addReaction = async (msgId: string, emoji: string) => {
    await supabase.from("chat_reactions").upsert(
      { message_id: msgId, user_name: myName, emoji },
      { onConflict: "message_id,user_name,emoji" }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  const isAnnouncement = roomType === "ANNOUNCEMENT";

  return (
    <main className="flex h-dvh flex-col bg-white">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <Link href={`/event/${eventId}/chat`} className="text-lg">←</Link>
        <h1 className="font-bold">{roomName}</h1>
        <div className="w-6" />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => {
          const isMe = msg.sender_name === myName;
          const isSystem = msg.type === "SYSTEM";

          if (isSystem || msg.is_deleted) {
            return (
              <div key={msg.id} className="text-center text-xs text-neutral-400 py-1">
                {msg.is_deleted ? "삭제된 메시지" : msg.content}
              </div>
            );
          }

          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} gap-2`}>
              {!isMe && (
                <div className="flex flex-col items-start">
                  <span className="text-xs mb-1">{msg.sender_name}</span>
                  <div className="rounded-2xl rounded-tl-sm bg-neutral-100 px-4 py-2.5 max-w-[260px]">
                    {msg.reply_to_id && (
                      <div className="mb-1 border-l-2 border-violet-400 pl-2 text-xs text-neutral-500 truncate">
                        답장
                      </div>
                    )}
                    {msg.type === "IMAGE" && msg.file_url && (
                      <ImagePreview path={msg.file_url} />
                    )}
                    {msg.content && <p className="text-sm break-words">{msg.content}</p>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-neutral-400">{formatTime(msg.created_at)}</span>
                    <button onClick={() => setReplyTo(msg)} className="text-[11px] text-neutral-400 hover:text-violet-600">답장</button>
                    {EMOJIS.slice(0, 3).map((e) => (
                      <button key={e} onClick={() => addReaction(msg.id, e)} className="text-xs hover:scale-125">{e}</button>
                    ))}
                  </div>
                </div>
              )}
              {isMe && (
                <div className="flex flex-col items-end">
                  <div className="rounded-2xl rounded-tr-sm bg-violet-100 px-4 py-2.5 max-w-[260px]">
                    {msg.type === "IMAGE" && msg.file_url && (
                      <ImagePreview path={msg.file_url} />
                    )}
                    {msg.content && <p className="text-sm break-words">{msg.content}</p>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <button onClick={() => deleteMessage(msg.id)} className="text-[11px] text-neutral-400 hover:text-red-500">삭제</button>
                    <span className="text-[11px] text-neutral-400">{formatTime(msg.created_at)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {typing.length > 0 && (
          <div className="text-xs text-neutral-400 animate-pulse">
            {typing.join(", ")}님이 입력 중...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div className="border-t bg-neutral-50 px-4 py-2 flex items-center justify-between">
          <span className="text-xs truncate flex-1">↩ {replyTo.sender_name}: {replyTo.content}</span>
          <button onClick={() => setReplyTo(null)} className="text-xs ml-2">✕</button>
        </div>
      )}

      {!isAnnouncement && (
        <div className="border-t px-3 py-2 flex items-center gap-2">
          <label className="cursor-pointer text-lg">
            📎
            <input
              type="file"
              className="hidden"
              accept="image/*,application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) sendFile(f);
                e.target.value = "";
              }}
            />
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요"
            className="flex-1 rounded-2xl border px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            onClick={sendMessage}
            disabled={pending || !input.trim()}
            className="rounded-2xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            전송
          </button>
        </div>
      )}
    </main>
  );
}

function ImagePreview({ path }: { path: string }) {
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
