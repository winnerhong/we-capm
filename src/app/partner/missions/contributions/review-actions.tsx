"use client";

import { useState, useTransition } from "react";
import {
  acceptContributionAction,
  rejectContributionAction,
} from "@/lib/missions/contribution-actions";

type Mode = "none" | "accept" | "reject";

interface Props {
  contributionId: string;
}

export function ReviewActions({ contributionId }: Props) {
  const [mode, setMode] = useState<Mode>("none");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onConfirm() {
    setErr(null);
    if (mode === "reject" && !note.trim()) {
      setErr("반려 사유를 적어 주세요");
      return;
    }
    startTransition(async () => {
      try {
        if (mode === "accept") {
          await acceptContributionAction(contributionId, note.trim());
        } else if (mode === "reject") {
          await rejectContributionAction(contributionId, note.trim());
        }
        setMode("none");
        setNote("");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "처리 실패");
      }
    });
  }

  if (mode === "none") {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("accept")}
          className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
        >
          ✅ 수용하기
        </button>
        <button
          type="button"
          onClick={() => setMode("reject")}
          className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50"
        >
          ❌ 반려
        </button>
      </div>
    );
  }

  const isAccept = mode === "accept";

  return (
    <div
      className={`mt-3 rounded-xl border p-3 ${
        isAccept
          ? "border-emerald-200 bg-emerald-50/60"
          : "border-rose-200 bg-rose-50/60"
      }`}
    >
      <p className="text-xs font-bold text-zinc-800">
        {isAccept ? "수용 메모 (선택)" : "반려 사유 (필수)"}
      </p>
      <textarea
        rows={3}
        maxLength={2000}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={
          isAccept
            ? "예: 좋은 아이디어 감사합니다. 새 버전으로 반영했어요."
            : "예: 현재 가이드 방향과 맞지 않아 반영이 어려워요."
        }
        className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
      />

      {err && (
        <p role="alert" className="mt-1.5 text-[11px] font-semibold text-rose-700">
          ⚠ {err}
        </p>
      )}

      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("none");
            setNote("");
            setErr(null);
          }}
          disabled={isPending}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow-sm disabled:opacity-60 ${
            isAccept
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-rose-600 hover:bg-rose-700"
          }`}
        >
          {isPending
            ? "처리 중…"
            : isAccept
              ? "새 버전 생성 · 수용"
              : "반려 확정"}
        </button>
      </div>
    </div>
  );
}
