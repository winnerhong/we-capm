"use client";

/**
 * OrgPresenceCounter
 * ------------------
 * 관제실 쪽에서 사용. `org-presence:{orgId}` 채널을 구독하여
 * 현재 접속중인 unique 사용자 수를 계산하고 render prop 으로 전달한다.
 *
 * - 초기에는 `initialFallback` (서버가 계산한 오늘 활동 숫자 등)을 노출.
 * - Presence sync 이벤트가 한 번이라도 오면 isLive=true 로 전환되며
 *   실시간 count 로 교체된다.
 * - Presence 연결이 실패하거나 아직 sync 전이면 fallback 유지.
 *
 * Dedupe 전략
 * -----------
 * presenceState 의 최상위 key 는 channel 을 만들 때 지정한 `presence.key`.
 * Tracker 쪽에서 key 로 userId 를 넣으므로, 동일 유저가 탭을 여러 개 열어도
 * key 가 겹쳐 배열에만 쌓인다 → `Object.keys(state).length` 가 곧 고유 사용자 수.
 */

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  orgId: string;
  /** presence 아직 붙기 전 초기값 (예: todayActiveParticipants) */
  initialFallback: number;
  render: (count: number, isLive: boolean) => ReactNode;
};

export function OrgPresenceCounter({ orgId, initialFallback, render }: Props) {
  const [count, setCount] = useState(0);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!orgId) return;

    const supa = createClient();
    // viewer 는 track 하지 않음 — 관전자이므로 stat 에 포함 X.
    // 고유 viewer key 로 중복 생성 시 노이즈 방지.
    const channel = supa.channel(`org-presence:${orgId}`, {
      config: {
        presence: { key: `viewer:${Date.now()}:${Math.random().toString(36).slice(2, 8)}` },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        // key 기준 unique — viewer:* 로 시작하는 key 는 관전자라 제외
        const uniqueParticipantKeys = Object.keys(state).filter(
          (k) => !k.startsWith("viewer:")
        );
        setCount(uniqueParticipantKeys.length);
        setIsLive(true);
      })
      .subscribe();

    return () => {
      void supa.removeChannel(channel);
    };
  }, [orgId]);

  return <>{render(isLive ? count : initialFallback, isLive)}</>;
}
