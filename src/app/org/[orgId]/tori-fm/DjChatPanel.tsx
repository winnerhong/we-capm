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
import { usePanelExpand, PanelExpandButton } from "./use-panel-expand";

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
  const { expanded, toggle, panelClassName } = usePanelExpand();

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
      className={`flex flex-col rounded-3xl border border-white/10 bg-gradient-to-br from-[#1B2B3A] via-[#26394C] to-[#1B2B3A] p-4 text-white shadow-xl md:p-5 ${panelClassName}`}
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-amber-100">
          <span aria-hidden>💬</span>
          <span>실시간 채팅</span>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-400/30">
            {visibleMessages.filter((m) => !m.is_deleted).length}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <p className="hidden text-[11px] text-amber-200/60 sm:block">
            DJ로 메시지를 보내면 전광판과 앱에 바로 떠요
          </p>
          <PanelExpandButton expanded={expanded} onToggle={toggle} tone="emerald" />
        </div>
      </header>

      <div
        ref={listRef}
        className={`overflow-y-auto rounded-2xl border border-white/5 bg-black/30 p-3 backdrop-blur-sm ${
          expanded ? "min-h-0 flex-1" : "max-h-72"
        }`}
      >
        {visibleMessages.length === 0 ? (
          <p className="py-6 text-center text-xs text-white/50">
            아직 메시지가 없어요. 먼저 인사해볼까요?
          </p>
        ) : (
          visibleMessages.map((m, idx) => {
            const isDj = m.sender_type === "DJ";
            const isSystem = m.sender_type === "SYSTEM";
            const isDeleted = m.is_deleted;
            const canDelete = !isDeleted && !isSystem;

            // 같은 발신자가 연속으로 보냈는지 — 헤더(이름/아바타) 생략
            const prev = visibleMessages[idx - 1];
            const isGrouped =
              !!prev &&
              !prev.is_deleted &&
              prev.sender_type === m.sender_type &&
              prev.user_id === m.user_id &&
              prev.sender_name === m.sender_name &&
              !isSystem;

            // 시스템 메시지 — 가운데 정렬 칩
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
                      {fmtTime(m.created_at)}
                    </time>
                  </div>
                </div>
              );
            }

            // 삭제된 메시지 — 가운데 정렬 작은 알림
            if (isDeleted) {
              return (
                <div
                  key={m.id}
                  className={`${isGrouped ? "mt-0.5" : "mt-3"} flex justify-center first:mt-0`}
                >
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-[11px] text-white/40">
                    <span aria-hidden>🚫</span>
                    <span>{m.sender_name}의 메시지가 삭제됨</span>
                  </div>
                </div>
              );
            }

            // DJ 메시지 — 우측 정렬, amber 말풍선
            if (isDj) {
              return (
                <div
                  key={m.id}
                  className={`${isGrouped ? "mt-0.5" : "mt-3"} flex justify-end gap-2 first:mt-0`}
                >
                  <div className="flex max-w-[75%] flex-col items-end">
                    {!isGrouped && (
                      <div className="mb-0.5 flex items-center gap-1.5 pr-1">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200 ring-1 ring-amber-400/40">
                          <span aria-hidden>🎙</span>
                          <span>DJ</span>
                        </span>
                        <span className="truncate text-[11px] font-semibold text-amber-200">
                          {m.sender_name}
                        </span>
                      </div>
                    )}
                    <div className="group/msg flex items-end gap-1.5">
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(m.id)}
                          disabled={deletePending && deletingId === m.id}
                          aria-label={`${m.sender_name} 메시지 숨기기`}
                          className="self-end rounded-md p-1 text-[11px] text-rose-300/0 opacity-0 transition group-hover/msg:opacity-100 hover:bg-rose-500/20 hover:text-rose-300 disabled:opacity-50"
                        >
                          {deletePending && deletingId === m.id ? "…" : "🗑"}
                        </button>
                      )}
                      <time className="shrink-0 pb-1 text-[10px] text-white/40">
                        {fmtTime(m.created_at)}
                      </time>
                      <div
                        className={`whitespace-pre-wrap break-words rounded-2xl bg-amber-400 px-3 py-2 text-[13px] font-medium text-[#1B2B3A] shadow-md shadow-amber-400/20 ${
                          isGrouped ? "rounded-tr-md" : "rounded-tr-md"
                        }`}
                      >
                        {m.message}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // USER 메시지 — 좌측 정렬, 다크 말풍선 + 아바타
            return (
              <div
                key={m.id}
                className={`${isGrouped ? "mt-0.5" : "mt-3"} flex gap-2 first:mt-0`}
              >
                <div className="flex w-8 shrink-0 justify-center pt-1">
                  {!isGrouped ? (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/40 to-sky-500/40 text-[11px] font-bold text-white ring-1 ring-white/10">
                      {(m.sender_name ?? "?").trim().charAt(0) || "?"}
                    </div>
                  ) : null}
                </div>
                <div className="flex max-w-[75%] flex-col items-start">
                  {!isGrouped && (
                    <span className="mb-0.5 truncate pl-1 text-[11px] font-semibold text-white/70">
                      {m.sender_name}
                    </span>
                  )}
                  <div className="group/msg flex items-end gap-1.5">
                    <div
                      className={`whitespace-pre-wrap break-words rounded-2xl bg-white/10 px-3 py-2 text-[13px] text-white shadow-sm ring-1 ring-white/10 ${
                        isGrouped ? "rounded-tl-md" : "rounded-tl-md"
                      }`}
                    >
                      {m.message}
                    </div>
                    <time className="shrink-0 pb-1 text-[10px] text-white/40">
                      {fmtTime(m.created_at)}
                    </time>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(m.id)}
                        disabled={deletePending && deletingId === m.id}
                        aria-label={`${m.sender_name} 메시지 숨기기`}
                        className="self-end rounded-md p-1 text-[11px] text-rose-300/0 opacity-0 transition group-hover/msg:opacity-100 hover:bg-rose-500/20 hover:text-rose-300 disabled:opacity-50"
                      >
                        {deletePending && deletingId === m.id ? "…" : "🗑"}
                      </button>
                    )}
                  </div>
                </div>
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
            className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/30"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            className="shrink-0 self-end rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-[#1B2B3A] shadow-md shadow-amber-400/30 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50 sm:self-stretch"
          >
            {sendPending
              ? "전송 중…"
              : throttleRemaining > 0
                ? `⏳ ${Math.ceil(throttleRemaining / 1000)}초`
                : "📤 전송"}
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-white/50">
          <span aria-live="polite" className="text-rose-300">
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
