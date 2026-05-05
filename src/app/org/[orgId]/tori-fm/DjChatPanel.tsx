"use client";

// DJ 채팅 패널 (기관 콘솔)
//   - 본문은 참가자 LiveChatStream 그대로 임포트해서 렌더 (호스트는 currentUserId=null)
//   - 그 아래 DJ 전용 입력 박스 (sendDjMessageAction 호출, 1초 throttle)
//   - 카드 톤: 글래스 (bg-white/[0.04] border-white/10 rounded-2xl)
//   - 헤더: "💬 라이브 채팅"

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { sendDjMessageAction } from "@/lib/tori-fm/actions";
import type { FmChatMessageRow } from "@/lib/tori-fm/types";
import { LiveChatStream } from "@/app/(user)/tori-fm/LiveChatStream";
import { createClient } from "@/lib/supabase/client";
import { SpotlightTriggerBar } from "./SpotlightTriggerBar";

interface Props {
  sessionId: string;
  initialMessages: FmChatMessageRow[];
  /**
   * SpotlightTriggerBar 통합 — 사연 풀스크린 트리거에 사용.
   * null/undefined 면 사연 트리거 버튼은 비활성, 다른 트리거는 그대로 작동.
   */
  currentStory?: {
    requestId?: string;
    songTitle: string | null;
    artist: string | null;
    story: string | null;
    childName: string | null;
    parentName: string | null;
  } | null;
}

const MAX_LEN = 300;
const THROTTLE_MS = 1_000;
const FLASH_MS = 1500;

export function DjChatPanel({ sessionId, initialMessages, currentStory = null }: Props) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [flashKey, setFlashKey] = useState(0);
  const lastSentRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Realtime — 새 채팅 INSERT 가 들어오면 카드 외곽에 sky 글로우 1.5초 발사
  useEffect(() => {
    if (!sessionId) return;
    const supa = createClient();
    const ch = supa
      .channel(`dj-chat-glow-${sessionId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "tori_fm_chat_messages",
          filter: `session_id=eq.${sessionId}`,
        } as never,
        (() => {
          setFlashKey((k) => k + 1);
        }) as never
      )
      .subscribe();
    return () => {
      void supa.removeChannel(ch);
    };
  }, [sessionId]);

  // flashKey 가 바뀌면 React 가 key prop 변화로 인해 카드를 재마운트 → animation 재생.
  // 1.5초 후 자동 종료는 CSS 의 `animation: ... forwards` 가 처리하므로 별도 cleanup 불필요.
  // FLASH_MS 는 상수 일관성 차원에서 보존.
  void FLASH_MS;

  const handleSend = useCallback(() => {
    setError(null);
    const text = input.trim();
    if (!text) return;
    if (text.length > MAX_LEN) {
      setError(`최대 ${MAX_LEN}자`);
      return;
    }
    const now = Date.now();
    if (now - lastSentRef.current < THROTTLE_MS) {
      setError("잠깐 쉬었다 보내 주세요");
      return;
    }
    lastSentRef.current = now;
    setInput("");
    startTransition(async () => {
      try {
        await sendDjMessageAction(sessionId, text);
      } catch (e) {
        setError(e instanceof Error ? e.message : "전송 실패");
        setInput(text);
      }
    });
  }, [input, sessionId]);

  return (
    <section
      key={flashKey}
      aria-label="라이브 채팅"
      className={`relative isolate flex h-full flex-col rounded-2xl border-l-[5px] border-l-sky-300/70 border-y border-y-white/10 border-r border-r-white/10 bg-sky-950/25 p-4 text-white shadow-xl shadow-sky-500/10 backdrop-blur-md transition-shadow duration-200 ease-out hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-sky-500/20 md:p-5 ${
        flashKey > 0 ? "flash-glow-sky" : ""
      }`}
    >
      {/* 외곽 글로우 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-1 -z-10 rounded-3xl bg-sky-500/[0.06] blur-2xl"
      />
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-sky-100">
          <span aria-hidden>💬</span>
          <span>라이브 채팅</span>
        </h2>
        <p className="hidden text-[11px] text-sky-200/70 sm:block">
          🎙 DJ로 보내면 전광판/앱에 즉시 반영
        </p>
      </header>

      {/* 전광판 스포트라이트 — 채팅 카드 안에 인라인 통합 (embedded 외관) */}
      <div className="mb-3">
        <SpotlightTriggerBar
          sessionId={sessionId}
          currentStory={
            currentStory
              ? {
                  requestId: currentStory.requestId ?? null,
                  songTitle: currentStory.songTitle,
                  artist: currentStory.artist,
                  story: currentStory.story,
                  childName: currentStory.childName,
                  parentName: currentStory.parentName,
                }
              : null
          }
          embedded
        />
      </div>

      {/* 채팅 스트림 — 참가자 컴포넌트 재활용. viewerRole='DJ' 로 본인(DJ) 메시지 우측 정렬. */}
      <div className="flex-1">
        <LiveChatStream
          sessionId={sessionId}
          initialMessages={initialMessages}
          currentUserId={null}
          viewerRole="DJ"
        />
      </div>

      {/* DJ 입력 박스 */}
      <div className="mt-3 space-y-1">
        {error && (
          <p className="px-3 text-[10px] font-semibold text-rose-300">
            ⚠ {error}
          </p>
        )}
        <div className="flex items-center gap-2 rounded-full border border-rose-300/30 bg-white/[0.06] p-1.5 pl-3 shadow-lg backdrop-blur-md">
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-rose-200 ring-1 ring-rose-400/40">
            <span aria-hidden>🎙</span>
            <span>DJ</span>
          </span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_LEN))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="DJ로 메시지 입력..."
            disabled={pending}
            maxLength={MAX_LEN}
            autoComplete="off"
            aria-label="DJ 메시지 입력"
            style={{
              backgroundColor: "transparent",
              color: "rgb(255, 255, 255)",
              WebkitTextFillColor: "rgb(255, 255, 255)",
              caretColor: "rgb(252, 211, 77)",
            }}
            className="min-w-0 flex-1 border-0 text-sm outline-none placeholder:text-white/45 disabled:opacity-50"
          />
          <span className="hidden font-mono text-[10px] tabular-nums text-white/40 sm:inline">
            {input.length}/{MAX_LEN}
          </span>
          <button
            type="button"
            onClick={handleSend}
            disabled={pending || !input.trim()}
            aria-label="전송"
            className="shrink-0 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-bold text-[#0B1538] shadow-md transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "..." : "전송"}
          </button>
        </div>
      </div>
    </section>
  );
}
