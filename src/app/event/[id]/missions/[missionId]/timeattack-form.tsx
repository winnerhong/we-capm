"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitTimeattackAction } from "../actions";

export function TimeattackForm({
  eventId,
  missionId,
  timeLimitSec,
}: {
  eventId: string;
  missionId: string;
  timeLimitSec: number;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"ready" | "running" | "done">("ready");
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsed, setElapsed] = useState(0);
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (phase !== "running") return;
    const interval = setInterval(() => {
      const now = Date.now();
      const sec = Math.floor((now - startTime) / 1000);
      setElapsed(sec);
      if (sec >= timeLimitSec) {
        setPhase("done");
        setError("시간 초과!");
      }
    }, 100);
    return () => clearInterval(interval);
  }, [phase, startTime, timeLimitSec]);

  const handleStart = () => {
    setStartTime(Date.now());
    setPhase("running");
    setError(null);
  };

  const handleComplete = () => {
    setPhase("done");
    startTransition(async () => {
      try {
        const result = await submitTimeattackAction(eventId, missionId, elapsed, evidence);
        if (!result.ok) {
          setError(result.message ?? "제출 실패");
          return;
        }
        router.push(`/event/${eventId}/missions?result=correct`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "제출 실패");
      }
    });
  };

  const remaining = Math.max(0, timeLimitSec - elapsed);
  const pct = Math.min(100, (elapsed / timeLimitSec) * 100);

  return (
    <div className="space-y-4 rounded-lg border bg-white p-6">
      {phase === "ready" && (
        <>
          <p className="text-center text-sm">제한시간: {timeLimitSec}초</p>
          <button
            onClick={handleStart}
            className="w-full rounded-lg bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700"
          >
            시작!
          </button>
        </>
      )}

      {phase === "running" && (
        <>
          <div className="text-center">
            <div className="text-5xl font-bold tabular-nums">{remaining}</div>
            <div className="text-sm">초 남음</div>
          </div>
          <div className="h-3 overflow-hidden rounded bg-neutral-200">
            <div
              className={`h-full transition-all ${pct > 80 ? "bg-red-500" : "bg-violet-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="수행 결과를 입력하세요 (선택)"
            rows={2}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          <button
            onClick={handleComplete}
            disabled={pending}
            className="w-full rounded-lg bg-green-600 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            완료!
          </button>
        </>
      )}

      {phase === "done" && !pending && (
        <div className="text-center">
          <div className="text-2xl font-bold">{elapsed}초</div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
