"use client";

import { useEffect, useRef, useState, useTransition } from "react";

type Role = "tori" | "user";
interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
}

interface ToriContext {
  acorns: number;
  completedMissions: number;
  tier: string;
  nextMissionTitle: string | null;
  eventName: string;
}

const SUGGESTIONS = [
  "🎯 오늘 뭐할까?",
  "🗺️ 근처 숲길 추천해줘",
  "🌰 도토리 어떻게 모아?",
  "🏆 내 순위 어때?",
];

function getToriResponse(message: string, context: ToriContext): string {
  const msg = message.trim();
  if (msg.includes("오늘")) {
    return `오늘은 도토리 ${context.acorns}개를 모으셨어요! 🌰 조금만 더 하면 다음 나무로 자랄 거예요 🌱`;
  }
  if (msg.includes("추천")) {
    const next = context.nextMissionTitle;
    if (next) {
      return `제가 이 행사에서 추천하는 첫 숲길은… 바로 "${next}" 이에요! 🎯`;
    }
    return "이번 행사의 모든 숲길을 걸었어요! 🏞️ 결과 발표를 기다려봐요.";
  }
  if (msg.includes("도토리")) {
    return "도토리는 숲길을 걸을 때마다 모아져요! 숲길 카드에서 '지금 하기'를 눌러보세요 🌰";
  }
  if (msg.includes("순위") || msg.includes("랭킹") || msg.includes("등수")) {
    return `지금 ${context.tier} 단계예요! 명예의 전당에서 확인해보세요 🏆`;
  }
  if (msg.includes("안녕") || msg.includes("하이") || msg.includes("hi")) {
    return `안녕하세요! 저는 ${context.eventName} 숲의 길잡이 토리예요 🐿️`;
  }
  return "오늘도 즐거운 숲길 되세요! 🌿 저는 여러분의 숲길을 응원하고 있어요.";
}

const STORAGE_KEY_PREFIX = "tori-chat:";

export function ToriChat({
  eventId,
  context,
}: {
  eventId: string;
  context: ToriContext;
}) {
  const storageKey = `${STORAGE_KEY_PREFIX}${eventId}`;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [, startTransition] = useTransition();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 초기 로드: localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Message[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {}
    // 최초 인사
    setMessages([
      {
        id: `greet-${Date.now()}`,
        role: "tori",
        content: `안녕하세요 🐿️\n저는 ${context.eventName} 숲의 길잡이 토리예요.\n무엇을 도와드릴까요?`,
        createdAt: Date.now(),
      },
    ]);
  }, [storageKey, context.eventName]);

  // 저장
  useEffect(() => {
    if (messages.length === 0) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {}
  }, [messages, storageKey]);

  // 자동 스크롤
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  function send(text: string) {
    const content = text.trim();
    if (!content) return;
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    // 가짜 타이핑 지연
    const delay = 600 + Math.min(content.length * 30, 1200);
    window.setTimeout(() => {
      const reply: Message = {
        id: `t-${Date.now()}`,
        role: "tori",
        content: getToriResponse(content, context),
        createdAt: Date.now(),
      };
      startTransition(() => {
        setMessages((prev) => [...prev, reply]);
        setTyping(false);
        inputRef.current?.focus();
      });
    }, delay);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  function clearHistory() {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {}
    setMessages([
      {
        id: `greet-${Date.now()}`,
        role: "tori",
        content: "대화를 초기화했어요. 다시 무엇이든 물어보세요 🌿",
        createdAt: Date.now(),
      },
    ]);
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* 메시지 영역 */}
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {typing && <TypingBubble />}
          <div className="py-1 text-center">
            <button
              type="button"
              onClick={clearHistory}
              className="text-[11px] text-[#6B6560] hover:underline"
            >
              대화 초기화
            </button>
          </div>
        </div>
      </div>

      {/* 추천 칩 + 입력 */}
      <div className="sticky bottom-0 border-t border-[#D4E4BC] bg-white px-3 py-2 pb-[calc(env(safe-area-inset-bottom)+8px)]">
        <div className="mx-auto max-w-lg">
          <div
            className="mb-2 flex gap-2 overflow-x-auto"
            role="list"
            aria-label="추천 질문"
          >
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                disabled={typing}
                className="flex-shrink-0 rounded-full border border-[#C4956A]/40 bg-[#F5E6D3] px-3 py-1.5 text-xs font-medium text-[#8B6F47] hover:bg-[#EDD9BD] disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
          <form onSubmit={onSubmit} className="flex items-center gap-2">
            <label htmlFor="tori-input" className="sr-only">
              토리에게 보낼 메시지
            </label>
            <input
              ref={inputRef}
              id="tori-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="토리에게 말을 걸어보세요..."
              autoComplete="off"
              inputMode="text"
              disabled={typing}
              className="flex-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={typing || !input.trim()}
              className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-violet-700 disabled:bg-neutral-300"
            >
              보내기
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-violet-600 px-3 py-2 text-sm text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <div
        aria-hidden
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#C4956A] text-lg"
      >
        🐿️
      </div>
      <div className="max-w-[78%] whitespace-pre-wrap rounded-2xl rounded-tl-md border border-[#D4E4BC] bg-[#F5E6D3] px-3 py-2 text-sm text-[#2D5A3D] shadow-sm">
        {message.content}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-end gap-2" aria-label="토리가 입력 중">
      <div
        aria-hidden
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#C4956A] text-lg"
      >
        🐿️
      </div>
      <div className="rounded-2xl rounded-tl-md border border-[#D4E4BC] bg-[#F5E6D3] px-3 py-2 text-sm text-[#8B6F47] shadow-sm">
        <span className="inline-flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8B6F47] [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8B6F47] [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8B6F47]" />
        </span>
      </div>
    </div>
  );
}
