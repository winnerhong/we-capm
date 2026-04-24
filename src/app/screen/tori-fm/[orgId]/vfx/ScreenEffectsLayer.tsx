"use client";

import { useEffect, useState } from "react";
import { FloatingHearts, type HeartEvent } from "./FloatingHearts";
import { DriftUpChat, type ChatBubble } from "./DriftUpChat";
import { TopBanner, type BannerEvent } from "./TopBanner";
import { EmojiRain, type EmojiRainEvent } from "./EmojiRain";
import { PollPopup, type PollEvent, type PollWinnerEvent } from "./PollPopup";
import { createClient } from "@/lib/supabase/client";
import type {
  FmChatMessageRow,
  FmPollOption,
  FmPollRow,
  FmReactionRow,
  FmRequestRow,
} from "@/lib/tori-fm/types";

interface Props {
  /** 디버그용 — 데모 버튼 표시 */
  showDemoControls?: boolean;
  /** 현재 라이브 세션 id — null/undefined면 Realtime 구독 skip */
  sessionId?: string | null;
}

/**
 * 전광판 VFX 오버레이 레이어.
 *  Phase A: FloatingHearts, DriftUpChat
 *  Phase B: TopBanner (신청곡), EmojiRain (이모지 비), PollPopup (투표)
 *  Phase C (this round): Supabase Realtime 구독 → DB 이벤트로 VFX 자동 trigger
 */
