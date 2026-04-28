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
import { usePanelExpand, PanelExpandButton } from "./use-panel-expand";

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
}

export function SpotlightTriggerBar({
  sessionId,
  currentStory,
}: Props) {
  const [bannerText, setBannerText] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const { expanded, toggle, panelClassName } = usePanelExpand();

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

  return (
    <section
      className={`flex flex-col rounded-3xl border border-fuchsia-300/30 bg-gradient-to-br from-[#1a1230] via-[#241845] to-[#1a1230] p-5 shadow-lg ${panelClassName}`}
    >
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-fuchsia-200">
          <span aria-hidden>📺</span>
          <span>전광판 스포트라이트</span>
        </h3>
        <div className="flex items-center gap-2">
          <p className="hidden text-[11px] text-fuchsia-300/70 sm:block">
            버튼 한 번으로 전광판에 즉시 송출
          </p>
          <PanelExpandButton
            expanded={expanded}
            onToggle={toggle}
            tone="fuchsia"
          />
        </div>
      </header>

      {feedback && (
        <p
          role="status"
          className="mb-3 rounded-xl bg-black/40 px-3 py-2 text-xs font-semibold text-fuchsia-100"
        >
          {feedback}
        </p>
      )}

      {/* 5종 트리거 그리드 */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
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
          className="rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/15 p-3 text-left text-fuchsia-100 backdrop-blur transition hover:bg-fuchsia-500/25 disabled:opacity-40"
          title={canStory ? undefined : "현재 재생 중인 사연이 없어요"}
        >
          <p className="text-base font-bold">📺 사연 풀스크린</p>
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
          className="rounded-2xl border border-rose-400/40 bg-rose-500/15 p-3 text-left text-rose-100 backdrop-blur transition hover:bg-rose-500/25 disabled:opacity-40"
        >
          <p className="text-base font-bold">💕 하트 비</p>
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
          className="rounded-2xl border border-emerald-400/40 bg-emerald-500/15 p-3 text-left text-emerald-100 backdrop-blur transition hover:bg-emerald-500/25 disabled:opacity-40"
        >
          <p className="text-base font-bold">🌲 이모지 비</p>
          <p className="mt-0.5 text-[11px] text-emerald-200/80">자연 이모지</p>
        </button>

        {/* 4. 응원 배너 */}
        <div className="col-span-2 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3 backdrop-blur md:col-span-2">
          <p className="text-base font-bold text-amber-100">🎉 응원 배너</p>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="text"
              value={bannerText}
              onChange={(e) => setBannerText(e.target.value.slice(0, 60))}
              placeholder="예: 박지우님이 신청곡을 보냈어요!"
              maxLength={60}
              className="flex-1 rounded-xl border border-amber-400/30 bg-black/30 px-3 py-2 text-sm text-amber-100 placeholder:text-amber-300/40 focus:border-amber-300 focus:outline-none"
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
              className="rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-amber-950 transition hover:bg-amber-300 disabled:opacity-40"
            >
              송출
            </button>
          </div>
        </div>

      </div>

      <p className="mt-3 text-[10px] text-fuchsia-300/60">
        💡 같은 종류를 다시 누르면 기존 효과를 덮어써요
      </p>
    </section>
  );
}
