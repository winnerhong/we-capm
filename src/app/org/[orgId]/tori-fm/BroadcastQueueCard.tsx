"use client";

// 방송 대기 큐 카드 — 호스트 콘솔 전용.
// 역할:
//   - status='QUEUED' 인 신청곡을 queue_position 순으로 표시 (다음 곡 강조)
//   - status='PLAYING' (NOW PLAYING) 신청곡 큰 카드로 노출 + [⏹ 정지]
//   - 메인 CTA [▶ 다음 곡 재생] — playNextFromQueueAction 호출
//   - 각 큐 항목 [▲][▼] 순서 이동, [×] 큐에서 제외 (APPROVED 로 복귀)
//   - Realtime: tori_fm_requests UPDATE/INSERT 구독 → 즉시 반영
//
// 채널명은 다른 컴포넌트와 충돌 안 나게 `fm-queue-${sessionId}` 사용.
//
// 디자인 톤은 다른 콘솔 카드와 동일한 글래스/네이비 베이스 + amber 강조.

import { useCallback, useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  playNextFromQueueAction,
  reorderQueueAction,
  stopPlayingAction,
  unqueueRequestAction,
} from "@/lib/tori-fm/actions";
import {
  anonLabelFromUserId,
  withFamilySuffix,
  type FmRequestRow,
} from "@/lib/tori-fm/types";

interface Props {
  sessionId: string;
  initialQueued: FmRequestRow[];
  initialPlaying: FmRequestRow | null;
  /**
   * 같은 곡(song_normalized)에 묶여 PLAYING 상태가 된 사연들 — created_at ASC.
   * 비어있거나 1건이면 단일 모드(기존 호환). 2건 이상이면 곡명 1회 + 사연 리스트 렌더.
   */
  initialPlayingGroup?: FmRequestRow[];
  /**
   * compact=true: NOW PLAYING 영역 숨김 (메인 LiveStudioPanel 와 중복 회피).
   * 큐 리스트 + [▶ 다음 곡] 버튼만 보임.
   */
  compact?: boolean;
}

function songTitleOrFallback(r: FmRequestRow): string {
  return r.song_title?.trim() || "(사연만)";
}

