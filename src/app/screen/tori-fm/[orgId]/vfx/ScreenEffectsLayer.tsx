"use client";

import { useEffect, useState } from "react";
import { FloatingHearts, type HeartEvent } from "./FloatingHearts";
import { DriftUpChat, type ChatBubble } from "./DriftUpChat";
import { TopBanner, type BannerEvent } from "./TopBanner";
import { EmojiRain, type EmojiRainEvent } from "./EmojiRain";
import { StorySpotlight, type StorySpotlightEvent } from "./StorySpotlight";
import { createClient } from "@/lib/supabase/client";
import type {
  FmChatMessageRow,
  FmReactionRow,
  FmRequestRow,
} from "@/lib/tori-fm/types";
import type {
  FmSpotlightEventRow,
  SpotlightKind,
} from "@/lib/tori-fm/spotlight";

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
  const [storySpotlight, setStorySpotlight] =
    useState<StorySpotlightEvent | null>(null);

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

  // 4) fm_spotlight_events INSERT → kind 별 emit 분배
  //    DJ 콘솔의 SpotlightTriggerBar 가 트리거한 이벤트 수신.
  useEffect(() => {
    if (!sessionId) return;
    const supa = createClient();

    type RealtimePayload = {
      eventType?: "INSERT" | "UPDATE" | "DELETE";
      new?: FmSpotlightEventRow;
      old?: FmSpotlightEventRow;
    };

    const handle = (payload: RealtimePayload) => {
      const row = payload.new;
      if (!row || !row.id) return;
      // dismiss 된 row 는 무시 (overwrite 시 INSERT 직전에 기존 row 가 dismiss 되지만 신규 row 는 dismissed_at NULL 로 들어옴)
      if (row.dismissed_at) return;

      const kind: SpotlightKind = row.kind;
      const p = (row.payload_json ?? {}) as Record<string, unknown>;

      switch (kind) {
        case "HEART_RAIN": {
          const intensity =
            typeof p.intensity === "string" ? p.intensity : "high";
          emitHearts(intensity === "high" ? 40 : 15, "❤");
          break;
        }
        case "EMOJI_RAIN": {
          const emoji = typeof p.emoji === "string" ? p.emoji : "🌲";
          emitEmojiRain(emoji, 30);
          break;
        }
        case "BANNER": {
          const text = typeof p.text === "string" ? p.text : "";
          if (text) {
            emitBanner({
              title: "🎉 응원",
              subtitle: text,
              caption: "",
            });
          }
          break;
        }
        case "STORY": {
          const songTitle =
            typeof p.song_title === "string" ? p.song_title : "";
          const artist = typeof p.artist === "string" ? p.artist : "";
          const story = typeof p.story === "string" ? p.story : "";
          const childName =
            typeof p.child_name === "string" ? p.child_name : "";
          const parentName =
            typeof p.parent_name === "string" ? p.parent_name : "";
          // expires_at 까지 노출 (default 30초)
          const expiresMs = row.expires_at
            ? new Date(row.expires_at).getTime()
            : Date.now() + 30_000;
          setStorySpotlight({
            id: row.id,
            songTitle,
            artist,
            story,
            childName,
            parentName,
            expiresAtMs: expiresMs,
          });
          break;
        }
      }
    };

    const channel = supa
      .channel(`tori-fm-screen-spotlight-${sessionId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "fm_spotlight_events",
          filter: `session_id=eq.${sessionId}`,
        } as never,
        handle as never
      )
      .subscribe();

    return () => {
      supa.removeChannel(channel);
    };
  }, [sessionId]);

  // STORY 자동 종료 타이머
  useEffect(() => {
    if (!storySpotlight) return;
    const remain = storySpotlight.expiresAtMs - Date.now();
    if (remain <= 0) {
      setStorySpotlight(null);
      return;
    }
    const t = setTimeout(() => setStorySpotlight(null), remain);
    return () => clearTimeout(t);
  }, [storySpotlight]);

  return (
    <>
      <FloatingHearts events={hearts} />
      <DriftUpChat messages={chats} />
      <TopBanner events={banners} />
      <EmojiRain events={emojis} />
      <StorySpotlight event={storySpotlight} />

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
        </div>
      )}
    </>
  );
}
