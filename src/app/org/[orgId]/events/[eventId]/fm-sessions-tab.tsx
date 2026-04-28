"use client";

// 행사 토리FM 탭 — /org/[orgId]/tori-fm standalone 페이지의 시각/그룹 구조를 가벼운
// 행사 단위 세션 매니저로 재현. 라이브 스튜디오 콘솔은 너무 무거워서 행사 탭에 임베드 안 함;
// 대신 [🎛 라이브 스튜디오 열기] CTA로 standalone 으로 점프.
//
// 기능:
//   - 헤더: dark gradient + 라이브 스튜디오 CTA + 새 세션 CTA
//   - 이 행사 연결된 세션: 🔴 LIVE / 📅 예정 / 🏁 종료 그룹화 (standalone 동일)
//   - 각 세션 row: 제목/시간/LIVE 뱃지 + 행사제외 (= unlink) + 편집 링크
//   - 하단 접이식: 미연결 세션을 이 행사에 연결 (체크박스 다중 또는 단일 버튼)

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

type Bucket = "LIVE" | "UPCOMING" | "PAST";

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

function categorize(s: FmSessionOption): Bucket {
  if (s.is_live) return "LIVE";
  const start = new Date(s.scheduled_start).getTime();
  if (Number.isFinite(start) && start > Date.now()) return "UPCOMING";
  return "PAST";
}

const BUCKET_META: Record<
  Bucket,
  { label: string; emoji: string; chip: string }
