"use client";

// 사연 스포트라이트 — 전광판에 사연을 풀스크린 시네마틱하게 띄움.
// DJ 콘솔의 "📺 사연 풀스크린" 버튼이 fm_spotlight_events.kind='STORY' 를 INSERT 하면
// ScreenEffectsLayer 가 받아 이 컴포넌트의 event prop 으로 전달.
//
// 표시 시간: ScreenEffectsLayer 가 expiresAtMs 까지 keep, 초과 시 null 로 dismiss.
//
// 디자인:
//   - 전체 화면 검은 오버레이 + 노란 따뜻한 spotlight gradient
//   - 거대한 song title, 그 아래 사연 인용문
//   - 하단 child / parent 이름
//   - 페이드 인/아웃 (1초)

import { useEffect, useState } from "react";

export interface StorySpotlightEvent {
  id: string;
  songTitle: string;
  artist: string;
  story: string;
  childName: string;
  parentName: string;
  expiresAtMs: number;
}

export function StorySpotlight({
  event,
}: {
  event: StorySpotlightEvent | null;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (event) {
      // 다음 frame 에서 visible=true → 페이드인 transition
      const t = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(t);
    }
    setVisible(false);
  }, [event]);

  if (!event) return null;

  return (
    <div
      aria-live="polite"
      className={`pointer-events-none fixed inset-0 z-40 flex items-center justify-center px-8 transition-opacity duration-700 md:px-16 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(196,149,106,0.18) 0%, rgba(0,0,0,0.96) 65%)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div className="w-full max-w-6xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.5em] text-amber-300/80 md:text-sm">
          ♪ Featured Story
        </p>
        <h2 className="mt-4 break-keep text-5xl font-extrabold leading-tight text-amber-100 md:text-7xl lg:text-8xl">
          {event.songTitle || "사연"}
        </h2>
        {event.artist && (
          <p className="mt-2 text-2xl font-semibold text-amber-200/80 md:text-3xl lg:text-4xl">
            — {event.artist}
          </p>
        )}

        {event.story && (
          <blockquote className="mx-auto mt-10 max-w-5xl rounded-3xl border border-amber-300/30 bg-black/60 p-8 text-left shadow-2xl backdrop-blur md:p-12">
            <p className="whitespace-pre-wrap text-2xl leading-relaxed text-amber-100 md:text-3xl lg:text-4xl lg:leading-[1.5]">
              &ldquo;{event.story}&rdquo;
            </p>
          </blockquote>
        )}

        {(event.childName || event.parentName) && (
          <p className="mt-8 text-xl font-semibold text-amber-200/80 md:text-2xl lg:text-3xl">
            {event.childName && (
              <span>
                <span className="text-amber-300/60">사연 </span>
                {event.childName}
              </span>
            )}
            {event.childName && event.parentName && (
              <span className="mx-3 text-amber-300/40">·</span>
            )}
            {event.parentName && (
              <span>
                <span className="text-amber-300/60">보내신 분 </span>
                {event.parentName}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
