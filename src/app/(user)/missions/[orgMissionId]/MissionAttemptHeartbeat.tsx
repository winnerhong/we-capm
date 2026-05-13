"use client";

// Phase 2 관제 — 참가자가 미션 페이지에 머무는 동안 telemetry 송신.
//   - mount: startMissionAttemptAction (upsert 한 row, opened_at 갱신)
//   - 30초마다 heartbeatMissionAttemptAction (last_seen_at 갱신)
//   - tab hidden / unmount: 인터벌 정지 (마지막 heartbeat 시간이 N분 지나면
//     관제 측에서 "abandoned" 로 간주)
//   - 모든 실패는 silent — 미션 진행 자체를 막지 않음.

import { useEffect } from "react";
import {
  heartbeatMissionAttemptAction,
  startMissionAttemptAction,
} from "@/lib/missions/attempt-actions";

const HEARTBEAT_MS = 30_000;

export function MissionAttemptHeartbeat({
  orgMissionId,
}: {
  orgMissionId: string;
}) {
  useEffect(() => {
    if (!orgMissionId) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    // 마운트: 즉시 start
    void startMissionAttemptAction(orgMissionId).catch(() => {});

    const tick = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      void heartbeatMissionAttemptAction(orgMissionId).catch(() => {});
    };

    interval = setInterval(tick, HEARTBEAT_MS);

    // visibility 복귀 시 즉시 1번 heartbeat
    const onVis = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        void heartbeatMissionAttemptAction(orgMissionId).catch(() => {});
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
    };
  }, [orgMissionId]);

  return null;
}
