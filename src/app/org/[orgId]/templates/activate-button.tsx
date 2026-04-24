"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { activateTemplateAction } from "../actions";

type State =
  | { phase: "idle" }
  | { phase: "pending" }
  | { phase: "done"; editUrl: string }
  | { phase: "error"; message: string };

export function ActivateButton({ sourceProgramId }: { sourceProgramId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: "idle" });
  const [, startTransition] = useTransition();

  // done/error 상태는 5초 후 자동 리셋 (다시 활성화 가능)
  useEffect(() => {
    if (state.phase !== "done" && state.phase !== "error") return;
    const t = setTimeout(() => setState({ phase: "idle" }), 5000);
    return () => clearTimeout(t);
  }, [state.phase]);

  const onClick = () => {
    setState({ phase: "pending" });
    startTransition(async () => {
      try {
        const res = (await activateTemplateAction(sourceProgramId)) as
          | { ok: true; programId: string; editUrl: string }
          | { ok: false; message: string };
        if (res.ok) {
          setState({ phase: "done", editUrl: res.editUrl });
          // 서버사이드 revalidate 결과 반영 (내 프로그램 개수 등)
          router.refresh();
        } else {
          setState({ phase: "error", message: res.message });
        }
      } catch (e) {
        setState({
          phase: "error",
          message: e instanceof Error ? e.message : "활성화에 실패했어요",
        });
      }
    });
  };

  if (state.phase === "done") {
    return (
      <div className="space-y-1.5">
        <div
          role="status"
          className="flex w-full items-center justify-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"
        >
          <span aria-hidden>✅</span>
          <span>내 프로그램에 담겼어요</span>
        </div>
        <Link
          href={state.editUrl}
          className="block w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-center text-[11px] font-semibold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
        >
          ✏️ 바로 편집하기
        </Link>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="space-y-1.5">
        <div
          role="alert"
          className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-800"
        >
          ⚠️ {state.message}
        </div>
        <button
          type="button"
          onClick={onClick}
          className="w-full rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#4A7C59] px-3 py-2 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          다시 시도
        </button>
      </div>
    );
  }

  const pending = state.phase === "pending";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-busy={pending}
      className="w-full rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#4A7C59] px-3 py-2 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "활성화 중..." : "✨ 활성화"}
    </button>
  );
}
