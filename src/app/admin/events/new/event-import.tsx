"use client";

import { useState } from "react";

interface ExtEvent {
  id: number;
  event_title: string;
  school_name: string;
  school_id: number;
  location_name: string;
  start_time: string;
  end_time: string;
  event_status: string;
  family_count: number | null;
  school_username: string;
  school_password: string;
}

interface Props {
  events: ExtEvent[];
  onSelect: (event: ExtEvent) => void;
}

export function EventImport({ events, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = search
    ? events.filter((e) =>
        e.school_name.includes(search) ||
        e.event_title.includes(search) ||
        e.location_name.includes(search)
      )
    : events;

  return (
    <div className="rounded-lg border-2 border-dashed border-violet-300 bg-violet-50 p-4">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full text-center text-sm font-semibold text-violet-600 hover:text-violet-800">
        {open ? "닫기 ✕" : "📋 기존 행사에서 불러오기"}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="기관명, 행사명, 장소 검색..."
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
            autoFocus
          />

          <div className="max-h-64 overflow-y-auto space-y-1">
            {filtered.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => { onSelect(ev); setOpen(false); setSearch(""); }}
                className="w-full rounded-lg border bg-white p-3 text-left text-sm hover:border-violet-500"
              >
                <div className="flex justify-between">
                  <span className="font-semibold">{ev.school_name}</span>
                  <span className="text-xs text-neutral-400">{ev.event_status}</span>
                </div>
                <div className="text-xs">
                  {ev.event_title} · 📍{ev.location_name} ·
                  🗓{ev.start_time ? new Date(ev.start_time).toLocaleDateString("ko-KR") : "미정"}
                  {ev.family_count ? ` · ${ev.family_count}가족` : ""}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="py-4 text-center text-xs text-neutral-400">검색 결과 없음</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