export function ScreenEffectsLayer({
  showDemoControls = false,
  sessionId = null,
}: Props) {
  const [hearts, setHearts] = useState<HeartEvent[]>([]);
  const [chats, setChats] = useState<ChatBubble[]>([]);
  const [banners, setBanners] = useState<BannerEvent[]>([]);
  const [emojis, setEmojis] = useState<EmojiRainEvent[]>([]);
  const [activePoll, setActivePoll] = useState<PollEvent | null>(null);
  const [winnerEvent, setWinnerEvent] = useState<PollWinnerEvent | null>(null);

  function emitHearts(count = 8, emoji?: string) {
    const now = Date.now();
    const next: HeartEvent[] = Array.from({ length: count }).map((_, i) => ({
      id: `h-${now}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      emoji,
    }));
    setHearts((prev) => [...prev, ...next].slice(-200));
  }

  function emitChat(b: Omit<ChatBubble, "id">) {
    const id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setChats((prev) => [...prev, { ...b, id }].slice(-50));
  }

  function emitBanner(b: Omit<BannerEvent, "id">) {
    const id = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setBanners((prev) => [...prev, { ...b, id }].slice(-20));
  }

  function emitEmojiRain(emoji: string, count = 20) {
    const now = Date.now();
    const next: EmojiRainEvent[] = Array.from({ length: count }).map((_, i) => ({
      id: `e-${now}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      emoji,
    }));
    setEmojis((prev) => [...prev, ...next].slice(-300));
  }

  function emitPoll(poll: PollEvent) {
    setActivePoll(poll);
  }

  function emitPollWinner(w: PollWinnerEvent) {
    setWinnerEvent({ ...w });
    // 재호출을 위해 살짝 딜레이 후 null 복원 (같은 pollId 재노출 방지는 pollId 비교로)
  }

  /* ------------------------------------------------------------------------ */
  /* Realtime 구독 — sessionId 기준 4개 채널                                   */
  /* ------------------------------------------------------------------------ */

  // 1) tori_fm_reactions INSERT → emitHearts
  useEffect(() => {
    if (!sessionId) return;
    const supa = createClient();

    type RealtimePayload = {
      eventType?: "INSERT" | "UPDATE" | "DELETE";
      new?: FmReactionRow;
      old?: FmReactionRow;
    };

    const handle = (payload: RealtimePayload) => {
      const row = payload.new;
      if (!row || !row.id) return;
      const emoji = row.emoji;
      if (!emoji) return;
      // 하트/이모지 반응 — 한 번에 하나씩 원자적으로 띄움
      emitHearts(1, emoji);
    };

    const channel = supa
      .channel(`tori-fm-screen-reactions-${sessionId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "tori_fm_reactions",
          filter: `session_id=eq.${sessionId}`,
        } as never,
        handle as never
      )
      .subscribe();

    return () => {
      supa.removeChannel(channel);
    };
  }, [sessionId]);

  // 2) tori_fm_chat_messages INSERT → emitChat
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
      if (row.is_deleted === true) return;
      emitChat({
        senderName: row.sender_name || "익명",
        message: row.message,
        isDJ: row.sender_type === "DJ",
      });
    };

    const channel = supa
      .channel(`tori-fm-screen-chat-${sessionId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
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

  // 3) tori_fm_requests UPDATE → emitBanner (PLAYED 전이 시)
  useEffect(() => {
    if (!sessionId) return;
    const supa = createClient();

    type RealtimePayload = {
      eventType?: "INSERT" | "UPDATE" | "DELETE";
      new?: FmRequestRow;
      old?: FmRequestRow;
    };

    const handle = (payload: RealtimePayload) => {
      const row = payload.new;
      if (!row || !row.id) return;
      const oldStatus = payload.old?.status;
      if (oldStatus === "PLAYED") return;
      if (row.status !== "PLAYED") return;
      const subtitle =
        (row.song_title || "") +
        (row.artist ? ` - ${row.artist}` : "");
      emitBanner({
        title: "🎵 NOW PLAYING",
        subtitle,
        caption: row.child_name
          ? `${row.child_name} 친구가 신청한 사연이에요`
          : "",
      });
    };

    const channel = supa
      .channel(`tori-fm-screen-requests-${sessionId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "UPDATE",
          schema: "public",
          table: "tori_fm_requests",
          filter: `session_id=eq.${sessionId}`,
        } as never,
        handle as never
      )
      .subscribe();

    return () => {
      supa.removeChannel(channel);
    };
  }, [sessionId]);

  // 4) tori_fm_polls INSERT/UPDATE → emitPoll / emitPollWinner
  useEffect(() => {
    if (!sessionId) return;
    const supa = createClient();

    type RealtimePayload = {
      eventType?: "INSERT" | "UPDATE" | "DELETE";
      new?: FmPollRow;
      old?: FmPollRow;
    };

    const parseOptions = (raw: unknown): FmPollOption[] => {
      if (!Array.isArray(raw)) return [];
      const list: FmPollOption[] = [];
      for (const item of raw) {
        if (
          item &&
          typeof item === "object" &&
          typeof (item as { id?: unknown }).id === "string" &&
          typeof (item as { label?: unknown }).label === "string"
        ) {
          const o = item as { id: string; label: string; votes?: unknown };
          list.push({
            id: o.id,
            label: o.label,
            votes: typeof o.votes === "number" ? o.votes : 0,
          });
        }
      }
      return list;
    };

    const handle = (payload: RealtimePayload) => {
      const row = payload.new;
      if (!row || !row.id) return;
      const evt = payload.eventType;

      if (evt === "INSERT") {
        if (row.status !== "ACTIVE") return;
        emitPoll({
          id: row.id,
          question: row.question,
          options: parseOptions(row.options),
          durationSec: row.duration_sec,
          startedAt: row.starts_at,
        });
        return;
      }

      if (evt === "UPDATE") {
        const oldStatus = payload.old?.status;
        if (
          oldStatus === "ACTIVE" &&
          row.status === "ENDED" &&
          row.winner_option_id
        ) {
          const options = parseOptions(row.options);
          const winner = options.find((o) => o.id === row.winner_option_id);
          if (winner) {
            emitPollWinner({ pollId: row.id, winnerLabel: winner.label });
          }
        }
        // 투표 count 변경 등 기타 UPDATE는 skip (다음 라운드 숙제)
      }
    };

    const channel = supa
      .channel(`tori-fm-screen-polls-${sessionId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "tori_fm_polls",
          filter: `session_id=eq.${sessionId}`,
        } as never,
        handle as never
      )
      .on(
        "postgres_changes" as never,
        {
          event: "UPDATE",
          schema: "public",
          table: "tori_fm_polls",
          filter: `session_id=eq.${sessionId}`,
        } as never,
        handle as never
      )
      .subscribe();

    return () => {
      supa.removeChannel(channel);
    };
  }, [sessionId]);

  return (
    <>
      <FloatingHearts events={hearts} />
      <DriftUpChat messages={chats} />
      <TopBanner events={banners} />
      <EmojiRain events={emojis} />
      <PollPopup activePoll={activePoll} winnerEvent={winnerEvent} />

      {showDemoControls && (
        <div
          className="pointer-events-auto fixed bottom-6 right-6 z-50 flex max-w-[90vw] flex-wrap gap-2 rounded-2xl border border-[#3a2f27] bg-black/70 p-3 text-[11px] text-[#C4956A] backdrop-blur"
          aria-label="VFX 데모 컨트롤"
        >
          <span className="mr-1 self-center text-[10px] uppercase tracking-widest text-[#8A8A8A]">
            🧪 VFX 데모
          </span>
          <button
            type="button"
            onClick={() => emitHearts(8)}
            className="rounded-lg bg-rose-500 px-2.5 py-1 font-bold text-white hover:bg-rose-600"
          >
            ❤ ×8
          </button>
          <button
            type="button"
            onClick={() => emitHearts(30)}
            className="rounded-lg bg-rose-600 px-2.5 py-1 font-bold text-white hover:bg-rose-700"
          >
            🔥 폭주 ×30
          </button>
          <button
            type="button"
            onClick={() => emitHearts(10, "👏")}
            className="rounded-lg bg-amber-500 px-2.5 py-1 font-bold text-white hover:bg-amber-600"
          >
            👏 ×10
          </button>
          <button
            type="button"
            onClick={() => emitHearts(10, "🎉")}
            className="rounded-lg bg-sky-500 px-2.5 py-1 font-bold text-white hover:bg-sky-600"
          >
            🎉 ×10
          </button>
          <button
            type="button"
            onClick={() =>
              emitChat({
                senderName: "박엄마",
                message: "아이유 신청곡 기대돼요!",
              })
            }
            className="rounded-lg border border-[#C4956A]/40 bg-[#0f0a07] px-2.5 py-1 font-bold text-[#C4956A] hover:bg-[#1a1410]"
          >
            💬 유저
          </button>
          <button
            type="button"
            onClick={() =>
              emitChat({
                senderName: "DJ 토리",
                message: "다음 곡 바로 틀어드릴게요 🎵",
                isDJ: true,
              })
            }
            className="rounded-lg border border-[#D4A15A] bg-[#2a1f15] px-2.5 py-1 font-bold text-[#E5B88A] hover:bg-[#3a2f27]"
          >
            🎙 DJ
          </button>
          <button
            type="button"
            onClick={() =>
              emitBanner({
                title: "🎵 NOW PLAYING",
                subtitle: "아이유 - 가을 아침",
                caption: "김토리 가족이 신청한 사연이에요",
              })
            }
            className="rounded-lg border border-[#E5B88A] bg-gradient-to-r from-[#C4956A] to-[#E5B88A] px-2.5 py-1 font-bold text-[#1a120a] hover:brightness-110"
          >
            📢 배너
          </button>
          <button
            type="button"
            onClick={() => emitEmojiRain("🎉", 25)}
            className="rounded-lg bg-fuchsia-500 px-2.5 py-1 font-bold text-white hover:bg-fuchsia-600"
          >
            🌧 이모지비
          </button>
          <button
            type="button"
            onClick={() =>
              emitPoll({
                id: `demo-${Date.now()}`,
                question: "가장 좋았던 곡은?",
                options: [
                  { id: "a", label: "아이유 - 가을 아침", votes: 5 },
                  { id: "b", label: "폴킴 - 비", votes: 3 },
                  { id: "c", label: "김광석 - 서른 즈음에", votes: 2 },
                ],
                durationSec: 60,
                startedAt: new Date().toISOString(),
              })
            }
            className="rounded-lg bg-emerald-500 px-2.5 py-1 font-bold text-white hover:bg-emerald-600"
          >
            📊 투표
          </button>
          <button
            type="button"
            onClick={() =>
              emitPollWinner({
                pollId: activePoll?.id ?? "demo",
                winnerLabel: "아이유 - 가을 아침",
              })
            }
            className="rounded-lg bg-yellow-500 px-2.5 py-1 font-bold text-[#1a120a] hover:bg-yellow-400"
          >
            🏆 결과
          </button>
        </div>
      )}
    </>
  );
}
