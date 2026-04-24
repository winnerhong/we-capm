"use client";

import { useMemo, useState } from "react";

export interface TrailOrgOption {
  id: string;
  org_name: string;
  org_type: string;
  representative_phone?: string | null;
  org_phone?: string | null;
}

const ORG_TYPE_LABEL: Record<string, { label: string; chip: string }> = {
  DAYCARE: { label: "어린이집", chip: "bg-rose-50 text-rose-700 border-rose-200" },
  KINDER: {
    label: "유치원",
    chip: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  },
  SCHOOL: { label: "학교", chip: "bg-sky-50 text-sky-700 border-sky-200" },
  OFFICE: {
    label: "교육청",
    chip: "bg-violet-50 text-violet-700 border-violet-200",
  },
  COMPANY: { label: "기업", chip: "bg-amber-50 text-amber-800 border-amber-200" },
  OTHER: { label: "기타", chip: "bg-zinc-50 text-zinc-700 border-zinc-200" },
};

function formatPhone(p: string | null | undefined): string {
  if (!p) return "-";
  const s = p.replace(/\D/g, "");
  if (s.length === 11) return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7)}`;
  if (s.length === 10) return `${s.slice(0, 3)}-${s.slice(3, 6)}-${s.slice(6)}`;
  return p;
}

interface Props {
  orgs: TrailOrgOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

/**
 * controlled 멀티 셀렉트: 상위(visibility-section)에서 선택된 orgIds를 관리한다.
 * 검색 + 전체선택/해제 + 체크박스 그리드.
 */
export function TrailAssignmentsPicker({
  orgs,
  selected,
  onChange,
  disabled,
}: Props) {
  const [q, setQ] = useState("");

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return orgs;
    return orgs.filter((o) => o.org_name.toLowerCase().includes(needle));
  }, [orgs, q]);

  const toggle = (id: string) => {
    if (disabled) return;
    if (selectedSet.has(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const selectAll = () => {
    if (disabled) return;
    const merged = new Set([...selected, ...filtered.map((o) => o.id)]);
    onChange(Array.from(merged));
  };

  const clearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  return (
    <div className="space-y-3">
      {/* 검색 + 일괄 버튼 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[180px]">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="🔍 기관명 검색"
            aria-label="기관명 검색"
            disabled={disabled}
            className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30 disabled:opacity-60"
          />
        </div>
        <button
          type="button"
          onClick={selectAll}
          disabled={disabled}
          className="rounded-lg border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4] disabled:opacity-60"
        >
          전체 선택
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={disabled}
          className="rounded-lg border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B6560] hover:bg-[#FFF8F0] disabled:opacity-60"
        >
          전체 해제
        </button>
      </div>

      {/* 선택 카운터 */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#6B6560]">
          전체 {orgs.length}개 / 표시 {filtered.length}개
        </span>
        <span className="font-bold text-[#2D5A3D]">
          선택됨 {selected.length}개
        </span>
      </div>

      {/* 체크박스 리스트 */}
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-3 py-6 text-center text-xs text-[#8B7F75]">
          {orgs.length === 0
            ? "등록된 기관이 없습니다. 먼저 기관 고객을 등록해 주세요."
            : "검색 결과가 없습니다."}
        </p>
      ) : (
        <ul
          className="grid max-h-[360px] grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-2 md:grid-cols-2"
          role="listbox"
          aria-label="기관 선택"
          aria-multiselectable="true"
        >
          {filtered.map((o) => {
            const typeMeta = ORG_TYPE_LABEL[o.org_type] ?? ORG_TYPE_LABEL.OTHER;
            const isSelected = selectedSet.has(o.id);
            return (
              <li key={o.id}>
                <label
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 transition ${
                    isSelected
                      ? "border-[#2D5A3D] bg-[#E8F0E4] ring-2 ring-[#2D5A3D]/20"
                      : "border-[#D4E4BC] bg-white hover:border-[#3A7A52] hover:bg-[#F5F1E8]"
                  } ${disabled ? "pointer-events-none opacity-60" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(o.id)}
                    disabled={disabled}
                    className="mt-0.5 h-4 w-4 flex-none accent-[#2D5A3D]"
                    aria-label={`${o.org_name} 선택`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${typeMeta.chip}`}
                      >
                        {typeMeta.label}
                      </span>
                      <span className="truncate text-sm font-bold text-[#2D5A3D]">
                        {o.org_name}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-[#6B6560]">
                      {formatPhone(o.representative_phone ?? o.org_phone)}
                    </p>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
