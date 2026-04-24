"use client";

// DJ 채팅 패널 (기관 관점)
//  - 세션의 채팅 메시지 리스트 (오래된 → 최신 아래)
//  - DJ 입력창으로 sendDjMessageAction 호출 (2초 throttle)
//  - 각 유저 메시지에 삭제 버튼 (soft delete)
//  - Realtime: tori_fm_chat_messages session_id=? 구독
//  - Forest palette — LIVE 패널과 분리된 컨트롤룸 카드

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  sendDjMessageAction,
  deleteChatMessageAction,
} from "@/lib/tori-fm/actions";
import type { FmChatMessageRow } from "@/lib/tori-fm/types";

interface Props {
  sessionId: string;
  initialMessages: FmChatMessageRow[];
}

const THROTTLE_MS = 2000;
const MAX_LEN = 300;

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DjChatPanel({ sessionId, initialMessages }: Props) {
  const [messages, setMessages] = useState<FmChatMessageRow[]>(initialMessages);
  const [input, setInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number>(0);
  const [sendPending, startSendTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Realtime 구독
  useEffect(() => {
    if (!sessionId) return;
    const supa = createClient();

    const ch = supa
      .channel(`dj-chat-${sessionId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "tori_fm_chat_messages",
          filter: `session_id=eq.${sessionId}`,
        } as never,
        ((payload: { new: FmChatMessageRow }) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }) as never
      )
      .on(
        "postgres_changes" as never,
        {
          event: "UPDATE",
          schema: "public",
          table: "tori_fm_chat_messages",
          filter: `session_id=eq.${sessionId}`,
        } as never,
        ((payload: { new: FmChatMessageRow }) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === payload.new.id ? payload.new : m))
          );
        }) as never
      )
      .subscribe();

    return () => {
      supa.removeChannel(ch);
    };
  }, [sessionId]);

  // 스크롤을 아래로
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const now = Date.now();
  const throttleRemaining = Math.max(0, lastSentAt + THROTTLE_MS - now);
  const canSend =
    !sendPending && input.trim().length > 0 && throttleRemaining === 0;

  const [throttleNow, setThrottleNow] = useState<number>(now);
  useEffect(() => {
    if (throttleRemaining === 0) return;
    const t = setInterval(() => setThrottleNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [throttleRemaining]);
  void throttleNow;

  const onSend = useCallback(() => {
    setErr(null);
    const text = input.trim();
    if (!text) return;
    if (text.length > MAX_LEN) {
      setErr(`메시지는 ${MAX_LEN}자까지만 보낼 수 있어요`);
      return;
    }
    if (Date.now() - lastSentAt < THROTTLE_MS) return;

    startSendTransition(async () => {
      try {
        await sendDjMessageAction(sessionId, text);
        setInput("");
        setLastSentAt(Date.now());
      } catch (e) {
        setErr(e instanceof Error ? e.message : "전송에 실패했어요");
      }
    });
  }, [input, lastSentAt, sessionId]);

  const onDelete = useCallback((messageId: string) => {
    const ok = window.confirm(
      "이 메시지를 숨길까요? 전광판과 앱에서 사라져요."
    );
    if (!ok) return;
    setDeletingId(messageId);
    startDeleteTransition(async () => {
      try {
        await deleteChatMessageAction(messageId);
        // Realtime UPDATE 가 is_deleted 반영을 처리하므로 별도 setMessages 불필요
      } catch (e) {
        alert(e instanceof Error ? e.message : "숨기기에 실패했어요");
      } finally {
        setDeletingId(null);
      }
    });
  }, []);

  const visibleMessages = useMemo(() => messages, [messages]);

  return (
    <section
      aria-label="DJ 채팅 패널"
      className="rounded-3xl border border-[#D4E4BC] bg-white p-4 shadow-sm md:p-5"
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span aria-hidden>💬</span>
          <span>실시간 채팅</span>
          <span className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
            {visibleMessages.filter((m) => !m.is_deleted).length}
          </span>
        </h2>
        <p className="text-[11px] text-[#8B7F75]">
          DJ로 메시지를 보내면 전광판과 앱에 바로 떠요
        </p>
      </header>

      <div
        ref={listRef}
        className="max-h-72 space-y-2 overflow-y-auto rounded-2xl bg-[#F9F7F2] p-3"
      >
        {visibleMessages.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#8B7F75]">
            아직 메시지가 없어요. 먼저 인사해볼까요?
          </p>
        ) : (
          visibleMessages.map((m) => {
            const isDj = m.sender_type === "DJ";
            const isSystem = m.sender_type === "SYSTEM";
            const isDeleted = m.is_deleted;
            const canDelete = !isDeleted && !isSystem;

            if (isDeleted) {
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-1.5 text-[11px] text-zinc-500"
                >
                  <span aria-hidden>🚫</span>
                  <span className="font-semibold">{m.sender_name}</span>
                  <span>의 메시지가 삭제되었어요</span>
                  <time className="ml-auto text-[10px] text-zinc-400">
                    {fmtTime(m.created_at)}
                  </time>
                </div>
              );
            }

            return (
              <div
                key={m.id}
                className={`flex gap-2 rounded-xl px-3 py-2 text-sm shadow-sm ${
                  isDj
                    ? "border-2 border-amber-400 bg-amber-50"
                    : isSystem
                      ? "border border-sky-200 bg-sky-50"
                      : "border border-[#E5E0D3] bg-white"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        isDj
                          ? "bg-amber-500 text-white"
                          : isSystem
                            ? "bg-sky-500 text-white"
                            : "bg-[#E8F0E4] text-[#2D5A3D]"
                      }`}
                    >
                      {isDj ? "🎙 DJ" : isSystem ? "📢" : "👤"}
                    </span>
                    <span
                      className={`truncate text-[12px] font-semibold ${
                        isDj ? "text-amber-800" : "text-[#2D5A3D]"
                      }`}
                    >
                      {m.sender_name}
                    </span>
                    <time className="ml-auto shrink-0 text-[10px] text-[#8B7F75]">
                      {fmtTime(m.created_at)}
                    </time>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] text-[#2B2925]">
                    {m.message}
                  </p>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(m.id)}
                    disabled={deletePending && deletingId === m.id}
                    aria-label={`${m.sender_name} 메시지 숨기기`}
                    className="self-start rounded-lg p-1 text-xs text-rose-500 transition hover:bg-rose-50 disabled:opacity-50"
                  >
                    {deletePending && deletingId === m.id ? "…" : "🗑"}
                  </button>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="DJ 메시지를 입력하세요 (Enter 로 전송, Shift+Enter 줄바꿈)"
            maxLength={MAX_LEN}
            rows={2}
            aria-label="DJ 메시지"
            className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm text-[#2B2925] outline-none placeholder:text-[#8B7F75] focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            className="shrink-0 self-end rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#234A31] disabled:cursor-not-allowed disabled:opacity-50 sm:self-stretch"
          >
            {sendPending
              ? "전송 중…"
              : throttleRemaining > 0
                ? `⏳ ${Math.ceil(throttleRemaining / 1000)}초`
                : "📤 전송"}
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-[#8B7F75]">
          <span aria-live="polite" className="text-rose-600">
            {err ?? " "}
          </span>
          <span className="tabular-nums">
            {input.length} / {MAX_LEN}
          </span>
        </div>
      </div>
    </section>
  );
}
