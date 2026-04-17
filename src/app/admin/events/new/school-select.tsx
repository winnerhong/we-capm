"use client";

import { useState } from "react";

interface School {
  id: number;
  name: string;
  username: string;
  phone: string;
  district: string;
}

export function SchoolSelect({ schools }: { schools: School[] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<School | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = search
    ? schools.filter((s) =>
        s.name.includes(search) || s.district?.includes(search) || s.phone?.includes(search)
      )
    : schools;

  const handleSelect = (school: School | null) => {
    setSelected(school);
    setSearch("");
    setOpen(false);
  };

  return (
    <div className="relative">
      <label className="mb-1 block text-sm font-medium">기관 선택</label>

      <input type="hidden" name="school_id" value={selected?.id ?? ""} />
      <input type="hidden" name="manager_id" value={selected?.username ?? ""} />

      <div
        onClick={() => setOpen(!open)}
        className="w-full cursor-pointer rounded-lg border px-3 py-2 text-base"
      >
        {selected ? (
          <span>{selected.name} <span className="text-xs text-neutral-400">({selected.district})</span></span>
        ) : (
          <span className="text-neutral-400">기관을 검색하세요</span>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-white shadow-lg">
          <div className="p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="기관명, 지역구, 연락처 검색..."
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
              autoFocus
            />
          </div>

          <div className="max-h-60 overflow-y-auto">
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-violet-50"
            >
              직접 입력
            </button>
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-violet-50 flex justify-between"
              >
                <span>{s.name}</span>
                <span className="text-xs text-neutral-400">{s.district}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-neutral-400">검색 결과 없음</div>
            )}
          </div>
        </div>
      )}

      {selected && (
        <div className="mt-2 rounded-lg bg-violet-50 p-3 text-sm">
          <div><strong>{selected.name}</strong></div>
          <div className="text-xs">아이디: {selected.username} · 연락처: {selected.phone}</div>
        </div>
      )}
    </div>
  );
}
