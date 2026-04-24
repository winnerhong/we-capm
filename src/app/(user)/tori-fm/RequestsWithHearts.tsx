"use client";

// 토리FM 오늘 신청곡 + 하트 — Realtime(INSERT/UPDATE) 수신 + optimistic heart toggle.

import { useCallback, useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { toggleRequestHeartAction } from "@/lib/tori-fm/actions";
import type { FmRequestRow } from "@/lib/tori-fm/types";

type Props = {
  sessionId: string;
  initialRequests: FmRequestRow[];
  heartedIds: string[];
};

export function RequestsWithHearts({
  sessionId,
  initialRequests,
  heartedIds,
}: Props) {
  const [requests, setRequests] = useState<FmRequestRow[]>(initialRequests);
  const [hearted, setHearted] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const id of heartedIds) map[id] = true;
    return map;
  });
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
      if (row.status === "HIDDEN") {
        setRequests((prev) => prev.filter((r) => r.id !== row.id));
        return;
      }
      setRequests((prev) => {
        const idx = prev.findIndex((r) => r.id === row.id);
        if (idx === -1) {
          if (payload.eventType === "INSERT") {
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
      .channel(`tori-fm-requests-${sessionId}`)
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

  const handleHeart = useCallback(
    (requestId: string) => {
      if (pendingIds[requestId]) return;

      const wasHearted = !!hearted[requestId];
      // optimistic UI
      setHearted((prev) => ({ ...prev, [requestId]: !wasHearted }));
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                heart_count: Math.max(
                  0,
                  (r.heart_count ?? 0) + (wasHearted ? -1 : 1)
                ),
              }
            : r
        )
      );
      setPendingIds((prev) => ({ ...prev, [requestId]: true }));

      startTransition(async () => {
        try {
          const result = await toggleRequestHeartAction(requestId);
          // 서버값으로 보정
          setHearted((prev) => ({ ...prev, [requestId]: result.hearted }));
        } catch {
          // 롤백
          setHearted((prev) => ({ ...prev, [requestId]: wasHearted }));
          setRequests((prev) =>
            prev.map((r) =>
              r.id === requestId
                ? {
                    ...r,
                    heart_count: Math.max(
                      0,
                      (r.heart_count ?? 0) + (wasHearted ? 1 : -1)
                    ),
                  }
                : r
            )
          );
        } finally {
          setPendingIds((prev) => {
            const copy = { ...prev };
            delete copy[requestId];
            return copy;
          });
        }
      });
    },
    [hearted, pendingIds]
  );

  const visible = requests.filter((r) => r.status !== "HIDDEN");

  return (
    <section className="rounded-3xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-[#2D5A3D]">
        📮 오늘 들어온 신청곡
      </h3>
      {visible.length === 0 ? (
        <p className="mt-4 rounded-xl bg-[#FFF8F0] p-4 text-center text-xs text-[#6B6560]">
          아직 신청곡이 없어요. 첫 신청곡을 보내 보세요!
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {visible.map((r) => {
            const isHearted = !!hearted[r.id];
            const isPending = !!pendingIds[r.id];
            return (
              <li
                key={r.id}
                className="group rounded-2xl border border-[#D4E4BC]/50 bg-[#FFF8F0] p-3 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#2D5A3D]">
                      {r.song_title}
                      {r.artist && (
                        <span className="ml-1 text-xs font-normal text-[#6B6560]">
                          — {r.artist}
                        </span>
                      )}
                    </p>
                    {r.story && (
                      <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-[#3d3833]">
                        “{r.story}”
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-[#6B6560]">
                      {r.child_name ? `${r.child_name} ` : ""}
                      {r.status === "PLAYED"
                        ? "· 방송됨"
                        : r.status === "APPROVED"
                        ? "· 승인됨"
                        : "· 대기중"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleHeart(r.id)}
                    disabled={isPending}
                    aria-label={isHearted ? "하트 취소" : "하트 누르기"}
                    aria-pressed={isHearted}
                    className={`flex min-h-[44px] min-w-[56px] flex-none flex-col items-center justify-center rounded-xl border transition active:scale-95 ${
                      isHearted
                        ? "border-pink-300 bg-pink-100 text-pink-600"
                        : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-pink-200 hover:bg-pink-50"
                    } disabled:opacity-60`}
                  >
                    <span className="text-lg leading-none" aria-hidden>
                      {isHearted ? "❤" : "♡"}
                    </span>
                    <span className="mt-0.5 text-[10px] font-bold">
                      {r.heart_count ?? 0}
                    </span>
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
