"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function EntryRealtime({ eventId }: { eventId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`entry-${eventId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "event_registrations",
      }, (payload) => {
        const row = payload.new as { event_id: string; status: string };
        if (row.event_id === eventId && row.status === "ENTERED") {
          router.refresh();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId, router]);

  return (
    <div className="flex items-center gap-2 text-xs text-green-600">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      실시간 업데이트 중
    </div>
  );
}
