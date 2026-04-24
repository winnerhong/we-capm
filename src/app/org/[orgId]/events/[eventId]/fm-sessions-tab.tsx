"use client";

// 기관 행사 > 토리FM 탭 — 1:N (tori_fm_sessions.event_id).
// 체크박스 선택형이 아니라 연결/해제 버튼형. 각 버튼은 즉시 서버액션 실행.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  linkFmSessionToEventAction,
  unlinkFmSessionFromEventAction,
} from "@/lib/org-events/actions";

export type FmSessionOption = {
  id: string;
  title: string | null;
  is_live: boolean;
  scheduled_start: string;
  scheduled_end: string;
  event_id: string | null;
};

type Props = {
  eventId: string;
  orgId: string;
  linkedSessions: FmSessionOption[];
  unlinkedSessions: FmSessionOption[];
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FmSessionsTab({
  eventId,
  orgId,
  linkedSessions,
  unlinkedSessions,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (savedAt == null) return;
    const t = setTimeout(() => setSavedAt(null), 2000);
    return () => clearTimeout(t);
  }, [savedAt]);

  const hasAnySession = useMemo(
    () => linkedSessions.length + unlinkedSessions.length > 0,
    [linkedSessions, unlinkedSessions]
  );

  function onLink(sessionId: string): void {
    if (isPending) return;
    setError(null);
    setPendingId(sessionId);
    startTransition(async () => {
      try {
        await linkFmSessionToEventAction(eventId, sessionId);
        setSavedAt(Date.now());
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "연결에 실패했어요";
        setError(msg);
      } finally {
        setPendingId(null);
      }
    });
  }

  function onUnlink(sessionId: string, isLive: boolean): void {
    if (isPending) return;
    if (isLive) {
      const ok = window.confirm(
        "⚠️ 이 FM 세션은 LIVE 중이에요!\n\n연결을 해제해도 방송은 끊기지 않지만, 행사와의 연결이 풀려요.\n정말 해제할까요?"
      );
      if (!ok) return;
    }
    setError(null);
    setPendingId(sessionId);
    startTransition(async () => {
      try {
        await unlinkFmSessionFromEventAction(eventId, sessionId);
        setSavedAt(Date.now());
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "해제에 실패했어요";
        setError(msg);
      } finally {
        setPendingId(null);
      }
    });
  }

  // 세션이 전혀 없는 경우 — 빈 상태 CTA
  if (!hasAnySession) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
        <div className="text-5xl" aria-hidden>
          🎙
        </div>
        <p className="mt-3 text-base font-bold text-[#2D5A3D]">
          아직 만든 FM 세션이 없어요
        </p>
        <p className="mt-1 max-w-sm text-xs text-[#6B6560]">
          토리FM 제어실에서 방송 세션을 만든 뒤, 이 행사에 연결할 수 있어요.
        </p>
        <Link
          href={`/org/${orgId}/tori-fm`}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#234a30]"
        >
          <span aria-hidden>📻</span>
          <span>토리FM 제어실 열기</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 요약 바 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#D4E4BC] bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B6560]">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-bold text-emerald-800">
            🔗 연결됨 {linkedSessions.length.toLocaleString("ko-KR")}개
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2.5 py-1 font-semibold text-[#2D5A3D]">
            🆓 미연결 {unlinkedSessions.length.toLocaleString("ko-KR")}개
          </span>
        </div>
        <Link
          href={`/org/${orgId}/tori-fm`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-bold text-[#2D5A3D] hover:bg-[#F5F1E8]"
        >
          <span aria-hidden>➕</span>
          <span>새 세션 만들기</span>
        </Link>
      </div>

      {/* 에러 / 성공 배너 */}
      {error && (
        <div
          role="alert"
          className="rounded-2xl border-2 border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
        >
          ⚠️ {error}
        </div>
      )}
      {savedAt != null && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
        >
          ✅ 처리됐어요
        </div>
      )}

      {/* 1) 이 행사에 연결된 세션 */}
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>🔗</span>
          <span>이 행사에 연결된 FM 세션</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
            {linkedSessions.length}
          </span>
        </h3>
        {linkedSessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-6 text-center">
            <p className="text-xs text-[#6B6560]">
              아직 연결된 세션이 없어요. 아래에서 골라 주세요.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {linkedSessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                linked
                disabled={isPending}
                pending={pendingId === s.id}
                onAction={() => onUnlink(s.id, s.is_live)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* 2) 연결 가능한 미연결 세션 */}
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>🆓</span>
          <span>연결 가능한 세션</span>
          <span className="rounded-full bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-bold text-[#2D5A3D]">
            {unlinkedSessions.length}
          </span>
        </h3>
        {unlinkedSessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-6 text-center">
            <p className="text-xs text-[#6B6560]">
              미연결 세션이 없어요.{" "}
              <Link
                href={`/org/${orgId}/tori-fm`}
                className="font-semibold text-[#2D5A3D] underline"
              >
                새로 만들기
              </Link>
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {unlinkedSessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                linked={false}
                disabled={isPending}
                pending={pendingId === s.id}
                onAction={() => onLink(s.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SessionRow({
  session,
  linked,
  disabled,
  pending,
  onAction,
}: {
  session: FmSessionOption;
  linked: boolean;
  disabled: boolean;
  pending: boolean;
  onAction: () => void;
}) {
  const isLive = session.is_live;
  return (
    <li
      className={`rounded-2xl border p-4 shadow-sm transition ${
        linked
          ? "border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-300/40"
          : "border-[#D4E4BC] bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {isLive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-300 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                <span>LIVE</span>
              </span>
            )}
            {linked && (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                🔗 연결됨
              </span>
            )}
          </div>
          <h4 className="mt-1.5 truncate text-sm font-bold text-[#2D5A3D]">
            🎙 {session.title || "(제목 없음)"}
          </h4>
          <p className="mt-1 text-[11px] text-[#6B6560]">
            🕐 {fmtDateTime(session.scheduled_start)} ~{" "}
            {fmtDateTime(session.scheduled_end)}
          </p>
        </div>

        <button
          type="button"
          onClick={onAction}
          disabled={disabled}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
            linked
              ? "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
              : "bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] text-white hover:from-[#234a30] hover:to-[#2D5A3D]"
          }`}
        >
          {pending ? (
            <>
              <span aria-hidden>⏳</span>
              <span>처리 중...</span>
            </>
          ) : linked ? (
            <>
              <span aria-hidden>❌</span>
              <span>연결 해제</span>
            </>
          ) : (
            <>
              <span aria-hidden>➕</span>
              <span>이 행사에 연결</span>
            </>
          )}
        </button>
      </div>
    </li>
  );
}
