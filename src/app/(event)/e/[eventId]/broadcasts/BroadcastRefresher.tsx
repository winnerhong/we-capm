"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * mission_broadcasts 의 기관 단위 변경을 감지해 router.refresh() 트리거.
 * 30s 폴링 폴백 포함.
 */
export function BroadcastRefresher({ orgId }: { orgId: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!orgId) return;
    const supa = createClient();
    const ch = supa
      .channel(`broadcasts-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mission_broadcasts",
          filter: `triggered_by_org_id=eq.${orgId}`,
        },
        () => router.refresh()
      )
      .subscribe();

    const timer = setInterval(() => router.refresh(), 30_000);

    return () => {
      supa.removeChannel(ch);
      clearInterval(timer);
    };
  }, [orgId, router]);

  return null;
}
