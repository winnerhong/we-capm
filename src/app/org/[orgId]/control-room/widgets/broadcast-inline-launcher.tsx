"use client";

// 관제실 헤더의 "📣 돌발미션" 인라인 런처.
// 페이지 이동 없이 모달로 BroadcastTriggerPanel 을 임베드 → 즉시 발동.
// 모달 처음 열릴 때만 server action 으로 missions/activeEvents lazy fetch (재오픈 시 캐시).

import { useEffect, useState } from "react";
import {
  loadBroadcastSetupAction,
  type BroadcastSetupSummary,
} from "@/lib/missions/broadcast-actions";
import { BroadcastTriggerPanel } from "@/app/org/[orgId]/missions/broadcast/trigger-panel";

interface Props {
  orgId: string;
}

type SetupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "ready";
      missions: BroadcastSetupSummary[];
      activeEvents: Array<{ id: string; name: string }>;
    }
  | { kind: "error"; message: string };

export function BroadcastInlineLauncher({ orgId }: Props) {
  const [open, setOpen] = useState(false);
  const [setup, setSetup] = useState<SetupState>({ kind: "idle" });

  // 모달 열릴 때마다 fetch (캐시 X — 새 미션이 막 추가됐을 수 있어 항상 최신).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSetup({ kind: "loading" });
    loadBroadcastSetupAction()
      .then((data) => {
        if (cancelled) return;
        setSetup({ kind: "ready", ...data });
      })
      .catch((e) => {
        if (cancelled) return;
        setSetup({
          kind: "error",
          message:
            e instanceof Error
              ? e.message
              : "돌발 미션 데이터를 가져오지 못했어요",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="돌발 미션 보내기 (인라인 모달)"
        className="inline-flex items-center gap-1 rounded-xl border border-[#ff4d8a]/40 bg-[#ff4d8a]/15 px-3 py-2 text-xs font-bold text-[#ff8eb0] transition hover:bg-[#ff4d8a]/25"
      >
        <span aria-hidden>📣</span>
        <span>돌발미션</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="돌발 미션 발동"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            // backdrop 클릭으로 닫기
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#1a2a52] bg-[#0b1538] shadow-2xl">
            {/* 헤더 */}
            <header className="flex items-center justify-between border-b border-[#1a2a52] bg-[#070C1F] px-5 py-3">
              <div className="flex items-center gap-2">
                <span aria-hidden className="text-lg">
                  📣
                </span>
                <h2 className="text-sm font-bold text-[#f4ecd8]">
                  돌발 미션 발동
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="rounded-lg px-2 py-1 text-sm text-[#a8b8d0] transition hover:bg-[#16234a]"
              >
                ✕
              </button>
            </header>

            {/* 본문 */}
            <div className="scroll-dark flex-1 overflow-y-auto bg-[#0b1538] p-4">
              {setup.kind === "idle" || setup.kind === "loading" ? (
                <div className="flex h-40 items-center justify-center text-sm text-[#a8b8d0]">
                  돌발 미션 불러오는 중...
                </div>
              ) : setup.kind === "error" ? (
                <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 p-4 text-sm text-rose-200">
                  {setup.message}
                </div>
              ) : (
                <BroadcastTriggerPanel
                  missions={setup.missions}
                  activeEvents={setup.activeEvents}
                />
              )}
            </div>

            {/* 푸터: 풀 페이지 링크 (자세한 통계는 거기에) */}
            <footer className="flex items-center justify-between gap-2 border-t border-[#1a2a52] bg-[#070C1F] px-5 py-3 text-[11px] text-[#a8b8d0]">
              <span>
                ESC 또는 배경 클릭으로 닫기 · 발동 후 자동 닫힘
              </span>
              <a
                href={`/org/${orgId}/missions/broadcast`}
                className="rounded-md border border-[#1a2a52] bg-[#0a1839] px-2 py-1 font-semibold text-[#a8b8d0] hover:bg-[#16234a]"
              >
                전체 페이지 열기 →
              </a>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
