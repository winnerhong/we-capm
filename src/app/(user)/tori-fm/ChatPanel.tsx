"use client";

// 토리FM 채팅 패널 — 세션별 실시간 채팅.
//  - Realtime: tori_fm_chat_messages WHERE session_id=? (INSERT/UPDATE 수신)
//  - 클라이언트 쓰로틀 2초, 300자 제한, 빈 메시지 차단.
//  - DJ 메시지는 황동 테두리 + 🎙 배지.
//  - is_deleted=true 는 회색 "🚫 삭제된 메시지" (UPDATE 수신 시 반영).
//  - 최대 50개 버퍼.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { sendChatMessageAction } from "@/lib/tori-fm/actions";
import type { FmChatMessageRow } from "@/lib/tori-fm/types";

const MAX_BUFFER = 50;
const THROTTLE_MS = 2000;
const MAX_MESSAGE_LEN = 300;

type Props = {
  sessionId: string;
  initialMessages: FmChatMessageRow[];
  userLabel: string;
  isUserLoggedIn: boolean;
};

function senderInitial(name: string): string {
  const t = (name || "?").trim();
  return t.length > 0 ? t[0].toUpperCase() : "?";
}

function timeLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ChatPanel({
  sessionId,
  initialMessages,
  userLabel,
  isUserLoggedIn,
}: Props) {
  const [messages, setMessages] = useState<FmChatMessageRow[]>(initialMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const lastSentRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 스크롤 to bottom on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Realtime 구독 — session_id 필터.
  useEffect(() => {
    if (!sessionId) return;
    const supa = createClient();

    type RealtimePayload = {
      eventType?: "INSERT" | "UPDATE" | "DELETE";
      new?: FmChatMessageRow;
      old?: FmChatMessageRow;
    };

    const handle = (payload: RealtimePayload) => {
      const row = payload.new;
      if (!row || !row.id) return;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === row.id);
        if (payload.eventType === "INSERT") {
          if (idx !== -1) return prev; // 중복 방지
          const next = [...prev, row];
          if (next.length > MAX_BUFFER) {
            return next.slice(next.length - MAX_BUFFER);
          }
          return next;
        }
        // UPDATE: 기존 교체 (is_deleted 반영용)
        if (idx === -1) return prev;
        const copy = prev.slice();
        copy[idx] = row;
        return copy;
      });
    };

    const channel = supa
      .channel(`tori-fm-chat-${sessionId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "tori_fm_chat_messages",
          filter: `session_id=eq.${sessionId}`,
        } as never,
        handle as never
      )
      .subscribe();

    return () => {
      supa.removeChannel(channel);
    };
  }, [sessionId]);

  const remaining = useMemo(
    () => MAX_MESSAGE_LEN - input.length,
    [input]
  );

  const handleSend = useCallback(() => {
    setError(null);
    const text = input.trim();
    if (!text) {
      setError("메시지를 입력해 주세요");
      return;
    }
    if (text.length > MAX_MESSAGE_LEN) {
      setError(`메시지는 ${MAX_MESSAGE_LEN}자까지만 보낼 수 있어요`);
      return;
    }
    const now = Date.now();
    if (now - lastSentRef.current < THROTTLE_MS) {
      setError("잠깐 쉬었다가 다시 보내 주세요");
      return;
    }
    lastSentRef.current = now;
    const payload = text;
    setInput("");
    startTransition(async () => {
      try {
        await sendChatMessageAction(sessionId, payload);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "전송에 실패했어요";
        setError(msg);
        setInput(payload); // 되살림
      }
    });
  }, [input, sessionId]);

  return (
    <section className="rounded-3xl border border-amber-500/20 bg-gradient-to-br from-[#1B2B3A] via-[#243548] to-[#1B2B3A] p-4 text-white shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-wide text-amber-200">
          💬 청취자 채팅
        </h3>
        {isUserLoggedIn && (
          <span className="text-[10px] text-white/50">{userLabel}</span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="mt-3 h-64 overflow-y-auto rounded-2xl bg-black/30 p-3 text-sm"
        role="log"
        aria-live="polite"
        aria-label="채팅 메시지"
      >
        {messages.length === 0 ? (
          <p className="py-8 text-center text-xs text-white/50">
            아직 메시지가 없어요. 첫 인사를 보내 보세요!
          </p>
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => {
              const isDj = m.sender_type === "DJ";
              const isSystem = m.sender_type === "SYSTEM";
              if (m.is_deleted) {
                return (
                  <li
                    key={m.id}
                    className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1 text-[11px] text-white/40"
                  >
                    🚫 삭제된 메시지
                  </li>
                );
              }
              return (
                <li
                  key={m.id}
                  className={`flex items-start gap-2 rounded-lg px-2 py-1.5 ${
                    isDj
                      ? "border border-amber-400/40 bg-amber-500/10"
                      : isSystem
                      ? "bg-white/5"
                      : "bg-white/5"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white ${
                      isDj
                        ? "bg-amber-500"
                        : isSystem
                        ? "bg-zinc-500"
                        : "bg-emerald-600"
                    }`}
                    aria-hidden
                  >
                    {senderInitial(m.sender_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`truncate text-[11px] font-semibold ${
                          isDj ? "text-amber-200" : "text-white/80"
                        }`}
                      >
                        {m.sender_name || "익명"}
                      </span>
                      {isDj && (
                        <span className="rounded bg-amber-400 px-1 text-[9px] font-bold text-[#1B2B3A]">
                          🎙 DJ
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-white/40">
                        {timeLabel(m.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-snug text-white/95">
                      {m.message}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {isUserLoggedIn ? (
        <div className="mt-3">
          <div className="flex items-end gap-2">
            <label htmlFor="fm-chat-input" className="sr-only">
              채팅 메시지 입력
            </label>
            <textarea
              id="fm-chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_MESSAGE_LEN))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="따뜻한 한마디를 남겨보세요"
              rows={1}
              maxLength={MAX_MESSAGE_LEN}
              className="min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-amber-300/60 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
              autoComplete="off"
              inputMode="text"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isPending || !input.trim()}
              className="min-h-[44px] rounded-xl bg-amber-400 px-4 text-sm font-bold text-[#1B2B3A] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "전송 중" : "전송"}
            </button>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px]">
            {error ? (
              <span className="text-rose-300" role="alert">
                {error}
              </span>
            ) : (
              <span className="text-white/40">Enter로 전송 · Shift+Enter 줄바꿈</span>
            )}
            <span
              className={remaining < 30 ? "text-amber-300" : "text-white/40"}
            >
              {remaining}자 남음
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-white/5 p-3 text-center text-xs text-white/60">
          채팅을 보내려면 로그인이 필요해요
        </p>
      )}
    </section>
  );
}
