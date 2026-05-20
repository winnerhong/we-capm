"use client";

// 타임테이블 템플릿 편집 폼 — 이름·설명 + 슬롯 리스트(소요시간/순서).
//   슬롯 추가/수정 폼은 공용 SlotForm 재사용. 시작 시각은 다루지 않음.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveTimetableTemplateAction } from "@/lib/timetable-templates/actions";
import { SlotForm, fmtDuration, type DraftSlot } from "@/components/timetable/slot-form";
import { SLOT_KIND_META } from "@/lib/event-timeline/types";

interface InitialValue {
  id: string;
  name: string;
  description: string;
  slots: DraftSlot[];
}

interface Props {
  initial: InitialValue | null;
}

const FIELD_CLS =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";

export function TemplateForm({ initial }: Props) {
  const router = useRouter();
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [drafts, setDrafts] = useState<DraftSlot[]>(initial?.slots ?? []);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totalMin = drafts.reduce((s, d) => s + d.duration_min, 0);

  const onAdd = (draft: DraftSlot) => {
    setDrafts((prev) => [...prev, draft]);
    setShowAddForm(false);
  };
  const onSaveEdit = (idx: number, draft: DraftSlot) => {
    setDrafts((prev) => {
      const next = prev.slice();
      next[idx] = { ...draft, id: next[idx].id };
      return next;
    });
    setEditingIdx(null);
  };
  const onMove = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= drafts.length) return;
    setDrafts((prev) => {
      const next = prev.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };
  const onDelete = (idx: number) => {
    if (!window.confirm("이 슬롯을 삭제할까요?")) return;
    setDrafts((prev) => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) setEditingIdx(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("템플릿 이름을 입력해 주세요");
      return;
    }
    startTransition(async () => {
      try {
        await saveTimetableTemplateAction({
          id: initial?.id ?? null,
          name: trimmedName,
          description: description.trim() || null,
          slots: drafts.map((d) => ({
            slot_kind: d.slot_kind,
            title: d.title,
            description: d.description,
            location: d.location,
            icon_emoji: d.icon_emoji,
            duration_min: d.duration_min,
          })),
        });
        router.push("/partner/timetable-templates");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장 실패");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 기본 정보 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>📋</span>
          <span>템플릿 정보</span>
        </h3>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
              템플릿 이름 <span className="text-rose-600">*</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              placeholder="예) 숲속 가족행사 기본 진행표"
              className={FIELD_CLS}
              disabled={pending}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
              설명 (선택)
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="예) 3시간 코스 · 미션 2개 + 자유시간 포함"
              className={FIELD_CLS}
              disabled={pending}
            />
          </label>
        </div>
      </section>

      {/* 슬롯 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>🕒</span>
            <span>슬롯</span>
          </h3>
          <span className="text-[11px] text-[#6B6560]">
            총 {drafts.length}개 · 누적 {fmtDuration(totalMin)}
          </span>
        </div>

        {drafts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-6 text-center text-xs text-[#8B7F75]">
            아직 슬롯이 없어요. 아래 버튼으로 첫 슬롯을 만들어 보세요.
          </p>
        ) : (
          <ul className="space-y-2">
            {drafts.map((d, idx) => {
              const meta = SLOT_KIND_META[d.slot_kind];
              const isEditing = editingIdx === idx;
              const icon = d.icon_emoji || meta.defaultEmoji;
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
                          <span className="text-[10px] text-[#6B6560]">
                            ({fmtDuration(d.duration_min)})
                          </span>
                          <span className="rounded-full bg-[#E8F0E4] px-1.5 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                            {meta.label}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-sm font-bold text-[#2D5A3D]">
                          {d.title || (
                            <span className="text-[#8B7F75]">(제목 없음)</span>
                          )}
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

        <div className="mt-2">
          {!showAddForm ? (
            <button
              type="button"
              onClick={() => {
                setShowAddForm(true);
                setEditingIdx(null);
              }}
              disabled={pending}
              className="w-full rounded-xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#234A31] disabled:opacity-50"
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
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200"
        >
          ⚠ {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push("/partner/timetable-templates")}
          disabled={pending}
          className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0] disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] disabled:opacity-50"
        >
          <span aria-hidden>{isEdit ? "💾" : "🌱"}</span>
          <span>
            {pending
              ? "저장 중..."
              : isEdit
                ? "변경사항 저장"
                : "템플릿 등록"}
          </span>
        </button>
      </div>
    </form>
  );
}
