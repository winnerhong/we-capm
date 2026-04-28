"use client";

// 토리FM 이모지 리액션 바 — 6개 이모지 가로 배치.
//  - 각 이모지당 500ms 쓰로틀(서로 다른 이모지는 즉시 허용).
//  - 클릭 시 (a) 즉시 fly-up 이모지 애니메이션 (b) sendReactionAction 호출.
//  - 전송 실패 시 작은 토스트 노출 (silent fail 방지).
//  - isLive=false 일 때 비활성.

import { useCallback, useRef, useState, useTransition } from "react";
import { sendReactionAction } from "@/lib/tori-fm/actions";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/tori-fm/types";

const PER_EMOJI_THROTTLE_MS = 500;
const FLY_UP_DURATION_MS = 1100;

interface FlyUp {
  id: string;
  emoji: ReactionEmoji;
  /** 0~5 (버튼 인덱스) — left 위치 계산용 */
  col: number;
}

type Props = {
  sessionId: string;
  isLive: boolean;
  /**
   * 렌더 모드.
   *  - "standalone" (default): 자체 카드 chrome (크림 배경) — 단독 사용
   *  - "embedded"            : 카드 chrome 없음, 다크 톤 — MiniStage 같은 부모 안에서 사용
   */
  variant?: "standalone" | "embedded";
};

export function ReactionBar({
  sessionId,
  isLive,
  variant = "standalone",
}: Props) {
  const lastTapRef = useRef<Record<string, number>>({});
  const [bouncing, setBouncing] = useState<Record<string, number>>({});
  const [flyUps, setFlyUps] = useState<FlyUp[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleTap = useCallback(
    (emoji: ReactionEmoji, col: number) => {
      if (!isLive || !sessionId) return;
      const now = Date.now();
      const last = lastTapRef.current[emoji] ?? 0;
      if (now - last < PER_EMOJI_THROTTLE_MS) return;
      lastTapRef.current[emoji] = now;

      // (a) optimistic bounce — 버튼 안 이모지 흔들림
      setBouncing((prev) => ({ ...prev, [emoji]: now }));

      // (b) fly-up 오버레이 — 큰 이모지가 위로 떠올라 사라짐 (즉시 시각 피드백)
      const id = `${now}-${Math.random().toString(36).slice(2, 7)}`;
      setFlyUps((prev) => [...prev, { id, emoji, col }]);
      setTimeout(() => {
        setFlyUps((prev) => prev.filter((f) => f.id !== id));
      }, FLY_UP_DURATION_MS);

      // (c) 실제 INSERT — 실패 시 토스트 + 콘솔 로그
      startTransition(async () => {
        try {
          await sendReactionAction(sessionId, emoji);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "리액션 전송 실패";
          console.warn("[ReactionBar] send failed", e);
          setErrMsg(`⚠ ${msg}`);
          setTimeout(() => setErrMsg(null), 3500);
        }
      });
    },
    [isLive, sessionId]
  );

  const isEmbedded = variant === "embedded";

  // tone tokens — variant 별 색상
  const wrapperCls = isEmbedded
    ? "border-t border-white/10 pt-3"
    : "rounded-3xl border border-[#D4E4BC] bg-[#FFF8F0] p-3 shadow-sm";
  const labelCls = isEmbedded
    ? "px-1 text-[11px] font-semibold text-amber-200/80"
    : "px-1 text-[11px] font-semibold text-[#2D5A3D]";
  const buttonCls = isEmbedded
    ? "group relative flex min-h-14 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-2xl backdrop-blur-sm transition hover:border-amber-300/40 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-300/50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
    : "group relative flex min-h-14 items-center justify-center rounded-2xl border border-transparent bg-white text-2xl transition hover:border-[#2D5A3D]/30 hover:bg-[#D4E4BC]/40 focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40";
  const offlineCls = isEmbedded
    ? "mt-2 text-center text-[10px] text-white/50"
    : "mt-2 text-center text-[10px] text-[#6B6560]";

  return (
    <section className={`relative ${wrapperCls}`} aria-label="이모지 반응">
      <p className={labelCls}>방송에 반응 보내기</p>
      <div className="relative mt-2 grid grid-cols-6 gap-1.5">
        {REACTION_EMOJIS.map((emoji, col) => {
          const bounceKey = bouncing[emoji] ?? 0;
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => handleTap(emoji, col)}
              disabled={!isLive}
              aria-label={`${emoji} 반응 보내기`}
              className={buttonCls}
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

        {/* Fly-up 오버레이 — 클릭 즉시 큰 이모지가 위로 떠오름.
            버튼 6열 grid 위에 absolute 로 얹어서 col 인덱스 기준 left 위치 계산. */}
        <div className="pointer-events-none absolute inset-x-0 -top-12 h-12 overflow-visible">
          {flyUps.map((f) => (
            <span
              key={f.id}
              className="reaction-fly-up absolute text-3xl"
              style={{
                // col(0..5) 마다 1/6 씩 가로 분할 + 각 cell 중앙으로 보정
                left: `calc(${(f.col + 0.5) * (100 / 6)}% - 0.75rem)`,
              }}
              aria-hidden
            >
              {f.emoji}
            </span>
          ))}
        </div>
      </div>

      {/* 에러 토스트 */}
      {errMsg && (
        <p
          role="alert"
          className="mt-2 rounded-xl bg-rose-100 px-3 py-1.5 text-center text-[11px] font-semibold text-rose-700"
        >
          {errMsg}
        </p>
      )}

      {!isLive && (
        <p className={offlineCls}>방송이 시작되면 반응을 보낼 수 있어요</p>
      )}

      {/* fly-up 키프레임 (Tailwind 기본에 없는 커스텀 애니메이션). */}
      <style jsx>{`
        :global(.reaction-fly-up) {
          animation: reactionFlyUp ${FLY_UP_DURATION_MS}ms ease-out forwards;
          will-change: transform, opacity;
        }
        @keyframes reactionFlyUp {
          0% {
            transform: translateY(20px) scale(0.6);
            opacity: 0;
          }
          15% {
            transform: translateY(0) scale(1.4);
            opacity: 1;
          }
          100% {
            transform: translateY(-72px) scale(1);
            opacity: 0;
          }
        }
      `}</style>
    </section>
  );
}
