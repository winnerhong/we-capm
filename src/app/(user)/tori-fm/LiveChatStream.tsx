"use client";

// 라이브 채팅 스트림 — "보이는 라디오" 안에서 메시지가 흘러가지 않고 화면에 머무름.
//   - Realtime 으로 새 메시지 들어오면 리스트에 push
//   - 최신 N개만 유지 (스크롤해서 옛 메시지 볼 수 있음)
//   - 스크린/유튜브 라이브 채팅 오버레이와 동일한 톤
//   - DriftUpChat (VFX) 와 별도 — DriftUpChat 은 시각적 효과, 이건 가독용 텍스트

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FmChatMessageRow } from "@/lib/tori-fm/types";

const MAX_VISIBLE = 30; // 메모리 상한 — 스크롤로 과거 메시지 접근

interface Props {
  sessionId: string;
  initialMessages?: FmChatMessageRow[];
  /** 현재 로그인 유저 — 본인 메시지 우측 배치(카톡 스타일). */
  currentUserId?: string | null;
}

export function LiveChatStream({
  sessionId,
  initialMessages = [],
  currentUserId = null,
}: Props) {
  const [messages, setMessages] = useState<FmChatMessageRow[]>(
    initialMessages.slice(-MAX_VISIBLE)
  );
  const listRef = useRef<HTMLDivElement | null>(null);

  // Realtime 구독 — INSERT/UPDATE 모두 처리 (UPDATE 는 is_deleted 반영용)
  useEffect(() => {
    if (!sessionId) return;
    const supa = createClient();

    type Payload = {
      eventType?: "INSERT" | "UPDATE" | "DELETE";
      new?: FmChatMessageRow;
      old?: FmChatMessageRow;
    };

    const handle = (payload: Payload) => {
      const row = payload.new;
      if (!row || !row.id) return;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === row.id);
        if (payload.eventType === "INSERT" || idx === -1) {
          if (row.is_deleted) return prev;
          const next = [...prev, row];
          return next.length > MAX_VISIBLE
            ? next.slice(next.length - MAX_VISIBLE)
            : next;
        }
        // UPDATE — 교체
        const copy = prev.slice();
        copy[idx] = row;
        return copy;
      });
    };

    const channel = supa
      .channel(`fm-stream-${sessionId}`)
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
      void supa.removeChannel(channel);
    };
  }, [sessionId]);

  // 새 메시지 들어오면 자동 스크롤 (가장 아래)
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const visible = messages.filter((m) => !m.is_deleted);

  if (visible.length === 0) {
    return (
      <div className="pointer-events-none rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 backdrop-blur-md">
        <p className="text-center text-[11px] text-white/55">
          💬 첫 인사를 남겨 보세요
        </p>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      style={{
        // Firefox 스크롤바
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.2) transparent",
      }}
      className="pointer-events-auto max-h-56 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 backdrop-blur-md sm:max-h-72
        [&::-webkit-scrollbar]:w-1.5
        [&::-webkit-scrollbar-track]:bg-transparent
        [&::-webkit-scrollbar-thumb]:rounded-full
        [&::-webkit-scrollbar-thumb]:bg-white/20
        hover:[&::-webkit-scrollbar-thumb]:bg-white/30"
      role="log"
      aria-live="polite"
      aria-label="실시간 청취자 채팅"
    >
      <ul className="space-y-0.5">
        {visible.map((m) => {
          const isDj = m.sender_type === "DJ";
          const isSystem = m.sender_type === "SYSTEM";
          const isMine =
            !!currentUserId && m.user_id === currentUserId && !isDj && !isSystem;

          if (isSystem) {
            return (
              <li
                key={m.id}
                className="flex justify-center py-0.5 text-[11px] text-sky-300/85"
              >
                <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 ring-1 ring-sky-400/25">
                  📢 {m.message}
                </span>
              </li>
            );
          }

          // 본인 메시지 — 우측 정렬, 볼드, 메시지만 (이름 생략, 색상으로 식별)
          if (isMine) {
            return (
              <li
                key={m.id}
                className="break-words text-right text-[13px] leading-relaxed"
              >
                <span className="font-bold text-emerald-200">{m.message}</span>
              </li>
            );
          }

          // 다른 사람 메시지 — 좌측 정렬, 인라인 [이름][메시지]
          const senderColor = isDj ? "text-rose-300" : "text-amber-200";
          const senderPrefix = isDj ? "🎙 " : "";

          return (
            <li
              key={m.id}
              className="break-words text-[13px] leading-relaxed"
            >
              <span className={`mr-1.5 font-bold ${senderColor}`}>
                {senderPrefix}
                {m.sender_name}
              </span>
              <span className="text-white/95">{m.message}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
