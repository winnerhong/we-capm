"use client";

import { useState, useTransition } from "react";
import {
  approveDocumentAction,
  rejectDocumentAction,
} from "./actions";

interface Props {
  documentId: string;
}

export function ReviewActions({ documentId }: Props) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "rejecting">("idle");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const doApprove = () => {
    if (!confirm("이 서류를 승인하시겠어요?")) return;
    setErr(null);
    startTransition(async () => {
      try {
        await approveDocumentAction(documentId);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "승인 실패");
      }
    });
  };

  const doReject = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setErr("반려 사유를 입력해 주세요");
      return;
    }
    setErr(null);
    const fd = new FormData();
    fd.append("reason", trimmed);
    startTransition(async () => {
      try {
        await rejectDocumentAction(documentId, fd);
        setMode("idle");
        setReason("");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "반려 실패");
      }
    });
  };

  if (mode === "rejecting") {
    return (
      <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3">
        <label
          htmlFor={`reason-${documentId}`}
          className="block text-xs font-semibold text-rose-800"
        >
          반려 사유 <span className="text-rose-600">*</span>
        </label>
        <textarea
          id={`reason-${documentId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="예: 사업자등록증 앞면이 잘렸어요. 전체가 보이도록 재촬영 부탁드려요."
          className="w-full resize-none rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs text-rose-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-400/30"
          disabled={pending}
        />
        {err && <p className="text-[11px] text-rose-700">⚠️ {err}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={doReject}
            disabled={pending}
            className="flex-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {pending ? "처리중…" : "❌ 반려 확정"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("idle");
              setReason("");
              setErr(null);
            }}
            disabled={pending}
            className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            취소
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={doApprove}
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "처리중…" : "✅ 승인"}
      </button>
      <button
        type="button"
        onClick={() => setMode("rejecting")}
        disabled={pending}
        className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
      >
        ❌ 반려
      </button>
      {err && <span className="text-[11px] text-rose-700">⚠️ {err}</span>}
    </div>
  );
}
