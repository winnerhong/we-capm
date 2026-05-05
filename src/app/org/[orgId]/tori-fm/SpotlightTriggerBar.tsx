"use client";

// 전광판 스포트라이트 트리거 바 — DJ 콘솔의 마지막 zone.
//   5종 효과(사연 풀스크린·하트비·이모지비·응원배너·투표풀스크린)를
//   한 번 클릭으로 전광판에 푸시.
//
// 데이터 흐름:
//   click → triggerSpotlightAction(sessionId, kind, payload?)
//        → fm_spotlight_events INSERT
//        → Supabase Realtime publication
//        → 전광판 SpotlightReceiver 가 수신 → VFX 발사
//
// "사연 스포트라이트"는 nowPlaying 사연이 있어야 활성. 텍스트 입력 없음 (현재 곡 사연을 그대로 푸시).
// "응원 배너"는 짧은 텍스트 입력 후 푸시.
// "투표 풀스크린"은 활성 투표가 있을 때만 활성.

import { useState, useTransition } from "react";
import { triggerSpotlightAction } from "@/lib/tori-fm/actions";

interface Props {
  sessionId: string;
  /** 활성 사연 (현재 재생 중) — 사연 스포트라이트의 payload */
  currentStory: {
    requestId?: string | null;
    songTitle: string | null;
    artist: string | null;
    story: string | null;
    childName: string | null;
    parentName: string | null;
  } | null;
  /**
   * embedded=true: 외곽 카드 chrome 제거, 헤더/패딩 컴팩트
   * (DjChatPanel 안에 인라인으로 마운트할 때 사용)
   * 기본 false — 기존 카드 외관 유지.
   */
  embedded?: boolean;
}

