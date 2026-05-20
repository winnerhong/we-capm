"use client";

// 행사 타임테이블 편집기 — 기관 측 (새 모델: 소요 시간 + 순서).
//   - 시작 시각 입력 X. 행사 starts_at + 누적 duration 으로 시각 자동 계산.
//   - ↑↓ 버튼으로 순서 변경 → 전체 시각 자동 재계산.
//   - 모든 변경 (추가/수정/삭제/순서) 은 resyncTimelineSlotsAction 으로 일괄 저장.

import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { resyncTimelineSlotsAction } from "@/lib/event-timeline/actions";
import { SLOT_KIND_META, type TimelineSlotRow } from "@/lib/event-timeline/types";
import { fmtClockKstFromMs } from "@/lib/datetime/kst";
import {
  SlotForm,
  fmtDuration,
  type DraftSlot,
} from "@/components/timetable/slot-form";
import type { PartnerTimetableTemplateRow } from "@/lib/timetable-templates/types";

interface Props {
  orgId: string;
  eventId: string;
  eventStartsAt: string;
  initialSlots: TimelineSlotRow[];
  /** 우리 지사가 만든 타임테이블 기본 템플릿 — "가져오기" 셀렉터에 사용. */
  templates: PartnerTimetableTemplateRow[];
}

/** "HH:MM" 24시간 포맷 — Asia/Seoul 고정 (SSR/CSR 동일). */
const fmtClock = fmtClockKstFromMs;

/** ends_at - starts_at → 분. 5분 단위로 반올림. */
function deriveDuration(row: TimelineSlotRow): number {
  if (!row.ends_at) return 30;
  const diff =
    (new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime()) /
    60_000;
  return Math.max(5, Math.round(diff / 5) * 5);
}

function rowToDraft(row: TimelineSlotRow): DraftSlot {
  return {
    id: row.id,
    slot_kind: row.slot_kind,
    title: row.title,
    description: row.description,
    location: row.location,
    icon_emoji: row.icon_emoji,
    duration_min: deriveDuration(row),
  };
}

/** 드래프트 배열 → 각 슬롯의 시작/종료 ms 계산. */
function computeSchedule(
  drafts: DraftSlot[],
  eventStartsAtMs: number
): Array<{ startsMs: number; endsMs: number }> {
  let cursor = eventStartsAtMs;
  return drafts.map((d) => {
    const startsMs = cursor;
    const endsMs = cursor + d.duration_min * 60_000;
    cursor = endsMs;
    return { startsMs, endsMs };
  });
}

