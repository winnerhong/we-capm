"use client";

// RequestModerationList — 즉석 신청곡 모더레이션 큐 (DJ 관점)
//  - Realtime: tori_fm_requests session_id=? 구독
//  - PENDING 만 리스트에 표시 (승인/숨김/플레이는 즉시 제거)
//  - 같은 song_title 3회 이상 → 🔥 N명 신청 배지
//  - 새 PENDING INSERT 시 펄스 애니메이션 (2초간)

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  approveRequestAction,
  hideRequestAction,
  markRequestPlayedAction,
} from "@/lib/tori-fm/actions";
import type { FmRequestRow } from "@/lib/tori-fm/types";
import { usePanelExpand, PanelExpandButton } from "./use-panel-expand";

interface Props {
  sessionId: string;
  initialPending: FmRequestRow[];
}

const PULSE_MS = 2000;
const HOT_THRESHOLD = 3;

function fmtAgo(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (s < 60) return `${s}초 전`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  return `${h}시간 전`;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "").trim();
}

export function RequestModerationList({
  sessionId,
  initialPending,
}: Props) {
  const [items, setItems] = useState<FmRequestRow[]>(initialPending);
  const [pulseIds, setPulseIds] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [now, setNow] = useState<number>(() => Date.now());
  const { expanded, toggle, panelClassName } = usePanelExpand();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  // Sync from SSR on revalidate
  useEffect(() => {
    setItems(initialPending);
  }, [initialPending]);

  // Realtime subscription
  useEffect(() => {
    if (!sessionId) return;
    const supa = createClient();
    const ch = supa
      .channel(`dj-requests-${sessionId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "tori_fm_requests",
          filter: `session_id=eq.${sessionId}`,
        } as never,
        ((payload: { new: FmRequestRow }) => {
          const row = payload.new;
          if (row.status !== "PENDING") return;
          setItems((prev) =>
            prev.some((r) => r.id === row.id) ? prev : [row, ...prev]
          );
          // 펄스
          setPulseIds((prev) => {
            const nx = new Set(prev);
            nx.add(row.id);
            return nx;
          });
          setTimeout(() => {
            setPulseIds((prev) => {
              const nx = new Set(prev);
              nx.delete(row.id);
              return nx;
            });
          }, PULSE_MS);
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
          const row = payload.new;
          setItems((prev) => {
            if (row.status !== "PENDING") {
              return prev.filter((r) => r.id !== row.id);
            }
            const has = prev.some((r) => r.id === row.id);
            if (!has) return [row, ...prev];
            return prev.map((r) => (r.id === row.id ? row : r));
          });
        }) as never
      )
      .subscribe();
    return () => {
      supa.removeChannel(ch);
    };
  }, [sessionId]);

  // 인기곡 집계 — normalized title 카운트
  const hotCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of items) {
      const key = normalize(r.song_title);
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [items]);

  const onAction = useCallback(
    (
      id: string,
      kind: "APPROVE" | "HIDE" | "PLAY",
      needConfirm: boolean = false
    ) => {
      if (needConfirm) {
        const ok = window.confirm(
          kind === "HIDE"
            ? "이 신청곡을 숨길까요? 전광판과 앱에서 사라져요."
            : "진행할까요?"
        );
        if (!ok) return;
      }
      setPendingId(id);
      startTransition(async () => {
        try {
          if (kind === "APPROVE") await approveRequestAction(id);
          else if (kind === "HIDE") await hideRequestAction(id);
          else await markRequestPlayedAction(id);
          // Realtime UPDATE 가 리스트에서 제거 처리
          setItems((prev) => prev.filter((r) => r.id !== id));
        } catch (e) {
          alert(e instanceof Error ? e.message : "처리에 실패했어요");
        } finally {
          setPendingId(null);
        }
      });
    },
    []
  );

  return (
    <section
      aria-label="신청곡 모더레이션 큐"
      className={`flex flex-col rounded-3xl border border-white/10 bg-gradient-to-br from-[#1B2B3A] via-[#26394C] to-[#1B2B3A] p-4 text-white shadow-xl md:p-5 ${panelClassName}`}
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-amber-100">
          <span aria-hidden>🎵</span>
          <span>즉석 신청곡</span>
          <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300 ring-1 ring-rose-400/40">
            대기 {items.length}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <p className="hidden text-[11px] text-amber-200/60 sm:block">
            승인하면 대기 큐로, 숨기면 사라져요
          </p>
          <PanelExpandButton expanded={expanded} onToggle={toggle} tone="rose" />
        </div>
      </header>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-white/5 bg-black/30 p-4 text-center text-xs text-white/50 backdrop-blur-sm">
          아직 접수된 신청곡이 없어요
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => {
            const key = normalize(r.song_title);
            const count = hotCounts.get(key) ?? 0;
            const isHot = count >= HOT_THRESHOLD;
            const isPulse = pulseIds.has(r.id);
            const isBusy = pendingId === r.id;
            const storyPrefix = (r.story ?? "").slice(0, 50);

            return (
              <li
                key={r.id}
                className={`rounded-2xl border p-3 backdrop-blur-sm transition ${
                  isPulse
                    ? "animate-pulse border-amber-400/60 bg-amber-500/15"
                    : isHot
                      ? "border-rose-400/40 bg-rose-500/10"
                      : "border-white/10 bg-black/30"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-bold text-white">
                        🎵 {r.song_title}
                      </span>
                      {r.artist && (
                        <span className="text-[12px] text-amber-200/70">
                          — {r.artist}
                        </span>
                      )}
                      {isHot && (
                        <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md shadow-rose-500/40">
                          🔥 {count}명 신청
                        </span>
                      )}
                    </div>
                    {storyPrefix && (
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-white/70">
                        &ldquo;{storyPrefix}
                        {(r.story?.length ?? 0) > 50 ? "…" : ""}&rdquo;
                      </p>
                    )}
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
                      {r.child_name && (
                        <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-400/30">
                          👶 {r.child_name}
                        </span>
                      )}
                      <span>🕐 {fmtAgo(r.created_at, now)}</span>
                      {r.heart_count > 0 && (
                        <span className="text-rose-300">
                          ❤ {r.heart_count}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onAction(r.id, "APPROVE")}
                    disabled={isBusy}
                    className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {isBusy ? "…" : "✅ 승인"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onAction(r.id, "PLAY")}
                    disabled={isBusy}
                    className="rounded-xl bg-amber-400 px-3 py-1.5 text-xs font-bold text-[#1B2B3A] shadow-md shadow-amber-400/30 transition hover:bg-amber-300 disabled:opacity-50"
                  >
                    ▶ 방송에 올리기
                  </button>
                  <button
                    type="button"
                    onClick={() => onAction(r.id, "HIDE", true)}
                    disabled={isBusy}
                    className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    🙈 숨김
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
