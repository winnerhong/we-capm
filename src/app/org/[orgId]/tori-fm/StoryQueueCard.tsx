"use client";

// 호스트 전용 익명 사연 큐 카드 — 인기 사연 큐 (하트순).
//   - kind='story_only' + status IN (PENDING, APPROVED, QUEUED) row 만 표시
//   - 정렬: heart_count DESC, 같으면 created_at DESC
//   - 각 row: 사연 본문 / 익명 라벨 / ❤ 카운트 / 상태별 액션
//     · PENDING/APPROVED → [📥 큐에 추가]
//     · QUEUED           → [▲][▼] 위/아래
//   - Realtime: tori_fm_requests UPDATE/INSERT 구독 후 클라 측 필터.

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  queueRequestAction,
  reorderQueueAction,
} from "@/lib/tori-fm/actions";
import { anonLabelFromUserId, type FmRequestRow } from "@/lib/tori-fm/types";

interface Props {
  sessionId: string;
  /** story_only PENDING/APPROVED/QUEUED — 서버에서 사전 필터된 row */
  initialItems: FmRequestRow[];
}

const ACTIVE_STATUSES = new Set(["PENDING", "APPROVED", "QUEUED"]);

/** heart_count DESC, 같으면 created_at DESC. */
function sortByHearts(arr: FmRequestRow[]): FmRequestRow[] {
  return [...arr].sort((a, b) => {
    const ah = a.heart_count ?? 0;
    const bh = b.heart_count ?? 0;
    if (bh !== ah) return bh - ah;
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StoryQueueCard({ sessionId, initialItems }: Props) {
  const [items, setItems] = useState<FmRequestRow[]>(initialItems);
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!sessionId) return;
    const supa = createClient();

    type RealtimePayload = {
      eventType?: "INSERT" | "UPDATE" | "DELETE";
      new?: FmRequestRow;
      old?: FmRequestRow;
    };

    const handle = (payload: RealtimePayload) => {
      const row = payload.new;
      if (!row || !row.id) return;
      // story_only + active status 만 유지
      const keep =
        row.kind === "story_only" && ACTIVE_STATUSES.has(row.status);

      setItems((prev) => {
        const idx = prev.findIndex((r) => r.id === row.id);
        if (!keep) {
          return idx === -1 ? prev : prev.filter((r) => r.id !== row.id);
        }
        if (idx === -1) {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            return [row, ...prev];
          }
          return prev;
        }
        const copy = prev.slice();
        copy[idx] = row;
        return copy;
      });
    };

    const channel = supa
      .channel(`fm-story-queue-${sessionId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "tori_fm_requests",
          filter: `session_id=eq.${sessionId}`,
        } as never,
        handle as never
      )
      .subscribe();

    return () => {
      supa.removeChannel(channel);
    };
  }, [sessionId]);

  const sorted = useMemo(() => sortByHearts(items), [items]);

  const setPending = useCallback((id: string, on: boolean) => {
    setPendingIds((prev) => {
      if (on) return { ...prev, [id]: true };
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }, []);

  const handleQueue = useCallback(
    (id: string) => {
      if (pendingIds[id]) return;
      setPending(id, true);
      startTransition(async () => {
        try {
          await queueRequestAction(id);
        } catch (err) {
          console.error("[StoryQueueCard] queue failed", err);
        } finally {
          setPending(id, false);
        }
      });
    },
    [pendingIds, setPending]
  );

  const handleReorder = useCallback(
    (id: string, direction: "up" | "down") => {
      if (pendingIds[id]) return;
      setPending(id, true);
      startTransition(async () => {
        try {
          await reorderQueueAction(id, direction);
        } catch (err) {
          console.error("[StoryQueueCard] reorder failed", err);
        } finally {
          setPending(id, false);
        }
      });
    },
    [pendingIds, setPending]
  );

  return (
    <section
      aria-label="인기 사연 큐"
      className="relative isolate rounded-2xl border-l-[5px] border-l-rose-300/70 border-y border-y-white/10 border-r border-r-white/10 bg-rose-950/25 p-4 text-white shadow-xl shadow-rose-500/10 backdrop-blur-md transition-shadow duration-200 ease-out hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-rose-500/20"
    >
      {/* 외곽 글로우 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-1 -z-10 rounded-3xl bg-rose-500/[0.06] blur-2xl"
      />
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-rose-100">
          📜 인기 사연 큐{" "}
          <span className="ml-0.5 text-[11px] font-normal text-rose-200/70">
            (하트순)
          </span>
        </h3>
        <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-100 ring-1 ring-rose-400/30">
          {sorted.length}건
        </span>
      </header>

      {sorted.length === 0 ? (
        <p className="mt-4 rounded-xl bg-white/5 p-4 text-center text-xs text-white/60">
          아직 익명 사연이 없어요
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sorted.map((r) => {
            const isPending = !!pendingIds[r.id];
            const isQueued = r.status === "QUEUED";
            return (
              <li
                key={r.id}
                className="rounded-2xl border border-l-4 border-l-violet-300/50 border-y-white/10 border-r-white/10 bg-white/[0.03] p-3 backdrop-blur-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    {/* 상태 뱃지 + 시간 */}
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      {r.status === "PENDING" && (
                        <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                          대기
                        </span>
                      )}
                      {r.status === "APPROVED" && (
                        <span className="rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">
                          ✓ 승인
                        </span>
                      )}
                      {r.status === "QUEUED" && (
                        <span className="rounded-full bg-violet-400/30 px-1.5 py-0.5 text-[10px] font-semibold text-violet-100">
                          📥 큐
                          {r.queue_position != null
                            ? ` #${r.queue_position}`
                            : ""}
                        </span>
                      )}
                      <span className="text-[10px] text-white/40">
                        {fmtTime(r.created_at)}
                      </span>
                    </div>

                    <blockquote className="line-clamp-2 border-l-2 border-violet-300/60 pl-3 text-[13px] leading-relaxed text-white/95">
                      {r.story?.trim() || "(사연 없음)"}
                    </blockquote>

                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] text-amber-200/80">
                        — {r.is_anonymous
                          ? anonLabelFromUserId(r.user_id)
                          : (r.child_name?.trim() || "보호자")}
                      </span>
                      <span className="text-[10px] font-bold text-pink-300">
                        ❤ {r.heart_count ?? 0}
                      </span>
                    </div>
                  </div>

                  {/* 액션 — PENDING/APPROVED → [큐 추가] / QUEUED → [▲][▼] */}
                  <div className="flex flex-col items-stretch gap-1">
                    {!isQueued ? (
                      <button
                        type="button"
                        onClick={() => handleQueue(r.id)}
                        disabled={isPending}
                        className="rounded-lg bg-amber-400 px-2.5 py-1.5 text-[11px] font-bold text-[#0B1538] shadow-md shadow-amber-400/30 transition hover:bg-amber-300 active:scale-95 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-300"
                        aria-label="큐에 추가"
                      >
                        📥 큐
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleReorder(r.id, "up")}
                          disabled={isPending}
                          className="flex h-7 w-9 items-center justify-center rounded-md border border-white/15 bg-white/[0.06] text-[12px] text-white/85 transition hover:bg-white/[0.12] active:scale-95 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-violet-300"
                          aria-label="위로 이동"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReorder(r.id, "down")}
                          disabled={isPending}
                          className="flex h-7 w-9 items-center justify-center rounded-md border border-white/15 bg-white/[0.06] text-[12px] text-white/85 transition hover:bg-white/[0.12] active:scale-95 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-violet-300"
                          aria-label="아래로 이동"
                        >
                          ▼
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
