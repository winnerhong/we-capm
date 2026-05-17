"use client";

// LIVE 스튜디오 패널 (DJ 콘솔 메인 카드)
// 참가자 MiniStage 톤(다크 네이비 그라디언트 + 글래스 카드)을 차용해 시각 언어 통일.
//   - 좌상: ON AIR · 세션명
//   - 우상: 청취자 · 경과 · 남은 시간 · STUDIO · 벽시계 (참가자와 동일 모노스페이스)
//   - 메인: NOW PLAYING 글래스 카드 + 비주얼라이저 (그린/앰버/핑크 막대)
//   - 하단: 컨트롤 (props)

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ListenerPresence } from "@/components/tori-fm/ListenerPresence";

/**
 * 같은 곡(song_normalized)에 묶인 PLAYING 사연 1건.
 * 작성자 라벨(`authorLabel`)은 page.tsx 에서 익명/실명 분기 후 결정해 넘긴다.
 */
export interface PlayingItem {
  id: string;
  story: string | null;
  authorLabel: string;
  createdAt: string;
}

interface Props {
  sessionName: string;
  scheduledStart: string;
  scheduledEnd: string;
  startedAt: string | null;
  song: string | null;
  artist: string | null;
  story: string | null;
  parentName: string | null;
  orgId: string;
  controls: ReactNode;
  /** NOW PLAYING 의 종류 — 'story_only' 면 사연 리더 모드(워름톤). */
  nowPlayingKind?: "song_request" | "story_only" | null;
  /** PLAYING request 가 익명 작성이었는지 — 사연 리더 모드 라벨에 영향. */
  isAnonymous?: boolean;
  /**
   * 같은 곡(song_normalized) 묶음 사연 — 비어있거나 1건이면 단일 모드 그대로,
   * 2건 이상이면 곡명 한 번 + 사연 리스트(시간순) 렌더.
   */
  storyItems?: PlayingItem[];
}

