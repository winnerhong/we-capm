"use client";

// 라이브 채팅용 미니 컴포저 — "보이는 라디오" 하단에 항상 노출.
//   - 입력창 + 전송 버튼 + ♡ 좋아요 버튼
//   - 메시지는 sendChatMessageAction 으로 즉시 전송 (DB → Realtime → DriftUpChat)
//   - ♡ 는 sendReactionAction 으로 하트 비 트리거
//   - 채팅 히스토리는 보여주지 않음 (DriftUpChat 가 스트림 형태로 처리)

import { useCallback, useRef, useState, useTransition } from "react";
import {
  sendChatMessageAction,
  sendReactionAction,
} from "@/lib/tori-fm/actions";

const MAX_LEN = 300;
const THROTTLE_MS = 2_000;

interface Props {
  sessionId: string;
  isLive: boolean;
}

export function LiveChatComposer({ sessionId, isLive }: Props) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const lastSentRef = useRef(0);
  const lastHeartRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
        await sendChatMessageAction(sessionId, text);
      } catch (e) {
        setError(e instanceof Error ? e.message : "전송 실패");
        setInput(text);
      }
    });
  }, [input, sessionId]);

  const handleHeart = useCallback(() => {
    if (!isLive) return;
    const now = Date.now();
    if (now - lastHeartRef.current < 400) return;
    lastHeartRef.current = now;
    void sendReactionAction(sessionId, "❤").catch(() => {
      /* silent */
    });
  }, [isLive, sessionId]);

  return (
    <div className="pointer-events-auto">
      {error && (
        <p className="mb-1 px-3 text-[10px] font-semibold text-rose-300 drop-shadow">
          ⚠ {error}
        </p>
      )}
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] p-1.5 pl-4 shadow-lg backdrop-blur-md">
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
          placeholder={isLive ? "메시지 입력..." : "방송 시작 후 채팅 가능"}
          disabled={!isLive || pending}
          maxLength={MAX_LEN}
          autoComplete="off"
          autoCorrect="off"
          aria-label="채팅 메시지 입력"
          // 인라인 스타일로 색상을 강제 — 모바일 브라우저의 -webkit-text-fill-color
          // (autofill 노란 배경 / 다크모드 강제 텍스트 색) 가 Tailwind text-white 를 덮어쓰는 케이스 방어.
          style={{
            backgroundColor: "transparent",
            color: "rgb(255, 255, 255)",
            WebkitTextFillColor: "rgb(255, 255, 255)",
            caretColor: "rgb(252, 211, 77)",
          }}
          className="min-w-0 flex-1 border-0 text-sm outline-none placeholder:text-white/45 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!isLive || pending || !input.trim()}
          aria-label="전송"
          className="shrink-0 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-bold text-[#1B2B3A] shadow-md transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "..." : "전송"}
        </button>
        <button
          type="button"
          onClick={handleHeart}
          disabled={!isLive}
          aria-label="좋아요 보내기"
          className="shrink-0 rounded-full bg-rose-500 px-2.5 py-1.5 text-base font-bold text-white shadow-md transition hover:scale-110 hover:bg-rose-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ♥
        </button>
      </div>
    </div>
  );
}
