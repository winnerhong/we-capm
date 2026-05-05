"use client";

// QuickNoticeButton — 기관 포털 상단 nav 의 [📢 공지사항] 버튼.
//
//   - 클릭하면 인라인 팝오버 노출 → 한 줄 입력 → [게시] → fm_spotlight_events INSERT
//   - 활성 LIVE FM 세션이 있을 때만 게시 가능 (없으면 버튼 비활성)
//   - [끄기] 버튼은 활성 BANNER 가 있는 경우에만 의미 — 항상 노출, 액션이 idempotent
//
// 데이터 흐름 (참가자 측):
//   triggerSpotlightAction(sessionId, "BANNER", { text })
//     → fm_spotlight_events row 생성 (expires_at NULL — LIVE 종료/dismiss 까지)
//     → Supabase Realtime publication
//     → (user)/PinnedNoticeBanner 가 수신 → 모든 참가자 화면 상단에 슬라이드 인

import { useEffect, useRef, useState, useTransition } from "react";
import {
  dismissSpotlightAction,
  triggerSpotlightAction,
} from "@/lib/tori-fm/actions";

interface Props {
  /** 활성 LIVE FM 세션 ID — null 이면 버튼 비활성. */
  liveFmSessionId: string | null;
}

export function QuickNoticeButton({ liveFmSessionId }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  const disabled = !liveFmSessionId;

  // 바깥 클릭으로 팝오버 닫기
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  // 팝오버 닫을 때 피드백 초기화
  useEffect(() => {
    if (!open) setFeedback(null);
  }, [open]);

  const fire = (label: string, fn: () => Promise<void>) => {
    startTransition(async () => {
      try {
        await fn();
        setFeedback(`✅ ${label}`);
        window.setTimeout(() => setFeedback(null), 2500);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "처리 실패";
        setFeedback(`⚠ ${msg}`);
        window.setTimeout(() => setFeedback(null), 8000);
      }
    });
  };

  const onPost = () => {
    if (!liveFmSessionId) return;
    const t = text.trim();
    if (!t) return;
    fire("공지사항 게시", async () => {
      await triggerSpotlightAction(liveFmSessionId, "BANNER", { text: t });
      setText("");
    });
  };

  const onDismiss = () => {
    if (!liveFmSessionId) return;
    fire("공지사항 끄기", () =>
      dismissSpotlightAction(liveFmSessionId, "BANNER")
    );
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={
          disabled
            ? "토리FM LIVE 방송 시작 후 사용할 수 있어요"
            : "참가자 화면 상단에 공지사항을 띄워요"
        }
        className={`ml-1 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold transition ${
          disabled
            ? "cursor-not-allowed border-amber-200/40 bg-amber-50/30 text-amber-700/40"
            : open
              ? "border-amber-500 bg-amber-100 text-amber-900 shadow-sm"
              : "border-amber-300/70 bg-amber-50 text-amber-800 hover:bg-amber-100"
        }`}
      >
        <span aria-hidden>📢</span>
        <span>공지사항</span>
      </button>

      {open && !disabled && (
        <div
          role="dialog"
          aria-label="공지사항 빠른 게시"
          className="absolute right-0 top-full z-50 mt-2 w-[22rem] overflow-hidden rounded-2xl border border-amber-300 bg-white shadow-xl"
        >
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <span aria-hidden>📢</span>
              <span>참가자 화면 상단 공지사항</span>
            </p>
            <p className="mt-0.5 text-[10px] text-amber-800/75">
              게시하면 LIVE 종료 또는 [끄기] 누르기 전까지 모든 참가자에게 노출돼요.
            </p>
          </div>
          <div className="space-y-2 p-3">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 60))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !pending && text.trim()) {
                  e.preventDefault();
                  onPost();
                }
              }}
              placeholder="예: 5분 후 가위바위보 시작합니다 🎉"
              maxLength={60}
              autoFocus
              aria-label="공지사항 문구"
              className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm text-[#1B2B3A] placeholder:text-[#9A9089] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pending || text.trim().length === 0}
                onClick={onPost}
                className="flex-1 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? "처리 중…" : "📡 게시"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={onDismiss}
                title="현재 노출 중인 공지사항을 즉시 종료"
                className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#6B6560] transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
              >
                끄기
              </button>
            </div>
            {feedback && (
              <p
                role="status"
                className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                  feedback.startsWith("⚠")
                    ? "bg-rose-50 text-rose-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {feedback}
              </p>
            )}
            <p className="text-[10px] text-[#8B7F75]">
              💡 새로 게시하면 기존 공지를 자동으로 덮어써요 · Enter 로 빠르게 게시
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
