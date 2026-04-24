"use client";

// 토리FM 화면(참가자용/공용 전광판) 공용 Realtime refresher.
//  - tori_fm_sessions 또는 mission_radio_queue 의 변화가 감지되면
//    router.refresh() 로 SSR 재평가 트리거.
//  - RLS 는 public SELECT 허용된 테이블이라고 가정(큐/세션은 조회 공개).
//  - 실패(웹소켓 거부/네트워크) 시 조용히 폴링(20s) fallback.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  orgId: string;
  /** fallback polling interval(ms). 0 이면 비활성 */
  pollMs?: number;
};

export function LiveFmRefresher({ orgId, pollMs = 20_000 }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!orgId) return;
    const supa = createClient();
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const refresh = () => {
      if (!cancelled) router.refresh();
    };

    const ch = supa
      .channel(`tori-fm-${orgId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "tori_fm_sessions",
          filter: `org_id=eq.${orgId}`,
        } as never,
        refresh as never
      )
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "mission_radio_queue",
          filter: `org_id=eq.${orgId}`,
        } as never,
        refresh as never
      )
      .subscribe();

    // Fallback polling — 구독이 거부되더라도 최소한의 최신성 유지
    if (pollMs && pollMs > 0) {
      pollTimer = setInterval(refresh, pollMs);
    }

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      supa.removeChannel(ch);
    };
  }, [orgId, pollMs, router]);

  return null;
}
