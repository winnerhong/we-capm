"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RealtimeRefresh({ table, event = "*" }: { table: string; event?: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`rt-${table}-${Date.now()}`)
      .on(
        "postgres_changes" as "system",
        { event, schema: "public", table } as unknown as { event: "system" },
        () => { router.refresh(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [table, event, router]);

  return null;
}
