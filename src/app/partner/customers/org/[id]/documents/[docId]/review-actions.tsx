"use client";

import { useState, useTransition } from "react";
import {
  approveOrgDocumentAction,
  rejectOrgDocumentAction,
} from "../actions";

type Props = {
  orgId: string;
  documentId: string;
  compact?: boolean;
};

export function OrgDocReviewActions({ orgId, documentId, compact }: Props) {
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "rejecting">("idle");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const approve = () => {
    if (isPending) return;
    setErr(null);
    startTransition(async () => {
      try {
        await approveOrgDocumentAction(orgId, documentId);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "승인 실패");
      }
    });
  };

  const submitReject = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setErr("반려 사유를 입력해 주세요");
      return;
    }
    setErr(null);
    const fd = new FormData();
    fd.set("reason", trimmed);
    startTransition(async () => {
      try {
        await rejectOrgDocumentAction(orgId, documentId, fd);
        setMode("idle");
        setReason("");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "반려 실패");
      }
    });
  };

  if (mode === "rejecting") {
    return (
      <form
        onSubmit={submitReject}
        className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3"
      >
        <label
          htmlFor={`reject-${documentId}`}
          className="block text-xs font-semibold text-rose-900"
        >
          반려 사유 <span className="text-rose-600">*</span>
        </label>
        <textarea
          id={`reject-${documentId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="예: 해상도가 낮아 식별이 어려워요. 스캔 본으로 재업로드 부탁드려요."
          className="w-full resize-none rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs text-[#2C2C2C] focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-400/40"
          required
        />
        {err && (
          <p className="text-[11px] text-rose-700" role="alert">
            ⚠️ {err}
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("idle");
              setReason("");
              setErr(null);
            }}
            disabled={isPending}
            className="rounded-lg border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B6560] hover:bg-[#F0EBE3] disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isPending || !reason.trim()}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {isPending ? "처리 중…" : "❌ 반려 확정"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className={compact ? "flex flex-wrap gap-2" : "flex flex-wrap gap-2"}>
      <button
        type="button"
        onClick={approve}
        disabled={isPending}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {isPending ? "처리 중…" : "✅ 승인"}
      </button>
      <button
        type="button"
        onClick={() => setMode("rejecting")}
        disabled={isPending}
        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60"
      >
        ❌ 반려
      </button>
      {err && (
        <p className="w-full text-[11px] text-rose-700" role="alert">
          ⚠️ {err}
        </p>
      )}
    </div>
  );
}
