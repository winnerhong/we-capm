"use client";

import { useState } from "react";
import Link from "next/link";
import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "../control-room.module.css";
import { InlineReviewModal } from "./inline-review-modal";

type Props = {
  snapshot: ControlRoomSnapshot;
  orgId: string;
  isTvMode: boolean;
};

function elapsedLabel(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime();
  const min = Math.max(0, Math.floor((nowMs - t) / 60000));
  if (min < 60) return `${min}분`;
  const hr = Math.floor(min / 60);
  const rm = min % 60;
  return rm ? `${hr}시간 ${rm}분` : `${hr}시간`;
}

function oldestColor(min: number | null): string {
  if (min === null) return "#a8b8d0";
  if (min >= 30) return "#FF4D8A";
  if (min >= 10) return "#FFC83D";
  return "#39FF88";
}

export function PendingTile({ snapshot, orgId, isTvMode }: Props) {
  const { total, oldestWaitingMinutes, items } = snapshot.pending;
  // 전부 노출 — 5개 cap 제거. 위젯이 너무 길어지지 않도록 ul 컨테이너에
  // max-h + overflow-y-auto 적용 (아래 ul className 참고).
  const list = items;
  const now = new Date(snapshot.serverNowIso).getTime();
  const oldestHex = oldestColor(oldestWaitingMinutes);
  const reviewHref = `/org/${orgId}/missions/review`;

  // 일반 모드에서 행 클릭 시 인라인 검수 모달 오픈 (TV 모드는 기존 동작 유지)
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  return (
    <div className={`${styles.surface} flex flex-col p-4`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base" aria-hidden>
          ⏳
        </span>
        <h2 className="text-xs font-semibold tracking-[0.15em] text-[#a8b8d0]">
          검토 대기
        </h2>
        {!isTvMode && total > 0 && (
          <Link
            href={reviewHref}
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-[#FFC83D]/40 bg-[#FFC83D]/10 px-2.5 py-1 text-[11px] font-bold text-[#FFC83D] transition hover:bg-[#FFC83D]/20"
          >
            ✅ 검수하러 가기
            <span aria-hidden>›</span>
          </Link>
        )}
      </div>

      {total === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <div className="text-5xl" aria-hidden>
            🎉
          </div>
          <div className={`${styles.neonGreen} text-lg font-bold`}>
            검토 대기 없음
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-end gap-6">
            <div>
              <div className="text-[10px] text-[#a8b8d0]">대기 건수</div>
              <div
                className={`${styles.neonAmber} font-mono text-5xl font-extrabold leading-none md:text-6xl`}
              >
                {total.toLocaleString("ko-KR")}
              </div>
            </div>
            {oldestWaitingMinutes !== null && (
              <div>
                <div className="text-[10px] text-[#a8b8d0]">최장 대기</div>
                <div
                  className="font-mono text-2xl font-bold leading-none"
                  style={{
                    color: oldestHex,
                    filter: `drop-shadow(0 0 6px ${oldestHex}66)`,
                  }}
                >
                  {oldestWaitingMinutes}분
                </div>
              </div>
            )}
          </div>

          <ul
            className="flex max-h-[520px] flex-col gap-2 overflow-y-auto pr-1
              [&::-webkit-scrollbar]:w-1.5
              [&::-webkit-scrollbar-track]:bg-transparent
              [&::-webkit-scrollbar-thumb]:rounded-full
              [&::-webkit-scrollbar-thumb]:bg-white/15"
          >
            {list.map((it) => {
              const inner = (
                <>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[#f4ecd8]">
                      {it.missionTitle}
                    </div>
                    <div className="truncate text-[11px] text-[#a8b8d0]">
                      {it.submitterName}
                      {it.packName ? ` · ${it.packName}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 font-mono text-xs font-bold text-[#FFC83D]">
                    {elapsedLabel(it.submittedAt, now)}
                  </div>
                </>
              );
              return (
                <li key={it.id}>
                  {isTvMode ? (
                    <div className="flex items-start justify-between gap-3 rounded-lg border border-[#1a2a52] bg-[#0a1839] px-3 py-2">
                      {inner}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReviewingId(it.id)}
                      className="flex w-full items-start justify-between gap-3 rounded-lg border border-[#1a2a52] bg-[#0a1839] px-3 py-2 text-left transition hover:border-[#FFC83D]/50 hover:bg-[#0e1f4d]"
                      title="여기서 바로 검수"
                    >
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {reviewingId && (
        <InlineReviewModal
          initialSubmissionId={reviewingId}
          onClose={() => setReviewingId(null)}
        />
      )}
    </div>
  );
}
