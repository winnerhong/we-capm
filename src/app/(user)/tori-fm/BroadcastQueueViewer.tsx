"use client";

// 참가자용 방송 대기 큐 — read-only 뷰어.
//  - 호스트의 BroadcastQueueCard 와 같은 데이터(QUEUED + PLAYING) 를 보여주되,
//    재생/순서변경/삭제 같은 호스트 액션은 모두 제외.
//  - "내 신청이 큐에 있나? 몇 번째지?" 라는 참가자 호기심을 충족.
//  - Realtime: tori_fm_requests UPDATE/INSERT 구독 → 큐 즉시 반영.

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  anonLabelFromUserId,
  withFamilySuffix,
  type FmRequestRow,
} from "@/lib/tori-fm/types";

interface Props {
  sessionId: string;
  initialQueued: FmRequestRow[];
  /** 강조용 — 본인 user_id 면 카드에 "내 신청" 배지. */
  myUserId?: string;
  /** user_id → 반 이름. "햇살반 OOO 가족" prefix 표시용. */
  classByUser?: Record<string, string>;
}

function sortByQueuePos(arr: FmRequestRow[]): FmRequestRow[] {
  return [...arr].sort((a, b) => {
    const pa = a.queue_position ?? Number.MAX_SAFE_INTEGER;
    const pb = b.queue_position ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function authorLabel(
  r: FmRequestRow,
  classByUser: Record<string, string>
): string {
  if (r.is_anonymous) return anonLabelFromUserId(r.user_id);
  const fam = withFamilySuffix(r.child_name);
  if (!fam) return "익명의 청취자";
  const cn = (classByUser[r.user_id] ?? "").trim();
  return cn ? `${cn} ${fam}` : fam;
}

export function BroadcastQueueViewer({
  sessionId,
  initialQueued,
  myUserId,
  classByUser = {},
}: Props) {
  const [queue, setQueue] = useState<FmRequestRow[]>(() =>
    sortByQueuePos(initialQueued)
  );

  useEffect(() => {
    setQueue(sortByQueuePos(initialQueued));
  }, [initialQueued]);

  const applyRow = useCallback((row: FmRequestRow) => {
    setQueue((prev) => {
      const filtered = prev.filter((r) => r.id !== row.id);
      if (row.status === "QUEUED") {
        return sortByQueuePos([...filtered, row]);
      }
      // QUEUED 아닌 상태로 전환된 경우 큐에서 제거
      return filtered;
    });
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const supa = createClient();
    const channel = supa
      .channel(`fm-queue-viewer-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tori_fm_requests",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as FmRequestRow | null;
          if (!row) return;
          applyRow(row);
        }
      )
      .subscribe();
    return () => {
      supa.removeChannel(channel);
    };
  }, [sessionId, applyRow]);

  if (queue.length === 0) {
    return (
      <section
        aria-label="방송 대기 큐"
        className="rounded-2xl border-l-[5px] border-l-amber-300/70 border-y border-y-white/10 border-r border-r-white/10 bg-[#101935] p-4 text-white shadow-md shadow-amber-500/10"
      >
        <header className="mb-2 flex items-center gap-2">
          <span aria-hidden>📻</span>
          <h3 className="text-sm font-bold text-amber-100">방송 대기 큐</h3>
        </header>
        <p className="rounded-xl bg-white/5 p-3 text-center text-xs text-white/60">
          아직 대기 중인 곡이 없어요
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="방송 대기 큐"
      className="rounded-2xl border-l-[5px] border-l-amber-300/70 border-y border-y-white/10 border-r border-r-white/10 bg-[#101935] p-4 text-white shadow-md shadow-amber-500/10"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-amber-100">
          <span aria-hidden>📻</span>
          방송 대기 큐
          <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-200 ring-1 ring-amber-400/40">
            대기 {queue.length}
          </span>
        </h3>
        <span className="text-[10px] text-white/55">곧 방송될 순서</span>
      </header>

      <ul className="space-y-1.5">
        {queue.slice(0, 3).map((r, idx) => {
          const isMine = myUserId && r.user_id === myUserId;
          const isNext = idx === 0;
          return (
            <li
              key={r.id}
              className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${
                isNext
                  ? "border-amber-400/50 bg-amber-500/15"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <span
                aria-label={isNext ? "다음 곡" : `${idx}번째`}
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  isNext
                    ? "bg-amber-400 text-[#0B1538]"
                    : "bg-white/10 text-white/80"
                }`}
              >
                {isNext ? "▶" : idx}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {isNext && (
                    <span className="rounded-full bg-amber-400/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-100">
                      ▶ 다음 곡
                    </span>
                  )}
                  {isMine && (
                    <span className="rounded-full bg-emerald-500/25 px-1.5 py-0.5 text-[9px] font-bold text-emerald-200">
                      🙋 내 신청
                    </span>
                  )}
                </div>
                {/* 곡명 + 가수 — 한 줄에 두지 않고 wrap 허용해서 자모 잘림 방지. */}
                <p className="break-keep text-sm font-bold text-white/95">
                  🎵 {r.song_title?.trim() || "(사연만)"}
                  {r.artist && (
                    <span className="ml-1 break-keep text-[11px] font-normal text-amber-200/80">
                      — {r.artist}
                    </span>
                  )}
                </p>
                {r.story?.trim() && (
                  <p className="mt-0.5 line-clamp-1 text-[11px] italic text-white/70">
                    &ldquo;{r.story.trim()}&rdquo;
                  </p>
                )}
                <p className="mt-0.5 text-[10px] text-white/55">
                  {authorLabel(r, classByUser)}
                </p>
              </div>
            </li>
          );
        })}
        {queue.length > 3 && (
          <li className="rounded-xl border border-dashed border-white/15 px-3 py-2 text-center text-[11px] text-white/55">
            ··· 외 {queue.length - 3}곡 더 대기 중
          </li>
        )}
      </ul>
    </section>
  );
}