function authorLabel(r: FmRequestRow): string {
  if (r.is_anonymous) return anonLabelFromUserId(r.user_id);
  return withFamilySuffix(r.child_name);
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

function sortByQueuePos(arr: FmRequestRow[]): FmRequestRow[] {
  return [...arr].sort((a, b) => {
    const pa = a.queue_position ?? Number.MAX_SAFE_INTEGER;
    const pb = b.queue_position ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export function BroadcastQueueCard({
  sessionId,
  initialQueued,
  initialPlaying,
  initialPlayingGroup = [],
  compact = false,
}: Props) {
  const [queue, setQueue] = useState<FmRequestRow[]>(() =>
    sortByQueuePos(initialQueued)
  );
  const [playing, setPlaying] = useState<FmRequestRow | null>(initialPlaying);
  // 같은 곡 묶음 PLAYING 사연들 (created_at ASC) — 음악 모드에서만 사용.
  const [playingGroup, setPlayingGroup] = useState<FmRequestRow[]>(
    initialPlayingGroup ?? []
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyMain, setBusyMain] = useState<"next" | "stop" | null>(null);
  const [, startTransition] = useTransition();

  // SSR 데이터 변경 시 동기화
  useEffect(() => {
    setQueue(sortByQueuePos(initialQueued));
  }, [initialQueued]);
  useEffect(() => {
    setPlaying(initialPlaying);
  }, [initialPlaying]);
  useEffect(() => {
    setPlayingGroup(initialPlayingGroup ?? []);
  }, [initialPlayingGroup]);

  // Realtime 구독
  useEffect(() => {
    if (!sessionId) return;
    const supa = createClient();

    const applyRow = (row: FmRequestRow) => {
      if (row.status === "PLAYING") {
        // 첫 PLAYING row 면 head 로 지정. 같은 song_normalized 의 추가 PLAYING 도 group 에 누적.
        setPlaying((prev) => prev ?? row);
        setPlayingGroup((prev) => {
          const has = prev.some((r) => r.id === row.id);
          const merged = has
            ? prev.map((r) => (r.id === row.id ? row : r))
            : [...prev, row];
          return merged.sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
          );
        });
        setQueue((prev) => prev.filter((r) => r.id !== row.id));
        return;
      }
      if (row.status === "QUEUED") {
        setQueue((prev) => {
          const has = prev.some((r) => r.id === row.id);
          const merged = has
            ? prev.map((r) => (r.id === row.id ? row : r))
            : [...prev, row];
          return sortByQueuePos(merged);
        });
        // 만약 이전 PLAYING 이었다면 클리어 (서버 액션이 PLAYING 비웠을 수도)
        setPlaying((prev) => (prev?.id === row.id ? null : prev));
        setPlayingGroup((prev) => prev.filter((r) => r.id !== row.id));
        return;
      }
      // APPROVED / PLAYED / HIDDEN / PENDING — 모든 곳에서 빠짐
      setQueue((prev) => prev.filter((r) => r.id !== row.id));
      setPlaying((prev) => (prev?.id === row.id ? null : prev));
      setPlayingGroup((prev) => prev.filter((r) => r.id !== row.id));
    };

    const ch = supa
      .channel(`fm-queue-${sessionId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "tori_fm_requests",
          filter: `session_id=eq.${sessionId}`,
        } as never,
        ((payload: { new: FmRequestRow }) => {
          applyRow(payload.new);
        }) as never
      )
      .on(
        "postgres_changes" as never,
        {
          event: "UPDATE",
          schema: "public",
          table: "tori_fm_requests",
          filter: `session_id=eq.${sessionId}`,
        } as never,
        ((payload: { new: FmRequestRow }) => {
          applyRow(payload.new);
        }) as never
      )
      .subscribe();

    return () => {
      void supa.removeChannel(ch);
    };
  }, [sessionId]);

  /* ---------------- 액션 핸들러 ---------------- */

  const onUnqueue = useCallback((id: string) => {
    setBusyId(id);
    startTransition(async () => {
      try {
        await unqueueRequestAction(id);
        setQueue((prev) => prev.filter((r) => r.id !== id));
      } catch (e) {
        alert(e instanceof Error ? e.message : "큐에서 빼지 못했어요");
      } finally {
        setBusyId(null);
      }
    });
  }, []);

  const onReorder = useCallback((id: string, direction: "up" | "down") => {
    setBusyId(id);
    startTransition(async () => {
      try {
        await reorderQueueAction(id, direction);
        // Realtime UPDATE 가 두 row position 변경을 받아서 자동 정렬됨
      } catch (e) {
        alert(e instanceof Error ? e.message : "이동에 실패했어요");
      } finally {
        setBusyId(null);
      }
    });
  }, []);

  const onPlayNext = useCallback(() => {
    setBusyMain("next");
    startTransition(async () => {
      try {
        await playNextFromQueueAction(sessionId);
        // Realtime UPDATE 가 PLAYING row 와 PLAYED row 를 모두 반영
      } catch (e) {
        alert(e instanceof Error ? e.message : "다음 곡 재생에 실패했어요");
      } finally {
        setBusyMain(null);
      }
    });
  }, [sessionId]);

  const onStop = useCallback(() => {
    if (!window.confirm("현재 재생 중인 곡을 멈출까요?")) return;
    setBusyMain("stop");
    startTransition(async () => {
      try {
        await stopPlayingAction(sessionId);
        setPlaying(null);
        setPlayingGroup([]);
      } catch (e) {
        alert(e instanceof Error ? e.message : "정지에 실패했어요");
      } finally {
        setBusyMain(null);
      }
    });
  }, [sessionId]);

  const canPlayNext = queue.length > 0 || !!playing;
  const nextLabel = playing
    ? queue.length > 0
      ? "▶ 다음 곡 재생"
      : "⏹ 현재 곡 끝내기"
    : queue.length > 0
      ? "▶ 첫 곡 재생"
      : "큐가 비어있어요";

  return (
    <section
      aria-label="방송 대기 큐"
      className="relative isolate flex h-full flex-col rounded-2xl border-l-[5px] border-l-teal-300/70 border-y border-y-white/10 border-r border-r-white/10 bg-[#101935] p-4 text-white shadow-md shadow-teal-500/10 md:p-5"
    >
      {/* 외곽 글로우 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-1 -z-10 rounded-3xl bg-teal-500/[0.06] blur-2xl"
      />
      {/* 헤더 */}
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-teal-100">
          <span aria-hidden>📻</span>
          <span>방송 대기 큐</span>
          <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-bold text-teal-200 ring-1 ring-teal-400/40">
            대기 {queue.length}
          </span>
        </h2>
        <p className="hidden text-[11px] text-teal-200/60 md:block">
          [▶ 다음 곡] 으로 큐 첫 항목을 NOW PLAYING 으로 보내요
        </p>
      </header>

      {/* NOW PLAYING — 있으면 큰 카드. 사연 모드는 warm 톤 미니버전.
          compact 모드에선 숨김 (메인 LiveStudioPanel 와 중복 회피). */}
      {!compact && playing && (() => {
        const isStoryMode =
          playing.kind === "story_only" ||
          (!playing.song_title?.trim() && !!playing.story?.trim());

        if (isStoryMode) {
          return (
            <div className="mb-3 rounded-2xl border border-violet-300/40 bg-gradient-to-br from-violet-900/40 via-purple-900/30 to-amber-900/30 p-4 shadow-lg shadow-violet-500/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/95 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-md shadow-violet-500/40">
                  <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                  💌 사연 읽는 중
                </span>
                <button
                  type="button"
                  onClick={onStop}
                  disabled={busyMain !== null}
                  className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-[11px] font-bold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
                >
                  {busyMain === "stop" ? "…" : "⏹ 정지"}
                </button>
              </div>
              {playing.story && (
                <blockquote className="mt-3 border-l-4 border-amber-300/50 pl-4 text-base font-semibold leading-relaxed text-amber-100 line-clamp-3">
                  <span aria-hidden className="mr-1 text-amber-300/70">
                    ❝
                  </span>
                  {playing.story}
                </blockquote>
              )}
              <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-violet-200 ring-1 ring-violet-400/30">
                  🕶 {authorLabel(playing) || "익명의 청취자"}
                </span>
                {playing.heart_count > 0 && (
                  <span className="text-rose-300">❤ {playing.heart_count}</span>
                )}
              </p>
            </div>
          );
        }

        // 같은 곡 묶음 사연 — story 비어있는 row 는 카드에서 제외 (skip).
        const filledGroup = playingGroup.filter(
          (r) => (r.story ?? "").trim().length > 0
        );
        const isBundle = filledGroup.length >= 2;

        return (
          <div className="mb-3 rounded-2xl border border-rose-400/40 bg-gradient-to-br from-rose-500/20 via-rose-500/10 to-amber-500/10 p-4 shadow-lg shadow-rose-500/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/95 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-md shadow-rose-500/40">
                <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                NOW PLAYING
                {isBundle && (
                  <span className="ml-1.5 rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider">
                    묶음 {filledGroup.length}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={onStop}
                disabled={busyMain !== null}
                className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-[11px] font-bold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
              >
                {busyMain === "stop" ? "…" : "⏹ 정지"}
              </button>
            </div>
            <h3 className="mt-2 break-words text-lg font-extrabold tracking-tight text-amber-100">
              {songTitleOrFallback(playing)}
            </h3>
            {playing.artist && (
              <p className="mt-0.5 text-sm font-semibold text-amber-200/80">
                — {playing.artist}
              </p>
            )}

            {isBundle ? (
              <ul className="scroll-dark mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                {filledGroup.map((r) => {
                  const label = authorLabel(r) || "익명의 청취자";
                  return (
                    <li
                      key={r.id}
                      className="border-l-2 border-amber-300/40 pl-3"
                    >
                      <p className="text-[13px] leading-relaxed text-white/95">
                        <span aria-hidden className="mr-0.5 text-amber-300/70">
                          ❝
                        </span>
                        {r.story}
                        <span aria-hidden className="ml-0.5 text-amber-300/70">
                          ❞
                        </span>
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-amber-200/70">
                        <span>
                          — {label}
                        </span>
                        <span className="text-amber-200/50">
                          · {fmtRelative(r.created_at)}
                        </span>
                        {r.heart_count > 0 && (
                          <span className="text-rose-300">
                            ❤ {r.heart_count}
                          </span>
                        )}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <>
                {playing.story && (
                  <blockquote className="mt-2 line-clamp-2 border-l-2 border-amber-300/50 pl-3 text-[12px] leading-relaxed text-white/90">
                    &ldquo;{playing.story}&rdquo;
                  </blockquote>
                )}
                {(authorLabel(playing) || playing.heart_count > 0) && (
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    {authorLabel(playing) && (
                      <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-400/30">
                        {playing.is_anonymous ? "🕶" : "👶"} {authorLabel(playing)}
                      </span>
                    )}
                    {playing.heart_count > 0 && (
                      <span className="text-rose-300">❤ {playing.heart_count}</span>
                    )}
                  </p>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* 큐 리스트 */}
      <div className="scroll-dark flex-1 overflow-y-auto pr-1">
        {queue.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-center text-xs text-white/55">
            큐가 비어있어요. 모더레이션에서{" "}
            <b className="text-amber-200">[📥 방송 큐에 추가]</b> 를 눌러주세요
          </p>
        ) : (
          <ul className="space-y-2">
            {queue.slice(0, 3).map((r, idx) => {
              const isFirst = idx === 0;
              const isBusy = busyId === r.id;
              const author = authorLabel(r);
              return (
                <li
                  key={r.id}
                  className={`rounded-2xl border p-3 backdrop-blur-md transition ${
                    isFirst
                      ? "border-amber-400/50 bg-amber-500/10 shadow-md shadow-amber-500/20"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {/* 순번 */}
                    <span
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                        isFirst
                          ? "bg-amber-400 text-[#0B1538]"
                          : "bg-white/10 text-white/80"
                      }`}
                      aria-label={`${idx + 1}번째 대기`}
                    >
                      {idx + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      {isFirst && (
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300">
                          👉 다음 곡
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-bold text-white/95">
                          🎵 {songTitleOrFallback(r)}
                        </span>
                        {r.artist && (
                          <span className="text-[12px] text-amber-200/80">
                            — {r.artist}
                          </span>
                        )}
                      </div>
                      {r.story?.trim() && (
                        <p className="mt-1 line-clamp-1 text-[11px] italic text-white/70">
                          &ldquo;{r.story.trim()}&rdquo;
                        </p>
                      )}
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/55">
                        {author && (
                          <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200/90 ring-1 ring-emerald-400/20">
                            {r.is_anonymous ? "🕶" : "👶"} {author}
                          </span>
                        )}
                        {r.heart_count > 0 && (
                          <span className="text-rose-300">
                            ❤ {r.heart_count}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* 액션 버튼들 */}
                    <div className="flex flex-shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => onReorder(r.id, "up")}
                        disabled={isBusy || idx === 0}
                        aria-label="위로 이동"
                        className="rounded-lg border border-white/15 bg-white/[0.05] px-2 py-0.5 text-[11px] font-bold text-white/80 transition hover:bg-white/10 disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => onReorder(r.id, "down")}
                        disabled={isBusy || idx === queue.length - 1}
                        aria-label="아래로 이동"
                        className="rounded-lg border border-white/15 bg-white/[0.05] px-2 py-0.5 text-[11px] font-bold text-white/80 transition hover:bg-white/10 disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUnqueue(r.id)}
                      disabled={isBusy}
                      aria-label="큐에서 빼기"
                      className="flex-shrink-0 self-start rounded-lg border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-[11px] font-bold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
            {queue.length > 3 && (
              <li className="rounded-2xl border border-dashed border-white/15 px-3 py-2 text-center text-[11px] text-white/55">
                ··· 외 {queue.length - 3}곡 더 대기 중
              </li>
            )}
          </ul>
        )}
      </div>

      {/* 메인 CTA */}
      <div className="mt-3">
        <button
          type="button"
          onClick={onPlayNext}
          disabled={!canPlayNext || busyMain !== null}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 py-3 text-sm font-extrabold text-[#0B1538] shadow-lg shadow-amber-400/30 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none active:scale-[0.99]"
        >
          {busyMain === "next" ? "처리 중…" : nextLabel}
        </button>
      </div>
    </section>
  );
}
