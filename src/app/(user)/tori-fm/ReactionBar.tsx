"use client";

// 토리FM 이모지 리액션 바 — 6개 이모지 가로 배치.
//  - 각 이모지당 500ms 쓰로틀(서로 다른 이모지는 즉시 허용).
//  - 클릭 시 optimistic bounce 애니메이션 + sendReactionAction.
//  - isLive=false 일 때 비활성.

import { useCallback, useRef, useState, useTransition } from "react";
import { sendReactionAction } from "@/lib/tori-fm/actions";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/tori-fm/types";

const PER_EMOJI_THROTTLE_MS = 500;

type Props = {
  sessionId: string;
  isLive: boolean;
};

export function ReactionBar({ sessionId, isLive }: Props) {
  const lastTapRef = useRef<Record<string, number>>({});
  const [bouncing, setBouncing] = useState<Record<string, number>>({});
  const [, startTransition] = useTransition();

  const handleTap = useCallback(
    (emoji: ReactionEmoji) => {
      if (!isLive || !sessionId) return;
      const now = Date.now();
      const last = lastTapRef.current[emoji] ?? 0;
      if (now - last < PER_EMOJI_THROTTLE_MS) return;
      lastTapRef.current[emoji] = now;

      // optimistic bounce trigger — key 증가로 재애니메이션
      setBouncing((prev) => ({ ...prev, [emoji]: now }));

      startTransition(async () => {
        try {
          await sendReactionAction(sessionId, emoji);
        } catch (e) {
          // 로그만 — 사용자에게 큰 피드백은 생략.
          if (process.env.NODE_ENV !== "production") {
            console.warn("[ReactionBar] send failed", e);
          }
        }
      });
    },
    [isLive, sessionId]
  );

  return (
    <section
      className="rounded-3xl border border-[#D4E4BC] bg-[#FFF8F0] p-3 shadow-sm"
      aria-label="이모지 반응"
    >
      <p className="px-1 text-[11px] font-semibold text-[#2D5A3D]">
        방송에 반응 보내기
      </p>
      <div className="mt-2 grid grid-cols-6 gap-1.5">
        {REACTION_EMOJIS.map((emoji) => {
          const bounceKey = bouncing[emoji] ?? 0;
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => handleTap(emoji)}
              disabled={!isLive}
              aria-label={`${emoji} 반응 보내기`}
              className="group relative flex min-h-14 items-center justify-center rounded-2xl border border-transparent bg-white text-2xl transition hover:border-[#2D5A3D]/30 hover:bg-[#D4E4BC]/40 focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span
                key={bounceKey}
                className={bounceKey ? "inline-block animate-bounce" : ""}
              >
                {emoji}
              </span>
            </button>
          );
        })}
      </div>
      {!isLive && (
        <p className="mt-2 text-center text-[10px] text-[#6B6560]">
          방송이 시작되면 반응을 보낼 수 있어요
        </p>
      )}
    </section>
  );
}
