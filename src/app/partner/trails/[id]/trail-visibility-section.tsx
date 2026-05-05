"use client";

import { useState } from "react";
import {
  TRAIL_VISIBILITY_META,
  TRAIL_VISIBILITY_OPTIONS,
  type TrailVisibility,
} from "@/lib/trails/types";
import {
  TrailAssignmentsPicker,
  type TrailOrgOption,
} from "./trail-assignments-picker";

interface Props {
  defaultVisibility: TrailVisibility;
  orgs: TrailOrgOption[];
  defaultAssignedOrgIds: string[];
}

/**
 * 배포 대상(공개 범위 + 지정 기관) — 서버 form 안에 포함될 때 hidden input
 * 으로 값 전송. 자체 저장 버튼 없음 (상위 form 의 통합 저장에 위임).
 */
export function TrailVisibilitySection({
  defaultVisibility,
  orgs,
  defaultAssignedOrgIds,
}: Props) {
  const [visibility, setVisibility] =
    useState<TrailVisibility>(defaultVisibility);
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>(
    defaultAssignedOrgIds
  );

  return (
    <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>📡</span>
          <span>배포 대상</span>
        </h2>
      </div>
      <p className="mb-4 text-[11px] text-[#6B6560]">
        이 숲길을 어떤 기관에게 노출할지 선택하세요. 아래 ‘전체 저장’ 버튼으로
        함께 저장됩니다.
      </p>

      <div
        role="radiogroup"
        aria-label="배포 대상 선택"
        className="grid grid-cols-1 gap-2 md:grid-cols-2"
      >
        {TRAIL_VISIBILITY_OPTIONS.map((opt) => {
          const meta = TRAIL_VISIBILITY_META[opt];
          const checked = visibility === opt;
          return (
            <label
              key={opt}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                checked
                  ? "border-[#2D5A3D] bg-[#E8F0E4] ring-2 ring-[#2D5A3D]/20"
                  : "border-[#D4E4BC] bg-[#FFF8F0] hover:border-[#3A7A52]"
              }`}
            >
              <input
                type="radio"
                name="trail_visibility_radio"
                value={opt}
                checked={checked}
                onChange={() => setVisibility(opt)}
                className="mt-1 h-4 w-4 flex-none accent-[#2D5A3D]"
                aria-label={meta.label}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg" aria-hidden>
                    {meta.icon}
                  </span>
                  <span className="text-sm font-bold text-[#2D5A3D]">
                    {meta.label}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[#6B6560]">{meta.desc}</p>
              </div>
            </label>
          );
        })}
      </div>

      {visibility === "SELECTED" && (
        <div className="mt-5 rounded-xl border border-[#D4E4BC] bg-[#FFFDF8] p-4">
          <h3 className="mb-1 flex items-center gap-1.5 text-xs font-bold text-[#2D5A3D]">
            <span aria-hidden>🎯</span>
            <span>노출할 기관 선택</span>
          </h3>
          <p className="mb-3 text-[11px] text-[#6B6560]">
            체크된 기관에만 이 숲길이 노출됩니다.
          </p>
          <TrailAssignmentsPicker
            orgs={orgs}
            selected={selectedOrgIds}
            onChange={setSelectedOrgIds}
          />
        </div>
      )}

      {visibility === "ALL" && (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-900">
          🌍 모든 기관의 숲길 목록에 자동 노출됩니다.
        </p>
      )}
      {visibility === "DRAFT" && (
        <p className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-700">
          ✏️ 초안 상태 — 어떤 기관에도 노출되지 않아요. 작업 완료 후 공개 범위를
          전환하세요.
        </p>
      )}
      {visibility === "ARCHIVED" && (
        <p className="mt-4 rounded-xl border border-zinc-300 bg-zinc-100 px-3 py-2 text-[11px] text-zinc-700">
          📦 보관됨 — 목록에서 숨겨집니다. 기존 기관 접근은 유지되지만 신규
          노출은 차단됩니다.
        </p>
      )}

      {/* 통합 저장에 함께 전송될 hidden inputs */}
      <input type="hidden" name="visibility" value={visibility} />
      <input
        type="hidden"
        name="assigned_org_ids"
        value={selectedOrgIds.join(",")}
      />
    </section>
  );
}
