"use client";

import { useEffect, useRef } from "react";

export type ChatBubble = {
  id: string;
  senderName: string;
  message: string;
  isDJ?: boolean;
};

interface Props {
  /** 외부 이벤트 소스. 새 id 들어오면 hand-off 해서 drift 애니메이션. */
  messages: ChatBubble[];
  /** 동시 최대 버블 (기본 8) */
  max?: number;
}

/**
 * 좌하단에서 올라오는 채팅 말풍선.
 *  - 화면 좌측 하단에서 생성 → 4~5.5초 동안 위로 drift
 *  - DJ 메시지는 황동 glow
 *  - 새 버블 추가될 때 기존 버블이 위로 밀려남
 */
export function DriftUpChat({ messages, max = 8 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    for (const m of messages) {
      if (seenIdsRef.current.has(m.id)) continue;
      seenIdsRef.current.add(m.id);
      spawnBubble(m);
    }
    if (seenIdsRef.current.size > 300) {
      seenIdsRef.current = new Set(
        Array.from(seenIdsRef.current).slice(-150)
      );
    }
  }, [messages]);

  function spawnBubble(m: ChatBubble) {
    const container = containerRef.current;
    if (!container) return;

    // 큐 초과 시 가장 오래된 거 fast fade-out
    while (queueRef.current.length >= max) {
      const old = queueRef.current.shift();
      if (old) {
        old.classList.add("vfx-chat-fastfade");
        setTimeout(() => old.remove(), 300);
      }
    }

    const initial = (m.senderName ?? "").trim().charAt(0) || "🌿";
    const el = document.createElement("div");
    el.className = m.isDJ ? "vfx-chat vfx-chat-dj" : "vfx-chat";

    const avatar = document.createElement("span");
    avatar.className = "vfx-chat-avatar";
    avatar.textContent = initial;

    const body = document.createElement("div");
    body.className = "vfx-chat-body";

    const nameEl = document.createElement("div");
    nameEl.className = "vfx-chat-name";
    nameEl.textContent = m.isDJ ? `🎙 ${m.senderName}` : m.senderName;

    const msgEl = document.createElement("div");
    msgEl.className = "vfx-chat-msg";
    msgEl.textContent = m.message.slice(0, 140);

    body.appendChild(nameEl);
    body.appendChild(msgEl);
    el.appendChild(avatar);
    el.appendChild(body);

    // drift up 오프셋 — 기존 버블 위로 올리기 위해
    const offset = queueRef.current.length * 72;
    el.style.setProperty("--drift-offset", `${offset}px`);

    container.appendChild(el);
    queueRef.current.push(el);

    // 기존 버블들도 offset 갱신해 위로 밀려나는 느낌
    queueRef.current.forEach((node, i) => {
      node.style.setProperty("--drift-offset", `${(queueRef.current.length - 1 - i) * 72}px`);
    });

    // 5.5초 후 자동 제거
    setTimeout(() => {
      el.classList.add("vfx-chat-fadeout");
      setTimeout(() => {
        el.remove();
        queueRef.current = queueRef.current.filter((n) => n !== el);
      }, 600);
    }, 5500);
  }

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
    />
  );
}
