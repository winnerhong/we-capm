"use client";

import { useState } from "react";
import { createEventAction } from "../actions";
import { SchoolSelect } from "./school-select";
import { EventImport } from "./event-import";

interface School { id: number; name: string; username: string; phone: string; district: string }
interface ExtEvent {
  id: number; event_title: string; school_name: string; school_id: number;
  location_name: string; start_time: string; end_time: string; event_status: string;
  family_count: number | null; school_username: string; school_password: string;
}

function toLocalInput(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewEventForm({ schools, externalEvents }: { schools: School[]; externalEvents: ExtEvent[] }) {
  const [name, setName] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [location, setLocation] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [imported, setImported] = useState<ExtEvent | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);

  const handleImport = (ev: ExtEvent) => {
    setImported(ev);
    setName(`${ev.school_name} ${ev.event_title}`);
    setStartAt(toLocalInput(ev.start_time));
    setEndAt(toLocalInput(ev.end_time));
    setLocation(ev.location_name);
    setManagerPassword(ev.school_password);
    const matched = schools.find((s) => s.name === ev.school_name || s.id === ev.school_id);
    if (matched) setSelectedSchoolId(matched.id);
  };

  return (
    <>
      <EventImport events={externalEvents} onSelect={handleImport} />

      {imported && (
        <div className="rounded-xl bg-[#E8F0E4] border border-[#A8C686] p-3 text-sm text-[#2D5A3D]">
          🌿 <strong>{imported.school_name}</strong>의 행사 정보를 숲에 심었어요
        </div>
      )}

      <form action={createEventAction} className="space-y-4 rounded-2xl border border-[#D4E4BC] bg-white p-6">
        <input type="hidden" name="type" value="FAMILY" />

        <SchoolSelect schools={schools} preSelectedId={selectedSchoolId} />

        <div>
          <label className="mb-1 block text-sm font-medium text-[#2C2C2C]">🌰 행사명</label>
          <input name="name" value={name} onChange={(e) => setName(e.target.value)}
            required placeholder="예) 5월 가족 숲길 탐험"
            className="w-full rounded-xl border border-[#D4E4BC] px-3 py-2 outline-none focus:ring-2 focus:ring-[#2D5A3D]" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#2C2C2C]">🌅 시작 시각</label>
          <input name="start_at" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)}
            required className="w-full rounded-xl border border-[#D4E4BC] px-3 py-2 outline-none focus:ring-2 focus:ring-[#2D5A3D]" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#2C2C2C]">🌇 종료 시각</label>
          <input name="end_at" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)}
            required className="w-full rounded-xl border border-[#D4E4BC] px-3 py-2 outline-none focus:ring-2 focus:ring-[#2D5A3D]" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#2C2C2C]">📍 장소</label>
          <input name="location" value={location} onChange={(e) => setLocation(e.target.value)}
            required placeholder="예) 가평 자라섬 숲길"
            className="w-full rounded-xl border border-[#D4E4BC] px-3 py-2 outline-none focus:ring-2 focus:ring-[#2D5A3D]" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#2C2C2C]">🐿️ 참가 단위</label>
          <select name="participation_type" defaultValue="BOTH"
            className="w-full rounded-xl border border-[#D4E4BC] px-3 py-2 outline-none focus:ring-2 focus:ring-[#2D5A3D]">
            <option value="BOTH">개인 + 팀</option>
            <option value="INDIVIDUAL">개인 전용</option>
            <option value="TEAM">팀 전용</option>
          </select>
        </div>

        <div className="border-t border-[#D4E4BC] pt-4">
          <p className="mb-2 text-sm font-semibold text-[#2D5A3D]">🏢 기관 로그인 계정</p>
          {imported?.school_username && (
            <div className="mb-2 rounded-xl bg-[#FFF8F0] border border-[#D4E4BC] p-3 text-sm">
              <span className="text-xs text-[#6B6560]">아이디:</span> <strong className="text-[#2D5A3D]">{imported.school_username}</strong>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#2C2C2C]">기관 비밀번호</label>
            <input name="manager_password" value={managerPassword} onChange={(e) => setManagerPassword(e.target.value)}
              placeholder="1234"
              className="w-full rounded-xl border border-[#D4E4BC] px-3 py-2 outline-none focus:ring-2 focus:ring-[#2D5A3D]" />
          </div>
        </div>

        <button type="submit"
          className="w-full rounded-xl bg-[#2D5A3D] py-3 font-semibold text-white hover:bg-[#1F4229] transition-colors">
          🌲 숲길 행사 만들기
        </button>
      </form>
    </>
  );
}
