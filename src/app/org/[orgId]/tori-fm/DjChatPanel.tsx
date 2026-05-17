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
  // 새 메시지 INSERT 시 카드 외곽 글로우 1.5초 — key 재마운트(무거움) 대신
  // className 토글 + onAnimationEnd 로 정리 (DOM 보존).
  const [flashing, setFlashing] = useState(false);
  const lastSentRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
          setFlashing(true);
        }) as never
      )
      .subscribe();
    return () => {
      void supa.removeChannel(ch);
    };
  }, [sessionId]);

  // FLASH_MS 는 CSS animation duration 과 의미적으로 매칭. 미사용 경고 회피.
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
      aria-label="라이브 채팅"
      onAnimationEnd={() => setFlashing(false)}
      className={`relative isolate flex h-full max-h-[640px] flex-col rounded-2xl border-l-[5px] border-l-sky-300/70 border-y border-y-white/10 border-r border-r-white/10 bg-sky-950/40 p-4 text-white shadow-md shadow-sky-500/10 md:p-5 ${
        flashing ? "flash-glow-sky" : ""
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

      {/* 채팅 스트림 — 참가자 컴포넌트 재활용. viewerRole='DJ' 로 본인(DJ) 메시지 우측 정렬.
          fillHeight 로 입력 박스 위 빈 공간 모두 채움. min-h-0 는 flex-1 안에서
          자식 overflow-y-auto 가 정상 동작하는 데 필수. */}
      <div className="min-h-0 flex-1">
        <LiveChatStream
          sessionId={sessionId}
          initialMessages={initialMessages}
          currentUserId={null}
          viewerRole="DJ"
          fillHeight
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
