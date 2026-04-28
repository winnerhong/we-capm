"use client";

// 행사 타임테이블 편집기 — 기관 측 (새 모델: 소요 시간 + 순서).
//   - 시작 시각 입력 X. 행사 starts_at + 누적 duration 으로 시각 자동 계산.
//   - ↑↓ 버튼으로 순서 변경 → 전체 시각 자동 재계산.
//   - 모든 변경 (추가/수정/삭제/순서) 은 resyncTimelineSlotsAction 으로 일괄 저장.

import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { resyncTimelineSlotsAction } from "@/lib/event-timeline/actions";
import {
  SLOT_KIND_META,
  SLOT_KIND_OPTIONS,
  type SlotKind,
  type TimelineSlotRow,
} from "@/lib/event-timeline/types";

interface Props {
  orgId: string;
  eventId: string;
  eventStartsAt: string;
  initialSlots: TimelineSlotRow[];
}

interface DraftSlot {
  id: string | null;
  slot_kind: SlotKind;
  title: string;
  description: string | null;
  location: string | null;
  icon_emoji: string | null;
  duration_min: number;
}

const INPUT_CLASS =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";
const LABEL_CLASS = "mb-1 block text-xs font-semibold text-[#2D5A3D]";

const DURATION_PRESETS_MIN = [10, 15, 20, 25, 30];
const DURATION_MIN = 5;
const DURATION_MAX = 30;
const DURATION_STEP = 5;

/** 분 → "1시간 30분" 라벨. */
function fmtDuration(min: number): string {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

/** "HH:MM" 24시간 포맷. */
function fmtClock(ms: number): string {
  if (!Number.isFinite(ms)) return "--:--";
  const d = new Date(ms);
  return d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

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
                        onClick={() => setEditingIdx(idx)}
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
          onClick={() => setShowAddForm(true)}
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

/* -------------------------------------------------------------------------- */
/* SlotForm — 추가/수정 공용 (시각 입력 X, 소요시간 + 메타만)                  */
/* -------------------------------------------------------------------------- */

function SlotForm({
  mode,
  initial,
  onCancel,
  onSave,
  pending,
}: {
  mode: "create" | "edit";
  initial?: DraftSlot;
  onCancel: () => void;
  onSave: (draft: DraftSlot) => void;
  pending: boolean;
}) {
  const [kind, setKind] = useState<SlotKind>(initial?.slot_kind ?? "MISSION");
  const [durationMin, setDurationMin] = useState<number>(
    initial?.duration_min ?? 15
  );
  const [title, setTitle] = useState<string>(initial?.title ?? "");
  const [description, setDescription] = useState<string>(
    initial?.description ?? ""
  );
  const [location, setLocation] = useState<string>(initial?.location ?? "");
  const [iconEmoji, setIconEmoji] = useState<string>(initial?.icon_emoji ?? "");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      id: initial?.id ?? null,
      slot_kind: kind,
      title: title.trim(),
      description: description.trim() ? description.trim() : null,
      location: location.trim() ? location.trim() : null,
      icon_emoji: iconEmoji.trim() ? iconEmoji.trim() : null,
      duration_min: Math.max(5, Math.round(durationMin / 5) * 5),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl bg-[#FFF8F0] p-3"
    >
      {/* 종류 */}
      <div>
        <label className={LABEL_CLASS}>종류</label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as SlotKind)}
          className={INPUT_CLASS}
        >
          {SLOT_KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.emoji} {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* 소요 시간 — 슬라이더 + 칩 */}
      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className={LABEL_CLASS}>
            📏 소요 시간{" "}
            <span className="text-[10px] font-normal text-[#8B7F75]">
              (5분 단위)
            </span>
          </span>
          <span className="text-sm font-bold text-[#2D5A3D]">
            {fmtDuration(durationMin)}
          </span>
        </div>
        <input
          type="range"
          min={DURATION_MIN}
          max={DURATION_MAX}
          step={DURATION_STEP}
          list="slot-duration-ticks"
          value={Math.min(Math.max(durationMin, DURATION_MIN), DURATION_MAX)}
          onChange={(e) => {
            const raw = Number(e.target.value);
            if (!Number.isFinite(raw)) return;
            const snapped = Math.max(
              DURATION_MIN,
              Math.min(DURATION_MAX, Math.round(raw / DURATION_STEP) * DURATION_STEP)
            );
            setDurationMin(snapped);
          }}
          className="w-full accent-[#2D5A3D]"
          aria-label="소요 시간"
        />
        <datalist id="slot-duration-ticks">
          {Array.from(
            { length: (DURATION_MAX - DURATION_MIN) / DURATION_STEP + 1 },
            (_, i) => DURATION_MIN + i * DURATION_STEP
          ).map((v) => (
            <option key={v} value={v} label={`${v}분`} />
          ))}
        </datalist>
        <div className="mb-2 flex justify-between px-0.5 text-[10px] text-[#8B7F75]">
          {Array.from(
            { length: (DURATION_MAX - DURATION_MIN) / DURATION_STEP + 1 },
            (_, i) => DURATION_MIN + i * DURATION_STEP
          ).map((v) => (
            <span key={v} className="font-mono">
              {v}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DURATION_PRESETS_MIN.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setDurationMin(m)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                durationMin === m
                  ? "border-[#2D5A3D] bg-[#2D5A3D] text-white shadow-sm"
                  : "border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#F5F1E8]"
              }`}
            >
              {fmtDuration(m)}
            </button>
          ))}
          <input
            type="number"
            min={5}
            max={600}
            step={5}
            value={durationMin}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) setDurationMin(n);
            }}
            placeholder="직접 입력"
            className="w-20 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 focus:border-amber-500 focus:outline-none"
            aria-label="직접 입력 (분)"
          />
        </div>
      </div>

      {/* 제목 */}
      <div>
        <label className={LABEL_CLASS}>
          제목 <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          required
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            kind === "MEAL"
              ? "예: 점심"
              : kind === "MISSION"
                ? "예: 우리 가족 사진 찍기"
                : "슬롯 제목"
          }
          className={INPUT_CLASS}
        />
      </div>

      {/* 설명 */}
      <div>
        <label className={LABEL_CLASS}>설명 (옵션)</label>
        <textarea
          rows={2}
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="짧은 안내 문구"
          className={INPUT_CLASS}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL_CLASS}>장소 (옵션)</label>
          <input
            type="text"
            maxLength={100}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="강당 / 숲속 1번"
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>아이콘 이모지 (옵션)</label>
          <input
            type="text"
            maxLength={8}
            value={iconEmoji}
            onChange={(e) => setIconEmoji(e.target.value)}
            placeholder={SLOT_KIND_META[kind].defaultEmoji}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8] disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="rounded-xl bg-[#2D5A3D] px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#234A31] disabled:opacity-50"
        >
          {pending ? "처리 중…" : mode === "create" ? "💾 추가" : "💾 저장"}
        </button>
      </div>
    </form>
  );
}
