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

export type OrgPresence = {
  /** 접속중인 고유 참가자 수. */
  count: number;
  /** presence sync 가 한 번이라도 왔는지. */
  isLive: boolean;
  /** 접속중인 참가자 userId 집합. (viewer:* key 는 제외) */
  onlineIds: Set<string>;
};

/**
 * `org-presence:{orgId}` 채널을 **한 번만** 구독해 접속 현황을 반환한다.
 * count(수) + onlineIds(누구) 를 함께 제공 → 한 트리에서 이 훅은 orgId 당 1회만 호출할 것.
 * (같은 topic 을 두 번 구독하면 singleton 채널 충돌로 에러가 난다.)
 */
export function useOrgPresence(orgId: string): OrgPresence {
  const [state, setState] = useState<OrgPresence>(() => ({
    count: 0,
    isLive: false,
    onlineIds: new Set<string>(),
  }));

  useEffect(() => {
    if (!orgId) return;

    const supa = createClient();
    // viewer 는 track 하지 않음 — 관전자이므로 stat 에 포함 X.
    const channel = supa.channel(`org-presence:${orgId}`, {
      config: {
        presence: {
          key: `viewer:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const presence = channel.presenceState();
        // key 기준 unique — viewer:* 로 시작하는 key 는 관전자라 제외
        const keys = Object.keys(presence).filter(
          (k) => !k.startsWith("viewer:")
        );
        setState({
          count: keys.length,
          isLive: true,
          onlineIds: new Set(keys),
        });
      })
      .subscribe();

    return () => {
      void supa.removeChannel(channel);
    };
  }, [orgId]);

  return state;
}

export function OrgPresenceCounter({ orgId, initialFallback, render }: Props) {
  const { count, isLive } = useOrgPresence(orgId);
  return <>{render(isLive ? count : initialFallback, isLive)}</>;
}