export function LiveStudioPanel({
  sessionName,
  scheduledStart,
  scheduledEnd,
  startedAt,
  song,
  artist,
  story,
  parentName,
  orgId,
  controls,
  nowPlayingKind = null,
  isAnonymous = false,
  storyItems = [],
}: Props) {
  // 빈 사연(null/공백)은 묶음 카드에서 제외 — 곡 묶음 모드 판정의 기준.
  const filledStoryItems = useMemo(
    () => storyItems.filter((it) => (it.story ?? "").trim().length > 0),
    [storyItems]
  );
  const isBundleMode = filledStoryItems.length >= 2;
  // SSR/CSR hydration mismatch 방지 — 첫 렌더는 null 로 두고 마운트 후 초깃값을 set.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const startedMs = useMemo(() => {
    if (!startedAt) return null;
    const t = new Date(startedAt).getTime();
    return Number.isNaN(t) ? null : t;
  }, [startedAt]);

  const endMs = useMemo(() => {
    const t = new Date(scheduledEnd).getTime();
    return Number.isNaN(t) ? null : t;
  }, [scheduledEnd]);

  const elapsedSec =
    now !== null && startedMs ? Math.max(0, Math.floor((now - startedMs) / 1000)) : 0;
  const remainingSec =
    now !== null && endMs ? Math.max(0, Math.floor((endMs - now) / 1000)) : 0;
  const isEndingSoon = remainingSec > 0 && remainingSec <= 300; // 5분
  const isCritical = remainingSec > 0 && remainingSec <= 60; // 1분

  const clockText = useMemo(() => {
    if (now === null) return "--:--:--";
    return new Date(now).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }, [now]);

  const youtubeUrl = useMemo(() => {
    if (!song) return null;
    const q = [song, artist].filter(Boolean).join(" ");
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  }, [song, artist]);

  // 사연 모드 — Hero 외곽 글로우 색 분기
  const isStoryHero =
    nowPlayingKind === "story_only" || (!song && !!story);
  const heroShadow = isStoryHero
    ? "shadow-2xl shadow-violet-500/20"
    : "shadow-2xl shadow-amber-500/15";

  return (
    <section
      className={`relative isolate flex h-full flex-col overflow-hidden rounded-[2rem] border-l-[5px] ${
        isStoryHero
          ? "border-l-violet-300/70"
          : "border-l-amber-300/70"
      } border-y border-y-white/10 border-r border-r-white/10 text-white ${heroShadow} backdrop-blur-md transition-shadow duration-300 hover:-translate-y-0.5 hover:shadow-2xl`}
    >
      {/* Hero 외곽 글로우 — 음악(amber) / 사연(rose+violet 합성) */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -inset-2 -z-10 blur-3xl ${
          isStoryHero
            ? "bg-gradient-to-br from-rose-500/10 via-violet-500/15 to-amber-500/8"
            : "bg-amber-500/[0.10]"
        }`}
      />
      {/* 풀블리드 배경 — 참가자 MiniStage 와 동일한 깊은 네이비 그라디언트 */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-[#070C1F] via-[#0B1538] to-[#0F1F4A]"
      />

      <div className="relative z-10 flex flex-1 flex-col p-5 md:p-6">
        {/* 상단 HUD */}
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/95 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-white shadow-lg shadow-rose-500/50 drop-shadow-[0_0_8px_rgba(244,63,94,0.55)]"
              aria-label="ON AIR"
            >
              <span className="relative inline-flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              ON AIR
            </span>
            <h2 className="truncate text-base font-extrabold tracking-tight text-amber-100 md:text-lg">
              {sessionName}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 backdrop-blur-md">
              <ListenerPresence orgId={orgId} variant="light" />
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] tabular-nums backdrop-blur-md ${
                startedMs ? "text-emerald-300" : "text-white/50"
              }`}
            >
              <span aria-hidden>⏱</span>
              {formatHMS(elapsedSec)}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] tabular-nums backdrop-blur-md ${
                isCritical
                  ? "border-rose-400/50 text-rose-300 animate-pulse"
                  : isEndingSoon
                    ? "border-amber-400/50 text-amber-300"
                    : "border-white/10 text-sky-300"
              }`}
            >
              <span aria-hidden>{isCritical ? "⚠" : "⏳"}</span>
              {formatHMS(remainingSec)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-amber-200/80 backdrop-blur-md">
              📻 STUDIO
            </span>
            <time
              aria-live="polite"
              className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] tabular-nums text-amber-100 backdrop-blur-md"
              suppressHydrationWarning
            >
              🕐 {clockText}
            </time>
          </div>
        </header>

        {/* 메인: NOW PLAYING + 비주얼라이저
            ─ 음악 모드(song_request) — 비주얼라이저 함께 표시
            ─ 사연 리더 모드(story_only 또는 song 비어있고 story 만 있을 때) —
              warm gradient 카드, 비주얼라이저 숨김(음악 아닐 때 어색) */}
        {(() => {
          const isStoryMode =
            nowPlayingKind === "story_only" || (!song && !!story);

          if (isStoryMode) {
            return (
              <div className="mt-5">
                <div className="relative rounded-2xl border border-amber-300/30 bg-gradient-to-br from-violet-900/40 via-purple-900/30 to-amber-900/40 p-5 shadow-2xl shadow-amber-500/10 backdrop-blur-md md:p-6">
                  {/* 컨트롤 — 카드 우상단 절대 위치 */}
                  <div className="absolute right-3 top-3 z-10">{controls}</div>

                  <p className="pr-32 text-xs font-bold uppercase tracking-[0.3em] text-violet-100 drop-shadow-[0_0_8px_rgba(167,139,250,0.55)] md:pr-40">
                    💌 사연 읽는 중
                  </p>
                  {story ? (
                    <blockquote className="mt-3 border-l-4 border-amber-300/50 pl-5 text-2xl font-semibold leading-relaxed text-amber-100 md:text-3xl">
                      <span aria-hidden className="mr-1 text-amber-300/70">
                        ❝
                      </span>
                      {story}
                    </blockquote>
                  ) : (
                    <p className="mt-3 text-amber-200/70">사연을 불러오는 중…</p>
                  )}
                  {parentName && (
                    <p className="mt-4 text-right text-sm text-amber-200/80">
                      — {parentName}
                      {isAnonymous && (
                        <span className="ml-1 text-[10px] text-amber-200/60">
                          (익명)
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md">
                {/* 컨트롤 — 카드 우상단 절대 위치 (방송 종료 / 다음 곡) */}
                <div className="absolute right-3 top-3 z-10">{controls}</div>

                <p className="pr-32 text-xs font-bold uppercase tracking-[0.3em] text-amber-200 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] md:pr-40">
                  ♪ NOW PLAYING
                  {isBundleMode && (
                    <span className="ml-2 rounded-full bg-amber-400/20 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-amber-200 ring-1 ring-amber-300/40">
                      사연 {filledStoryItems.length}건 묶음
                    </span>
                  )}
                </p>
                {song ? (
                  <>
                    <p className="mt-1.5 break-words text-2xl font-extrabold tracking-tight text-amber-100 md:text-3xl">
                      {song}
                    </p>
                    {artist && (
                      <p className="mt-0.5 text-sm font-semibold text-amber-200/80">
                        — {artist}
                      </p>
                    )}
                    {/* 곡 묶음 모드 — 사연 카드 N개 (created_at ASC).
                        5개 넘으면 자연 스크롤. */}
                    {isBundleMode ? (
                      <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1
                        [&::-webkit-scrollbar]:w-1.5
                        [&::-webkit-scrollbar-track]:bg-transparent
                        [&::-webkit-scrollbar-thumb]:rounded-full
                        [&::-webkit-scrollbar-thumb]:bg-white/15">
                        {filledStoryItems.map((it) => (
                          <li
                            key={it.id}
                            className="border-l-2 border-amber-300/40 pl-3"
                          >
                            <p className="text-sm leading-relaxed text-white/95">
                              <span aria-hidden className="mr-0.5 text-amber-300/70">
                                ❝
                              </span>
                              {it.story}
                              <span aria-hidden className="ml-0.5 text-amber-300/70">
                                ❞
                              </span>
                            </p>
                            <p className="mt-1 text-[11px] text-amber-200/70">
                              — {it.authorLabel || "익명의 청취자"}
                              <span className="ml-1.5 text-amber-200/50">
                                · {fmtRelative(it.createdAt)}
                              </span>
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <>
                        {story && (
                          <blockquote className="mt-3 border-l-2 border-amber-300/50 pl-3 text-[13px] leading-relaxed text-white/95">
                            &ldquo;{story}&rdquo;
                          </blockquote>
                        )}
                        {parentName && (
                          <p className="mt-2 text-right text-[11px] font-semibold text-amber-200/75">
                            — {parentName}
                          </p>
                        )}
                      </>
                    )}
                    {youtubeUrl && (
                      <a
                        href={youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-1.5 text-xs font-bold text-[#0B1538] shadow-md shadow-amber-400/30 transition hover:bg-amber-300"
                      >
                        ▶ YouTube에서 음원 재생
                      </a>
                    )}
                  </>
                ) : (
                  <div className="mt-3 text-center">
                    <p className="text-3xl" aria-hidden>
                      🌲
                    </p>
                    <p className="mt-2 text-sm font-semibold text-amber-200">
                      다음 사연을 준비하고 있어요
                    </p>
                    <p className="mt-1 text-[11px] text-white/55">
                      아래 컨트롤에서 &ldquo;다음 곡&rdquo;을 눌러 시작하세요
                    </p>
                  </div>
                )}
              </div>

              <Visualizer playing={!!song} />
            </div>
          );
        })()}

        {/* 시간 정보 푸터 */}
        <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-200/60">
          <span>📅 예정: {fmtShort(scheduledStart)} ~ {fmtShort(scheduledEnd)}</span>
          {startedAt && <span>🎙 방송 시작: {fmtShort(startedAt)}</span>}
        </footer>
      </div>
    </section>
  );
}

/* ---------------- Helpers ---------------- */

function formatHMS(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(r)}`;
}