export function TimelineEditor({
  orgId: _orgId,
  eventId,
  eventStartsAt,
  initialSlots,
  templates,
}: Props) {
  void _orgId; // 미래 RLS / per-org 필터링용 예약

  const eventStartsAtMs = useMemo(() => {
    const t = new Date(eventStartsAt).getTime();
    return Number.isFinite(t) ? t : Date.now();
  }, [eventStartsAt]);

  // initialSlots 는 starts_at 정렬되어 있음 — 그대로 draft 로 변환
  const [drafts, setDrafts] = useState<DraftSlot[]>(() =>
    initialSlots.map(rowToDraft)
  );
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // SSR 데이터 동기화 — 외부에서 데이터가 바뀌면 (Realtime 이벤트로 router.refresh) 다시 빌드
  useEffect(() => {
    setDrafts(initialSlots.map(rowToDraft));
  }, [initialSlots]);

  // Realtime — 다른 클라이언트의 변경 감지하면 페이지 리프레시 (간단)
  useEffect(() => {
    if (!eventId) return;
    const supa = createClient();
    const ch = supa
      .channel(`timeline-editor-${eventId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "org_event_timeline_slots",
          filter: `event_id=eq.${eventId}`,
        } as never,
        (() => {
          // 외부 변경 — 가장 단순하게 페이지 리로드 신호
          // (현재 사용자가 편집 중이면 자기 액션으로 트리거된 것이므로 무시 가능)
          // 일단 noop. 필요 시 router.refresh().
        }) as never
      )
      .subscribe();
    return () => {
      void supa.removeChannel(ch);
    };
  }, [eventId]);

  const schedule = useMemo(
    () => computeSchedule(drafts, eventStartsAtMs),
    [drafts, eventStartsAtMs]
  );

  const totalMs = drafts.reduce((sum, d) => sum + d.duration_min * 60_000, 0);

  const persist = (next: DraftSlot[], successMsg: string) => {
    setError(null);
    setDrafts(next); // 옵티미스틱
    startTransition(async () => {
      try {
        await resyncTimelineSlotsAction(
          eventId,
          next.map((d) => ({
            id: d.id ?? undefined,
            slot_kind: d.slot_kind,
            title: d.title,
            description: d.description,
            location: d.location,
            icon_emoji: d.icon_emoji,
            duration_min: d.duration_min,
          }))
        );
        setFeedback(`✅ ${successMsg}`);
        setTimeout(() => setFeedback(null), 1800);
      } catch (e) {
        setError(e instanceof Error ? e.message : "처리 실패");
        // 실패 시 원본으로 복귀하지는 않음 — 사용자가 다시 시도하도록 둠
      }
    });
  };

  const onAdd = (draft: DraftSlot) => {
    persist([...drafts, draft], "슬롯 추가");
    setShowAddForm(false);
  };

  const onSaveEdit = (idx: number, draft: DraftSlot) => {
    const next = drafts.slice();
    next[idx] = { ...next[idx], ...draft, id: next[idx].id };
    persist(next, "슬롯 수정");
    setEditingIdx(null);
  };

  const onMove = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= drafts.length) return;
    const next = drafts.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    persist(next, dir < 0 ? "위로 이동" : "아래로 이동");
  };

  const onDelete = (idx: number) => {
    if (!confirm("이 슬롯을 삭제할까요?")) return;
    const next = drafts.slice();
    next.splice(idx, 1);
    persist(next, "슬롯 삭제");
  };

  const applyTemplate = (
    tpl: PartnerTimetableTemplateRow,
    mode: "replace" | "append"
  ) => {
    if (tpl.slots.length === 0) return;
    if (
      mode === "replace" &&
      drafts.length > 0 &&
      !confirm(
        `현재 슬롯 ${drafts.length}개를 모두 지우고 "${tpl.name}" 템플릿으로 교체할까요?`
      )
    ) {
      return;
    }
    const mapped: DraftSlot[] = tpl.slots.map((s) => ({
      id: null,
      slot_kind: s.slot_kind,
      title: s.title,
      description: s.description,
      location: s.location,
      icon_emoji: s.icon_emoji,
      duration_min: s.duration_min,
    }));
    persist(
      mode === "replace" ? mapped : [...drafts, ...mapped],
      mode === "replace" ? "템플릿으로 교체" : "템플릿 슬롯 추가"
    );
    setShowImport(false);
  };

  return (
    <div className="space-y-3">
      {feedback && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          {feedback}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
        >
          ⚠ {error}
        </p>
      )}

      {/* 기본 템플릿 가져오기 — 지사가 만든 템플릿이 있을 때만 노출 */}
      {templates.length > 0 && (
        <div className="rounded-xl border border-[#E5D3B8] bg-[#FFF8F0]">
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            disabled={pending}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-bold text-[#8B6F47] disabled:opacity-50"
          >
            <span>📋 기본 템플릿 가져오기</span>
            <span
              className={`text-[10px] transition-transform ${showImport ? "rotate-180" : ""}`}
            >
              ▼
            </span>
          </button>
          {showImport && (
            <ul className="space-y-1.5 border-t border-[#E5D3B8] p-2">
              {templates.map((tpl) => {
                const totalMin = tpl.slots.reduce(
                  (s, x) => s + x.duration_min,
                  0
                );
                const empty = tpl.slots.length === 0;
                return (
                  <li
                    key={tpl.id}
                    className="rounded-lg border border-[#E5D3B8] bg-white p-2"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-sm font-bold text-[#2D5A3D]">
                        {tpl.name}
                      </span>
                      <span className="text-[10px] text-[#8B7F75]">
                        슬롯 {tpl.slots.length}개 · 누적 {fmtDuration(totalMin)}
                      </span>
                    </div>
                    {tpl.description && (
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-[#6B6560]">
                        {tpl.description}
                      </p>
                    )}
                    <div className="mt-1.5 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyTemplate(tpl, "replace")}
                        disabled={pending || empty}
                        className="rounded-lg bg-[#2D5A3D] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#234A31] disabled:opacity-40"
                      >
                        전체 교체
                      </button>
                      <button
                        type="button"
                        onClick={() => applyTemplate(tpl, "append")}
                        disabled={pending || empty}
                        className="rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1 text-[11px] font-bold text-[#2D5A3D] hover:bg-[#F5F1E8] disabled:opacity-40"
                      >
                        뒤에 추가
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* 요약 바 */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-[11px] text-[#2D5A3D]">
        <span className="font-semibold">
          🕒 행사 시작 · <span className="font-mono">{fmtClock(eventStartsAtMs)}</span>
        </span>
        <span className="text-[#6B6560]">
          총 {drafts.length}개 슬롯 · 누적 {fmtDuration(Math.round(totalMs / 60_000))}{" "}
          (종료 예정{" "}
          <span className="font-mono">
            {fmtClock(eventStartsAtMs + totalMs)}
          </span>
          )
        </span>
      </div>

      {/* 슬롯 리스트 */}
      {drafts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-6 text-center text-xs text-[#8B7F75]">
          아직 슬롯이 없어요. 아래 버튼으로 첫 슬롯을 만들어 보세요.
        </p>
      ) : (
        <ul className="space-y-2">
          {drafts.map((d, idx) => {
            const meta = SLOT_KIND_META[d.slot_kind];
            const isEditing = editingIdx === idx;
            const icon = d.icon_emoji || meta.defaultEmoji;
            const sched = schedule[idx];
            return (
              <li
                key={d.id ?? `new-${idx}`}
                className="rounded-2xl border border-[#D4E4BC] bg-white p-3 shadow-sm"
              >
                {!isEditing ? (
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex shrink-0 flex-col items-center gap-1">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2D5A3D] text-xs font-bold text-white">
                        {idx + 1}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => onMove(idx, -1)}
                          disabled={pending || idx === 0}
                          aria-label="위로 이동"
                          className="rounded border border-[#D4E4BC] bg-white px-1 text-[10px] text-[#2D5A3D] hover:bg-[#F5F1E8] disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => onMove(idx, 1)}
                          disabled={pending || idx === drafts.length - 1}
                          aria-label="아래로 이동"
                          className="rounded border border-[#D4E4BC] bg-white px-1 text-[10px] text-[#2D5A3D] hover:bg-[#F5F1E8] disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8F0E4] text-xl">
                      {icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-mono text-[12px] font-bold tabular-nums text-[#2D5A3D]">
                          {fmtClock(sched.startsMs)} ~ {fmtClock(sched.endsMs)}
                        </span>
                        <span className="text-[10px] text-[#6B6560]">
                          ({fmtDuration(d.duration_min)})
                        </span>
                        <span className="rounded-full bg-[#E8F0E4] px-1.5 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm font-bold text-[#2D5A3D]">
                        {d.title || <span className="text-[#8B7F75]">(제목 없음)</span>}
                      </p>
                      {d.description && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-[#6B6560]">
                          {d.description}
                        </p>
                      )}
                      {d.location && (
                        <p className="mt-0.5 text-[11px] text-[#8B7F75]">
                          📍 {d.location}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingIdx(idx);
                          setShowAddForm(false);
                        }}
                        disabled={pending}
                        className="rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8] disabled:opacity-40"
                      >
                        ✏ 수정
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(idx)}
                        disabled={pending}
                        className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                      >
                        🗑 삭제
                      </button>
                    </div>
                  </div>
                ) : (
                  <SlotForm
                    mode="edit"
                    initial={d}
                    onCancel={() => setEditingIdx(null)}
                    onSave={(draft) => onSaveEdit(idx, draft)}
                    pending={pending}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* 추가 폼 토글 — 리스트 하단 */}
      {!showAddForm ? (
        <button
          type="button"
          onClick={() => {
            setShowAddForm(true);
            setEditingIdx(null);
          }}
          className="w-full rounded-xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#234A31]"
        >
          ➕ 슬롯 추가
        </button>
      ) : (
        <SlotForm
          mode="create"
          onCancel={() => setShowAddForm(false)}
          onSave={onAdd}
          pending={pending}
        />
      )}
    </div>
  );
}
