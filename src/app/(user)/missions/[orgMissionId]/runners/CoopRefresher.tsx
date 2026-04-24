"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * mission_coop_sessions 의 특정 session 변경을 감지해 router.refresh() 트리거.
 * realtime 구독 + 3초 폴링 (realtime 설정 누락 시 대비).
 */
export function CoopRefresher({ sessionId }: { sessionId: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!sessionId) return;
    const supa = createClient();
    const ch = supa
      .channel(`coop-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mission_coop_sessions",
          filter: `id=eq.${sessionId}`,
        },
        () => router.refresh()
      )
      .subscribe();

    const timer = setInterval(() => router.refresh(), 3000);

    return () => {
      supa.removeChannel(ch);
      clearInterval(timer);
    };
  }, [sessionId, router]);

  return null;
}