> = {
  LIVE: {
    label: "방송 중",
    emoji: "🔴",
    chip: "border-rose-300 bg-rose-50 text-rose-800",
  },
  UPCOMING: {
    label: "예정",
    emoji: "📅",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  PAST: {
    label: "종료",
    emoji: "🏁",
    chip: "border-zinc-200 bg-zinc-50 text-zinc-700",
  },
};

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

  // 연결된 세션을 LIVE / UPCOMING / PAST 로 그룹화
  const grouped = useMemo(() => {
    const m: Record<Bucket, FmSessionOption[]> = {
      LIVE: [],
      UPCOMING: [],
      PAST: [],
    };
    for (const s of linkedSessions) {
      m[categorize(s)].push(s);
    }
    // UPCOMING: 가까운 시간 순, PAST: 최근 종료 순
    m.UPCOMING.sort(
      (a, b) =>
        new Date(a.scheduled_start).getTime() -
        new Date(b.scheduled_start).getTime()
    );
    m.PAST.sort(
      (a, b) =>
        new Date(b.scheduled_end).getTime() -
        new Date(a.scheduled_end).getTime()
    );
    return m;
  }, [linkedSessions]);

  const liveSession = grouped.LIVE[0] ?? null;

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
        setError(err instanceof Error ? err.message : "연결에 실패했어요");
      } finally {
        setPendingId(null);
      }
    });
  }

  function onUnlink(sessionId: string, isLive: boolean): void {
    if (isPending) return;
    if (isLive) {
      const ok = window.confirm(
        "⚠️ 이 FM 세션은 LIVE 중이에요!\n\n행사제외 해도 방송은 끊기지 않지만, 행사와의 연결이 풀려요.\n계속할까요?"
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
        setError(err instanceof Error ? err.message : "행사제외 실패");
      } finally {
        setPendingId(null);
      }
    });
  }

  // 하단 접이식: 미연결 세션 다중 선택 → 일괄 연결
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = useTransition();

  function toggleBulk(id: string): void {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onBulkLink(): void {
    if (bulkSelected.size === 0 || bulkPending) return;
    setError(null);
    const ids = Array.from(bulkSelected);
    startBulkTransition(async () => {
      try {
        // 1:N 이라 하나씩 호출 (트랜잭션 없음 — 부분 실패 가능, 여기서는 첫 실패 시 throw)
        for (const id of ids) {
          await linkFmSessionToEventAction(eventId, id);
        }
        setSavedAt(Date.now());
        setBulkSelected(new Set());
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "일괄 연결 실패");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* ────── 헤더 ────── */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#1B2B3A] via-[#243B4F] to-[#1B2B3A] p-5 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5EE9F0]">
              Event · Tori FM
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-bold md:text-xl">
              <span aria-hidden>📻</span>
              <span>이 행사 토리FM</span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">
                {linkedSessions.length}
              </span>
            </h2>
            <p className="mt-1 text-xs text-[#B8D4E2]">
              이 행사에 연결된 라디오 세션이에요. 방송은 라이브 스튜디오에서 켜고
              끌 수 있어요.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/org/${orgId}/tori-fm`}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold shadow-sm transition ${
                liveSession
                  ? "bg-rose-500 text-white hover:bg-rose-600"
                  : "bg-white text-[#1B2B3A] hover:bg-[#E6FAFB]"
              }`}
              style={
                liveSession
                  ? { boxShadow: "0 0 12px rgba(244,63,94,0.5)" }
                  : undefined
              }
            >
              <span aria-hidden>🎛</span>
              <span>
                {liveSession ? "라이브 스튜디오 (방송 중)" : "라이브 스튜디오 열기"}
              </span>
            </Link>
            <Link
              href={`/org/${orgId}/tori-fm`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20"
            >
              <span aria-hidden>➕</span>
              <span>새 세션</span>
            </Link>
          </div>
        </div>

        {/* LIVE 세션 강조 */}
        {liveSession && (
          <div className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="relative inline-flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-300 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
                  지금 방송 중
                </span>
                <span className="truncate text-sm font-bold">
                  🎙 {liveSession.title || "(제목 없음)"}
                </span>
              </div>
              <Link
                href={`/screen/tori-fm/${orgId}?tv=1`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-black/30 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-black/40"
              >
                <span aria-hidden>📺</span>
                <span>전광판↗</span>
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* 에러 / 성공 */}
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

      {/* ────── 연결된 세션 그룹 (LIVE / UPCOMING / PAST) ────── */}
      {linkedSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="text-5xl" aria-hidden>
            🎙
          </div>
          <p className="mt-3 text-sm font-bold text-[#2D5A3D]">
            이 행사에 연결된 FM 세션이 없어요
          </p>
          <p className="mt-1 max-w-sm text-xs text-[#6B6560]">
            아래에서 미연결 세션을 골라 연결하거나, 라이브 스튜디오에서 새
            세션을 만들 수 있어요.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {(["LIVE", "UPCOMING", "PAST"] as Bucket[]).map((bucket) => {
            const list = grouped[bucket];
            if (list.length === 0) return null;
            const meta = BUCKET_META[bucket];
            return (
              <section key={bucket} className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
                  <span aria-hidden>{meta.emoji}</span>
                  <span>{meta.label}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.chip}`}
                  >
                    {list.length}
                  </span>
                </h3>
                <ul className="space-y-2">
                  {list.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      bucket={bucket}
                      orgId={orgId}
                      disabled={isPending}
                      pending={pendingId === s.id}
                      onRemove={() => onUnlink(s.id, s.is_live)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {/* ────── 하단 접이식: 미연결 세션 추가 ────── */}
      {unlinkedSessions.length > 0 && (
        <section className="rounded-2xl border border-[#D4E4BC] bg-white shadow-sm">
          <details className="group" open={false}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-[#FAE7D0] via-white to-[#E8F0E4] p-4">
              <div className="flex items-center gap-2 text-[#2D5A3D]">
                <span aria-hidden className="text-xl">
                  ➕
                </span>
                <div>
                  <p className="text-sm font-bold">
                    이 행사에 연결할 미연결 FM 세션
                  </p>
                  <p className="text-[11px] text-[#6B6560]">
                    어떤 행사에도 연결되지 않은 세션 {unlinkedSessions.length}
                    개가 있어요. 골라서 연결할 수 있어요.
                  </p>
                </div>
              </div>
              <span
                aria-hidden
                className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-[#2D5A3D] shadow-sm transition group-open:rotate-180"
              >
                ▼
              </span>
            </summary>

            <div className="space-y-3 border-t border-[#D4E4BC] p-4">
              <ul className="space-y-2">
                {unlinkedSessions.map((s) => {
                  const isChecked = bulkSelected.has(s.id);
                  return (
                    <li
                      key={s.id}
                      className={`rounded-xl border p-3 transition ${
                        isChecked
                          ? "border-emerald-500 bg-emerald-50/30"
                          : "border-[#F0E8D8] bg-[#FFFDF8]"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleBulk(s.id)}
                            className="h-4 w-4 rounded border-[#D4E4BC] text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#2D5A3D]">
                              🎙 {s.title || "(제목 없음)"}
                            </p>
                            <p className="text-[11px] text-[#6B6560]">
                              🕐 {fmtDateTime(s.scheduled_start)} ~{" "}
                              {fmtDateTime(s.scheduled_end)}
                            </p>
                          </div>
                        </label>
                        <button
                          type="button"
                          onClick={() => onLink(s.id)}
                          disabled={isPending}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:from-[#234a30] hover:to-[#2D5A3D] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span aria-hidden>{pendingId === s.id ? "⏳" : "➕"}</span>
                          <span>바로 연결</span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-xs text-[#6B6560]">
                  선택{" "}
                  <b className="text-[#2D5A3D]">
                    {bulkSelected.size.toLocaleString("ko-KR")}개
                  </b>
                </span>
                <button
                  type="button"
                  onClick={() => setBulkSelected(new Set())}
                  disabled={bulkSelected.size === 0}
                  className="rounded-lg border border-[#E5D3B8] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B4423] hover:bg-[#FFF8F0] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  전체 해제
                </button>
                <button
                  type="button"
                  onClick={onBulkLink}
                  disabled={bulkSelected.size === 0 || bulkPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2 text-xs font-bold text-white shadow-sm hover:from-[#234a30] hover:to-[#2D5A3D] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span aria-hidden>{bulkPending ? "⏳" : "➕"}</span>
                  <span>
                    {bulkPending ? "연결 중..." : "선택 항목 모두 연결"}
                  </span>
                </button>
              </div>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}

function SessionCard({
  session,
  bucket,
  orgId,
  disabled,
  pending,
  onRemove,
}: {
  session: FmSessionOption;
  bucket: Bucket;
  orgId: string;
  disabled: boolean;
  pending: boolean;
  onRemove: () => void;
}) {
  const isLive = bucket === "LIVE";
  return (
    <li
      className={`rounded-2xl border p-4 shadow-sm transition ${
        isLive
          ? "border-rose-400 bg-rose-50/40 ring-2 ring-rose-300/30"
          : bucket === "UPCOMING"
            ? "border-emerald-300 bg-emerald-50/30"
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
            <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              🔗 연결됨
            </span>
          </div>
          <h4 className="mt-1.5 truncate text-sm font-bold text-[#2D5A3D]">
            🎙 {session.title || "(제목 없음)"}
          </h4>
          <p className="mt-1 text-[11px] text-[#6B6560]">
            🕐 {fmtDateTime(session.scheduled_start)} ~{" "}
            {fmtDateTime(session.scheduled_end)}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Link
            href={`/org/${orgId}/tori-fm`}
            className="inline-flex items-center gap-1 rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#2D5A3D] hover:bg-[#F5F1E8]"
          >
            <span aria-hidden>✏️</span>
            <span>편집</span>
          </Link>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            title="이 행사에서만 연결 해제 (FM 세션 자체는 보존)"
            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span aria-hidden>{pending ? "⏳" : "🚫"}</span>
            <span>행사제외</span>
          </button>
        </div>
      </div>
    </li>
  );
}