function fmtShort(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "5분 전" / "방금 전" — created_at 기준 한국어 상대 시간. */
function fmtRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 30) return "방금 전";
  if (diffSec < 60) return `${diffSec}초 전`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * 비주얼라이저 — CSS 기반, 참가자 화면 스피릿(그린/앰버/핑크 막대).
 *
 * 성능 고려:
 *  - 28 막대(14 × L/R) 가 각각 RAF 를 돌리면 layout/paint 가 매 프레임 28회 발생해
 *    페이지 전체 스크롤이 무거워진다. → 단일 RAF 로 모든 막대를 한 번에 갱신.
 *  - height 변경은 layout 을 트리거 → transform: scaleY 로 바꿔 compositor-only.
 *  - IntersectionObserver 로 컨테이너가 화면 밖이면 RAF 자체를 중단.
 *  - backdrop-blur 는 스크롤 시 매 프레임 재합성 비용이 커서 제거.
 */
function Visualizer({ playing }: { playing: boolean }) {
  const bars = 14;
  const total = bars * 2; // L + R
  const containerRef = useRef<HTMLDivElement>(null);
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => setVisible(entries[0]?.isIntersecting ?? false),
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    let last = 0;
    const step = (t: number) => {
      if (t - last > 110) {
        last = t;
        for (let i = 0; i < total; i++) {
          const el = barRefs.current[i];
          if (!el) continue;
          const idx = i % bars;
          const base = playing
            ? 0.3 + ((bars - idx) / bars) * 0.4
            : 0.05 + ((bars - idx) / bars) * 0.1;
          const jitter = playing ? Math.random() * 0.4 : Math.random() * 0.08;
          const h = Math.max(0.04, Math.min(1, base + jitter));
          el.style.transform = `scaleY(${h.toFixed(3)})`;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [visible, playing, total, bars]);

  let assignIdx = 0;
  return (
    <div
      ref={containerRef}
      className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3"
    >
      {[0, 1].map((ch) => (
        <div key={ch} className="flex flex-col items-center gap-1">
          <span className="font-mono text-[9px] font-bold tracking-widest text-white/45">
            {ch === 0 ? "L" : "R"}
          </span>
          <div className="flex h-24 items-end gap-[2px]">
            {Array.from({ length: bars }).map((_, i) => {
              const color =
                i < bars * 0.5
                  ? "bg-emerald-400"
                  : i < bars * 0.8
                    ? "bg-amber-400"
                    : "bg-rose-400";
              const myIdx = assignIdx++;
              return (
                <span
                  key={i}
                  ref={(el) => {
                    barRefs.current[myIdx] = el;
                  }}
                  aria-hidden
                  className={`block h-full w-1.5 origin-bottom rounded-sm ${color} will-change-transform`}
                  style={{ transform: "scaleY(0.1)" }}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
