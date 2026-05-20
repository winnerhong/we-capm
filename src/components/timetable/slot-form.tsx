"use client";

// 타임테이블 슬롯 추가/수정 폼 — 공용.
//   org 행사 타임테이블 편집기와 지사 타임테이블 템플릿 편집기가 함께 사용.
//   시각 입력 없이 "종류 + 소요시간 + 메타" 만 받는다.

import { useState } from "react";
import {
  SLOT_KIND_META,
  SLOT_KIND_OPTIONS,
  type SlotKind,
} from "@/lib/event-timeline/types";

/** 슬롯 편집용 드래프트 — id 가 null 이면 신규. */
export interface DraftSlot {
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
export function fmtDuration(min: number): string {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

export function SlotForm({
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
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl bg-[#FFF8F0] p-3">
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
              Math.min(
                DURATION_MAX,
                Math.round(raw / DURATION_STEP) * DURATION_STEP
              )
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
            value={String(durationMin)}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) setDurationMin(n);
            }}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n) || n < 5) {
                setDurationMin(5);
              } else {
                setDurationMin(Math.min(600, Math.round(n / 5) * 5));
              }
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
