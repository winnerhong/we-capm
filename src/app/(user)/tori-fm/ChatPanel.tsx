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
  /** 현재 로그인 유저 ID — 내 메시지 식별용 (우측 배치) */
  userId?: string | null;
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
  userId = null,
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
          messages.map((m, idx) => {
            const isDj = m.sender_type === "DJ";
            const isSystem = m.sender_type === "SYSTEM";
            const isMine =
              !isDj &&
              !isSystem &&
              !!userId &&
              !!m.user_id &&
              m.user_id === userId;

            // 같은 발신자가 연속으로 보냈는지 — 헤더(이름/아바타) 생략
            const prev = messages[idx - 1];
            const isGrouped =
              !!prev &&
              !prev.is_deleted &&
              prev.sender_type === m.sender_type &&
              prev.user_id === m.user_id &&
              prev.sender_name === m.sender_name &&
              !isSystem;

            // 시스템 — 가운데 칩
            if (isSystem) {
              return (
                <div
                  key={m.id}
                  className={`${isGrouped ? "mt-0.5" : "mt-3"} flex justify-center first:mt-0`}
                >
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-3 py-1 text-[11px] text-sky-200 ring-1 ring-sky-400/30">
                    <span aria-hidden>📢</span>
                    <span>{m.message}</span>
                    <time className="text-sky-300/60">
                      {timeLabel(m.created_at)}
                    </time>
                  </div>
                </div>
              );
            }

            // 삭제된 메시지 — 가운데 작은 알림
            if (m.is_deleted) {
              return (
                <div
                  key={m.id}
                  className={`${isGrouped ? "mt-0.5" : "mt-3"} flex justify-center first:mt-0`}
                >
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-[11px] text-white/40">
                    <span aria-hidden>🚫</span>
                    <span>삭제된 메시지</span>
                  </div>
                </div>
              );
            }

            // 내 메시지 — 우측 정렬, amber 말풍선
            if (isMine) {
              return (
                <div
                  key={m.id}
                  className={`${isGrouped ? "mt-0.5" : "mt-3"} flex justify-end gap-2 first:mt-0`}
                >
                  <div className="flex max-w-[75%] flex-col items-end">
                    {!isGrouped && (
                      <span className="mb-0.5 truncate pr-1 text-[11px] font-semibold text-amber-200">
                        나
                      </span>
                    )}
                    <div className="flex items-end gap-1.5">
                      <time className="shrink-0 pb-1 text-[10px] text-white/40">
                        {timeLabel(m.created_at)}
                      </time>
                      <div className="whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-amber-400 px-3 py-2 text-[13px] font-medium text-[#1B2B3A] shadow-md shadow-amber-400/20">
                        {m.message}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // DJ 메시지 — 좌측, amber 톤 말풍선 + DJ 배지
            if (isDj) {
              return (
                <div
                  key={m.id}
                  className={`${isGrouped ? "mt-0.5" : "mt-3"} flex gap-2 first:mt-0`}
                >
                  <div className="flex w-8 shrink-0 justify-center pt-1">
                    {!isGrouped && (
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-[11px] font-bold text-[#1B2B3A] ring-2 ring-amber-300/40"
                        aria-hidden
                      >
                        🎙
                      </div>
                    )}
                  </div>
                  <div className="flex max-w-[75%] flex-col items-start">
                    {!isGrouped && (
                      <div className="mb-0.5 flex items-center gap-1.5 pl-1">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200 ring-1 ring-amber-400/40">
                          DJ
                        </span>
                        <span className="truncate text-[11px] font-semibold text-amber-200">
                          {m.sender_name || "DJ"}
                        </span>
                      </div>
                    )}
                    <div className="flex items-end gap-1.5">
                      <div className="whitespace-pre-wrap break-words rounded-2xl rounded-tl-md bg-amber-500/20 px-3 py-2 text-[13px] text-amber-50 shadow-sm ring-1 ring-amber-400/40">
                        {m.message}
                      </div>
                      <time className="shrink-0 pb-1 text-[10px] text-white/40">
                        {timeLabel(m.created_at)}
                      </time>
                    </div>
                  </div>
                </div>
              );
            }

            // 다른 청취자 — 좌측, 다크 말풍선 + 아바타
            return (
              <div
                key={m.id}
                className={`${isGrouped ? "mt-0.5" : "mt-3"} flex gap-2 first:mt-0`}
              >
                <div className="flex w-8 shrink-0 justify-center pt-1">
                  {!isGrouped && (
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/40 to-sky-500/40 text-[11px] font-bold text-white ring-1 ring-white/10"
                      aria-hidden
                    >
                      {senderInitial(m.sender_name)}
                    </div>
                  )}
                </div>
                <div className="flex max-w-[75%] flex-col items-start">
                  {!isGrouped && (
                    <span className="mb-0.5 truncate pl-1 text-[11px] font-semibold text-white/70">
                      {m.sender_name || "익명"}
                    </span>
                  )}
                  <div className="flex items-end gap-1.5">
                    <div className="whitespace-pre-wrap break-words rounded-2xl rounded-tl-md bg-white/10 px-3 py-2 text-[13px] text-white shadow-sm ring-1 ring-white/10">
                      {m.message}
                    </div>
                    <time className="shrink-0 pb-1 text-[10px] text-white/40">
                      {timeLabel(m.created_at)}
                    </time>
                  </div>
                </div>
              </div>
            );
          })
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
