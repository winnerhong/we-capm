"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MISSION_TYPE_META,
  type TrailStopRow,
  type MissionType,
} from "@/lib/trails/types";
import { reorderStopsAction } from "../actions";
import { StopRowActions } from "./stop-row-actions";

const MISSION_STYLE: Record<MissionType, string> = {
  PHOTO: "bg-sky-50 text-sky-800 border-sky-200",
  QUIZ: "bg-violet-50 text-violet-800 border-violet-200",
  LOCATION: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CHECKIN: "bg-[#F5F1E8] text-[#2D5A3D] border-[#D4E4BC]",
};

interface Props {
  trailId: string;
  initialStops: TrailStopRow[];
}

export function StopsList({ trailId, initialStops }: Props) {
  const router = useRouter();
  const [stops, setStops] = useState<TrailStopRow[]>(initialStops);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // 서버 상태(initialStops)가 갱신되면 (예: router.refresh() 후) 로컬 state 동기화.
  // 행 삭제 / QR 재발급 후 즉시 화면 반영되도록 필수.
  useEffect(() => {
    setStops(initialStops);
  }, [initialStops]);

  const swap = (from: number, to: number) => {
    if (to < 0 || to >= stops.length) return;
    setErr(null);

    const optimistic = [...stops];
    const [moved] = optimistic.splice(from, 1);
    optimistic.splice(to, 0, moved);
    // 화면상 순서 즉시 반영 (낙관적 업데이트)
    setStops(
      optimistic.map((s, i) => ({ ...s, order: i + 1 } as TrailStopRow))
    );

    startTransition(async () => {
      try {
        await reorderStopsAction(
          trailId,
          optimistic.map((s) => s.id)
        );
        router.refresh();
      } catch (e) {
        // 실패 시 원복
        setStops(initialStops);
        setErr(e instanceof Error ? e.message : "순서 변경 실패");
      }
    });
  };

  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm">
      <div className="hidden grid-cols-[48px_1fr_120px_80px_110px_70px_110px] items-center gap-2 border-b border-[#D4E4BC] bg-[#F5F1E8] px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-[#6B6560] md:grid">
        <div>#</div>
        <div>이름</div>
        <div>미션</div>
        <div className="text-right">점수</div>
        <div>QR</div>
        <div className="text-center">순서</div>
        <div className="text-right">작업</div>
      </div>
      <ul className="divide-y divide-[#E8F0E4]">
        {stops.map((s, i) => {
          const m = MISSION_TYPE_META[s.mission_type];
          const isFirst = i === 0;
          const isLast = i === stops.length - 1;
          return (
            <li
              key={s.id}
              className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-[48px_1fr_120px_80px_110px_70px_110px] md:items-center"
            >
              <div className="text-sm font-bold text-[#2D5A3D]">
                #{i + 1}
              </div>
              <div className="min-w-0">
                <Link
                  href={`/partner/trails/${trailId}/stops/${s.id}/edit`}
                  className="text-sm font-semibold text-[#2C2C2C] hover:text-[#2D5A3D] hover:underline"
                >
                  {s.name}
                </Link>
                {s.location_hint && (
                  <div className="mt-0.5 line-clamp-1 text-[11px] text-[#6B6560]">
                    📌 {s.location_hint}
                  </div>
                )}
              </div>
              <div>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${MISSION_STYLE[s.mission_type]}`}
                >
                  {m.icon} {m.label}
                </span>
              </div>
              <div className="text-sm font-bold text-[#2D5A3D] md:text-right">
                {s.reward_points}점
              </div>
              <div>
                <code className="inline-flex items-center rounded-md border border-[#D4E4BC] bg-[#F5F1E8] px-1.5 py-0.5 font-mono text-[10px] text-[#6B6560]">
                  {String(s.qr_code).slice(0, 10)}…
                </code>
              </div>
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => swap(i, i - 1)}
                  disabled={isFirst || pending}
                  aria-label="위로 이동"
                  title="위로 이동"
                  className="rounded-lg border border-[#D4E4BC] bg-white px-1.5 py-1 text-xs text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => swap(i, i + 1)}
                  disabled={isLast || pending}
                  aria-label="아래로 이동"
                  title="아래로 이동"
                  className="rounded-lg border border-[#D4E4BC] bg-white px-1.5 py-1 text-xs text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ▼
                </button>
              </div>
              <StopRowActions stopId={s.id} trailId={trailId} />
            </li>
          );
        })}
      </ul>
      {err && (
        <div
          role="alert"
          className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-[11px] text-rose-800"
        >
          {err}
        </div>
      )}
    </div>
  );
}
