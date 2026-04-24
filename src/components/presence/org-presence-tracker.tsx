"use client";

/**
 * OrgPresenceTracker
 * ------------------
 * 참가자(app_user) 측에 마운트되는 "invisible" 컴포넌트.
 * 현재 사용자의 orgId 채널(`org-presence:{orgId}`)에 join 후 track 한다.
 * 관제실은 같은 채널을 구독하여 "지금 접속 N명" 을 실시간 표시한다.
 *
 * - Presence key 는 `userId` 를 사용하므로 같은 유저가 여러 탭을 열어도
 *   presence state 의 key 기준 dedupe 가 가능하다. (동일 key 에 여러 meta 가
 *   쌓이지만, 구독 측에서 `Object.keys(state).length` 로 unique user 수를 센다.)
 * - 언마운트 시 untrack → removeChannel 로 깔끔히 정리.
 */

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  orgId: string;
  userId: string;
  parentName?: string | null;
};

export function OrgPresenceTracker({ orgId, userId, parentName }: Props) {
  useEffect(() => {
    if (!orgId || !userId) return;

    const supa = createClient();
    const channel = supa.channel(`org-presence:${orgId}`, {
      config: {
        presence: { key: userId },
      },
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id: userId,
          parent_name: parentName ?? null,
          joined_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      // best-effort cleanup — await 할 필요 없음
      void channel.untrack();
      void supa.removeChannel(channel);
    };
  }, [orgId, userId, parentName]);

  return null;
}
