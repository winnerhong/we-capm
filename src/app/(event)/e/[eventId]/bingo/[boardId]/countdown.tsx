"use client";

// 참가자 상단 카운트다운 — 배열 타이머 표시.
//   - arrange_ends_at = null → "운영자가 시작 버튼을 누르면 카운트가 시작돼요" (자유 배열 모드 가능)
//   - > now() → 분:초 카운트다운
//   - <= now() → 🔒 종료 안내

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  arrangeEndsAt: string | null;
}

function formatMmSs(ms: number): string {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function BingoCountdown({ arrangeEndsAt }: Props) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!arrangeEndsAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [arrangeEndsAt]);

  useEffect(() => {
    if (!arrangeEndsAt) return;
    const ends = new Date(arrangeEndsAt).getTime();
    const remaining = ends - Date.now();
    if (remaining <= 0) return;
    // 끝나는 순간 한 번 새로고침 → 서버 사이드 잠금 상태 반영.
    const id = setTimeout(() => router.refresh(), remaining + 500);
    return () => clearTimeout(id);
  }, [arrangeEndsAt, router]);

  if (!arrangeEndsAt) {
    // 자유 배열 (타이머 미세팅). 안내만.
    return null;
  }

  const endsMs = new Date(arrangeEndsAt).getTime();
  const remaining = endsMs - now;
  const isExpired = remaining <= 0;

  if (isExpired) {
    // 종료 안내는 내 빙고판과 가족 피드 사이(play-board)에서 보여준다.
    return null;
  }

  // 1분 미만이면 펄스 강조.
  const isUrgent = remaining < 60_000;

  return (
    <div
      className={`rounded-2xl border-2 p-3 text-center shadow-sm transition ${
        isUrgent
          ? "border-rose-400 bg-rose-50 animate-pulse"
          : "border-amber-400 bg-amber-50"
      }`}
    >
      <p
        className={`text-[10px] font-bold uppercase tracking-wider ${
          isUrgent ? "text-rose-700" : "text-amber-800"
        }`}
      >
        ⏱ 배열 마감까지
      </p>
      <p
        className={`mt-0.5 font-mono text-4xl font-extrabold tabular-nums ${
          isUrgent ? "text-rose-700" : "text-amber-700"
        }`}
      >
        {formatMmSs(remaining)}
      </p>
      <p
        className={`mt-1 text-[11px] ${
          isUrgent ? "text-rose-700 font-bold" : "text-amber-800/80"
        }`}
      >
        {isUrgent
          ? "⚠ 곧 잠겨요! 서둘러 배열을 마쳐주세요"
          : "시간이 끝나면 빙고판을 더 바꿀 수 없어요"}
      </p>
    </div>
  );
}