export function SpotlightTriggerBar({
  sessionId,
  currentStory,
  embedded = false,
}: Props) {
  const [bannerText, setBannerText] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const fire = (label: string, fn: () => Promise<void>) => {
    startTransition(async () => {
      try {
        await fn();
        setFeedback(`✅ ${label} 송출`);
        setTimeout(() => setFeedback(null), 2500);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "송출 실패";
        // 에러 메시지는 길게 노출 — 사용자가 원인을 읽고 대응할 시간 필요.
        // 콘솔에도 출력해서 dev tools 에서 추적 가능.
        console.error("[spotlight] trigger error", { label, msg, error: e });
        setFeedback(`⚠ ${msg}`);
        setTimeout(() => setFeedback(null), 12_000);
      }
    });
  };

  const canStory = !!(currentStory && currentStory.story);

  // embedded 모드 — DjChatPanel 안에 인라인으로 들어갈 때.
  // 외곽 카드 chrome / 외곽 글로우 / 두꺼운 패딩 모두 제거하고
  // 트리거 버튼 행(가로) + 응원 배너 한 줄로 컴팩트하게 표현.
  if (embedded) {
    return (
      <div className="rounded-xl border border-amber-300/20 bg-amber-950/15 p-2.5 text-white">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-amber-200/85">
            <span aria-hidden>📺</span>
            <span>전광판 스포트라이트</span>
          </p>
          {feedback && (
            <p
              role="status"
              className="truncate rounded-md bg-white/[0.08] px-2 py-0.5 text-[10px] font-semibold text-amber-100"
            >
              {feedback}
            </p>
          )}
        </div>

        {/* 트리거 3종 가로 버튼 행 — 작은 패딩/폰트 */}
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          <button
            type="button"
            disabled={pending || !canStory}
            onClick={() =>
              fire("사연 스포트라이트", () =>
                triggerSpotlightAction(sessionId, "STORY", {
                  request_id: currentStory?.requestId ?? null,
                  song_title: currentStory?.songTitle ?? null,
                  artist: currentStory?.artist ?? null,
                  story: currentStory?.story ?? null,
                  child_name: currentStory?.childName ?? null,
                  parent_name: currentStory?.parentName ?? null,
                })
              )
            }
            className="rounded-md border border-fuchsia-400/40 bg-fuchsia-500/15 px-2 py-1.5 text-[11px] font-bold text-fuchsia-100 transition hover:bg-fuchsia-500/30 disabled:opacity-35"
            title={canStory ? undefined : "현재 재생 중인 사연이 없어요"}
          >
            📺 사연
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              fire("하트 비", () =>
                triggerSpotlightAction(sessionId, "HEART_RAIN", {
                  intensity: "high",
                })
              )
            }
            className="rounded-md border border-rose-400/40 bg-rose-500/15 px-2 py-1.5 text-[11px] font-bold text-rose-100 transition hover:bg-rose-500/30 disabled:opacity-35"
          >
            💕 하트비
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              fire("이모지 비", () =>
                triggerSpotlightAction(sessionId, "EMOJI_RAIN", {
                  emoji: "🌲",
                })
              )
            }
            className="rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-1.5 text-[11px] font-bold text-emerald-100 transition hover:bg-emerald-500/30 disabled:opacity-35"
          >
            🌲 이모지비
          </button>
        </div>

        {/* 공지사항은 상단 nav 의 [📢 공지사항] 버튼으로 통일 — 여기서는 노출 X.
            (구 인풋은 nav 와 중복이라 의도적으로 제거. 액션은 동일 — fm_spotlight_events BANNER) */}
      </div>
    );
  }

  return (
    <section className="relative isolate flex flex-col rounded-xl border-l-[5px] border-l-amber-300/80 border-y border-y-white/10 border-r border-r-white/10 bg-amber-950/30 p-4 text-white shadow-xl shadow-amber-500/15 backdrop-blur-md transition-shadow duration-200 ease-out hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-amber-500/25 md:p-5">
      {/* 외곽 글로우 — amber 컴팩트 톤 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-1 -z-10 rounded-2xl bg-amber-500/[0.10] blur-2xl"
      />
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-amber-200 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]">
          <span aria-hidden>📺</span>
          <span>전광판 스포트라이트</span>
        </h3>
        <p className="hidden text-[11px] text-amber-200/70 sm:block">
          버튼 한 번으로 전광판 송출
        </p>
      </header>

      {feedback && (
        <p
          role="status"
          className="mb-3 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-amber-100 backdrop-blur-md"
        >
          {feedback}
        </p>
      )}

      {/* 5종 트리거 — 사이드 좁은 폭(col-3) 안에서 세로 stack */}
      <div className="grid grid-cols-1 gap-2">
        {/* 1. 사연 풀스크린 */}
        <button
          type="button"
          disabled={pending || !canStory}
          onClick={() =>
            fire("사연 스포트라이트", () =>
              triggerSpotlightAction(sessionId, "STORY", {
                request_id: currentStory?.requestId ?? null,
                song_title: currentStory?.songTitle ?? null,
                artist: currentStory?.artist ?? null,
                story: currentStory?.story ?? null,
                child_name: currentStory?.childName ?? null,
                parent_name: currentStory?.parentName ?? null,
              })
            )
          }
          className="rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/15 p-3 text-left text-fuchsia-100 backdrop-blur-md transition hover:bg-fuchsia-500/25 disabled:opacity-40"
          title={canStory ? undefined : "현재 재생 중인 사연이 없어요"}
        >
          <p className="text-sm font-bold">📺 사연 풀스크린</p>
          <p className="mt-0.5 text-[11px] text-fuchsia-200/80">
            현재 사연을 30초 띄워요
          </p>
        </button>

        {/* 2. 하트 비 */}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            fire("하트 비", () =>
              triggerSpotlightAction(sessionId, "HEART_RAIN", {
                intensity: "high",
              })
            )
          }
          className="rounded-2xl border border-rose-400/40 bg-rose-500/15 p-3 text-left text-rose-100 backdrop-blur-md transition hover:bg-rose-500/25 disabled:opacity-40"
        >
          <p className="text-sm font-bold">💕 하트 비</p>
          <p className="mt-0.5 text-[11px] text-rose-200/80">6초 폭우</p>
        </button>

        {/* 3. 이모지 비 */}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            fire("이모지 비", () =>
              triggerSpotlightAction(sessionId, "EMOJI_RAIN", {
                emoji: "🌲",
              })
            )
          }
          className="rounded-2xl border border-emerald-400/40 bg-emerald-500/15 p-3 text-left text-emerald-100 backdrop-blur-md transition hover:bg-emerald-500/25 disabled:opacity-40"
        >
          <p className="text-sm font-bold">🌲 이모지 비</p>
          <p className="mt-0.5 text-[11px] text-emerald-200/80">자연 이모지</p>
        </button>

        {/* 4. 응원 배너 — 좁은 사이드 폭 고려해 input 위 + 버튼 아래 세로 stack */}
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3 backdrop-blur-md">
          <p className="text-sm font-bold text-amber-100">🎉 응원 배너</p>
          <div className="mt-1.5 flex flex-col gap-2">
            <input
              type="text"
              value={bannerText}
              onChange={(e) => setBannerText(e.target.value.slice(0, 60))}
              placeholder="예: 박지우님이 신청곡을 보냈어요!"
              maxLength={60}
              className="w-full min-w-0 rounded-xl border border-amber-400/30 bg-white/[0.06] px-3 py-2 text-sm text-amber-100 placeholder:text-amber-300/40 focus:border-amber-300 focus:outline-none"
            />
            <button
              type="button"
              disabled={pending || bannerText.trim().length === 0}
              onClick={() =>
                fire("응원 배너", async () => {
                  await triggerSpotlightAction(sessionId, "BANNER", {
                    text: bannerText.trim(),
                  });
                  setBannerText("");
                })
              }
              className="w-full rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-[#0B1538] transition hover:bg-amber-300 disabled:opacity-40"
            >
              📡 송출
            </button>
          </div>
        </div>

      </div>

      <p className="mt-3 text-[10px] text-amber-200/60">
        💡 같은 종류를 다시 누르면 기존 효과를 덮어써요
      </p>
    </section>
  );
}
