"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  queryKey?: string;
  selectKey?: string;
  selectLabel?: string;
  selectOptions?: SelectOption[];
  placeholder?: string;
  preserveKeys?: string[];
}

export function ListSearchBar({
  queryKey = "q",
  selectKey,
  selectLabel,
  selectOptions,
  placeholder = "이름으로 검색...",
  preserveKeys = [],
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get(queryKey) ?? "");
  const [selectValue, setSelectValue] = useState(
    (selectKey && params.get(selectKey)) ?? ""
  );
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyFilters = (next: { q?: string; selectVal?: string }) => {
    const p = new URLSearchParams();
    // preserve kept keys
    for (const k of preserveKeys) {
      const v = params.get(k);
      if (v) p.set(k, v);
    }
    const qv = next.q ?? q;
    const sv = next.selectVal ?? selectValue;
    if (qv.trim()) p.set(queryKey, qv.trim());
    if (selectKey && sv) p.set(selectKey, sv);
    const qs = p.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      applyFilters({ q });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[180px]">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8B7F75]">
          🔍
        </span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-[#D4E4BC] bg-white py-2 pl-8 pr-3 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
        />
      </div>

      {selectKey && selectOptions && (
        <select
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            setSelectValue(v);
            applyFilters({ selectVal: v });
          }}
          className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm font-semibold text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          aria-label={selectLabel}
        >
          <option value="">{selectLabel ?? "전체"}</option>
          {selectOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      {(q || selectValue) && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            setSelectValue("");
            const p = new URLSearchParams();
            for (const k of preserveKeys) {
              const v = params.get(k);
              if (v) p.set(k, v);
            }
            const qs = p.toString();
            startTransition(() => {
              router.replace(qs ? `${pathname}?${qs}` : pathname);
            });
          }}
          className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#6B6560] hover:bg-[#F5F1E8]"
        >
          초기화
        </button>
      )}
    </div>
  );
}
