"use client";

// 클라이언트 컴포넌트 — 카드 하단 승인/반려 버튼.
// 이름 유의: 서버 액션 모듈은 @/lib/missions/review-actions (.ts, "use server")
// 이 파일은 UI 컴포넌트로 .tsx 확장자.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveSubmissionAction,
  rejectSubmissionAction,
} from "@/lib/missions/review-actions";
import type { ReviewTab } from "./review-layout";

type Props = {
  submissionId: string;
  tab: ReviewTab;
};

export function ReviewActions({ submissionId, tab }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  // pending 탭에서만 활성화. 다른 탭이면 아무것도 안 보여줌.
  if (tab !== "pending") return null;

  function handleApprove() {
    if (isPending) return;
    setMsg(null);
    startTransition(async () => {
      try {
        await approveSubmissionAction(submissionId);
        router.refresh();
      } catch (e) {
        const message = e instanceof Error ? e.message : "승인에 실패했어요";
        setMsg(message);
      }
    });
  }

  function handleReject() {
    if (isPending) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setMsg("반려 사유를 입력해 주세요");
      return;
    }
    setMsg(null);
    startTransition(async () => {
      try {
        await rejectSubmissionAction(submissionId, trimmed);
        setRejectOpen(false);
        setReason("");
        router.refresh();
      } catch (e) {
        const message = e instanceof Error ? e.message : "반려에 실패했어요";
        setMsg(message);
      }
    });
  }

  function openRejectBox() {
    setMsg(null);
    setRejectOpen(true);
  }

  function closeRejectBox() {
    setRejectOpen(false);
    setReason("");
    setMsg(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={isPending}
          className="inline-flex items-center gap-1 rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#3A7A52] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
        >
          <span aria-hidden>✅</span>
          <span>{isPending ? "처리 중..." : "승인"}</span>
        </button>
        <button
          type="button"
          onClick={rejectOpen ? closeRejectBox : openRejectBox}
          disabled={isPending}
          aria-expanded={rejectOpen}
          className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
        >
          <span aria-hidden>❌</span>
          <span>반려</span>
        </button>
      </div>

      {rejectOpen && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
          <label
            htmlFor={`reject-reason-${submissionId}`}
            className="block text-[11px] font-semibold text-rose-900"
          >
            반려 사유를 적어 주세요
          </label>
          <textarea
            id={`reject-reason-${submissionId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            disabled={isPending}
            placeholder="예: 사진이 흐려요 · 미션과 달라요 · 다시 시도해 주세요"
            className="mt-2 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs text-[#2C2C2C] focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30 disabled:opacity-50"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeRejectBox}
              disabled={isPending}
              className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={isPending || !reason.trim()}
              className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "처리 중..." : "반려 확정"}
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p
          className="text-[11px] font-semibold text-rose-700"
          role="alert"
          aria-live="polite"
        >
          {msg}
        </p>
      )}
    </div>
  );
}
