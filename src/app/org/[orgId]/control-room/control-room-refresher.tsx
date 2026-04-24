"use client";

// 관제실 Realtime refresher.
// - tori_fm_sessions (org 필터), tori_fm_requests, tori_fm_reactions,
//   chat_messages, mission_submissions 변경을 하나의 채널로 구독.
// - 어떤 이벤트든 들어오면 1500ms 디바운스 후 router.refresh().
// - Fallback: 15초마다 router.refresh() (웹소켓 끊어져도 최신성 유지).
// - 참고 패턴: src/app/(user)/tori-fm/LiveFmRefresher.tsx

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  orgId: string;
  /** fallback polling ms. 0 이면 비활성. 기본 15000. */
  pollMs?: number;
  /** 이벤트 폭주 시 debounce ms. 기본 1500. */
  debounceMs?: number;
};

export function ControlRoomRefresher({
  orgId,
  pollMs = 15_000,
  debounceMs = 1500,
}: Props) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!orgId) return;
    const supa = createClient();
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const refreshNow = () => {
      if (!cancelled) router.refresh();
    };

    const scheduleRefresh = () => {
      if (cancelled) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(refreshNow, debounceMs);
    };

    const ch = supa
      .channel(`control-room-${orgId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "tori_fm_sessions",
          filter: `org_id=eq.${orgId}`,
        } as never,
        scheduleRefresh as never
      )
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "tori_fm_requests",
        } as never,
        scheduleRefresh as never
      )
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "tori_fm_reactions",
        } as never,
        scheduleRefresh as never
      )
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
        } as never,
        scheduleRefresh as never
      )
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "mission_submissions",
        } as never,
        scheduleRefresh as never
      )
      .subscribe();

    if (pollMs && pollMs > 0) {
      pollTimer = setInterval(refreshNow, pollMs);
    }

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pollTimer) clearInterval(pollTimer);
      supa.removeChannel(ch);
    };
  }, [orgId, pollMs, debounceMs, router]);

  return null;
}
