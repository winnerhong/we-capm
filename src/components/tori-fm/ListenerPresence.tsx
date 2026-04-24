"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  orgId: string;
  /** 스타일 변형 — dark(screen 전광판용) or light(기관 제어실용) */
  variant?: "dark" | "light";
  /** 클라이언트 식별자. 없으면 랜덤 생성 — presence 트래킹용 */
  clientId?: string;
}

/**
 * Supabase Realtime Presence로 현재 토리FM 청취 중인 사람 수를 집계.
 * 채널: tori-fm-listeners-{orgId}
 *
 * - 마운트 시 channel.track()으로 자신을 presence에 등록
 * - presence sync 이벤트로 전체 인원 수 업데이트
 * - 언마운트 시 자동 unsubscribe
 *
 * Phase C - 가벼운 집계 (실제 음원 재생과 독립. 페이지를 열고 있는 사람 수).
 */
export function ListenerPresence({
  orgId,
  variant = "dark",
  clientId,
}: Props) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!orgId) return;

    const cid =
      clientId ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Math.random()).slice(2));

    const supabase = createClient();
    const channel = supabase.channel(`tori-fm-listeners-${orgId}`, {
      config: { presence: { key: cid } },
    });

    const recomputeCount = () => {
      const state = channel.presenceState();
      // state는 { [key]: Array<Presence> } 형태
      const keys = Object.keys(state);
      setCount(keys.length);
    };

    channel
      .on("presence", { event: "sync" }, recomputeCount)
      .on("presence", { event: "join" }, recomputeCount)
      .on("presence", { event: "leave" }, recomputeCount)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ joined_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, clientId]);

  if (count == null) return null;

  const colors =
    variant === "dark"
      ? "border-[#3a2f27] bg-[#0f0a07]/70 text-[#C4956A]"
      : "border-amber-400/30 bg-black/40 text-amber-200";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-sm md:text-sm ${colors}`}
      aria-live="polite"
    >
      <span aria-hidden>👂</span>
      <span className="tabular-nums">{count}</span>
      <span className="text-[10px] opacity-70 md:text-[11px]">청취 중</span>
    </span>
  );
}
