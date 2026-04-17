"use client";

import { useState, useRef } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);
  const [imported, setImported] = useState<ExtEvent | null>(null);

  const handleImport = (ev: ExtEvent) => {
    setImported(ev);
    if (!formRef.current) return;
    const form = formRef.current;
    const set = (name: string, value: string) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | null;
      if (el) el.value = value;
    };
    set("name", `${ev.school_name} ${ev.event_title}`);
    set("start_at", toLocalInput(ev.start_time));
    set("end_at", toLocalInput(ev.end_time));
    set("location", ev.location_name);
    set("manager_password", ev.school_password);
  };

  return (
    <>
      <EventImport events={externalEvents} onSelect={handleImport} />

      {imported && (
        <div className="rounded-lg bg-green-50 p-3 text-sm">
          ✅ <strong>{imported.school_name}</strong>의 행사 정보를 불러왔습니다
        </div>
      )}

      <form ref={formRef} action={createEventAction} className="space-y-4 rounded-lg border bg-white p-6">
        <SchoolSelect schools={schools} />

        <Field label="행사명" name="name" required placeholder="5월 가족 캠프닉" />

        <div>
          <label className="mb-1 block text-sm font-medium">행사 유형</label>
          <select name="type" defaultValue="FAMILY"
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500">
            <option value="FAMILY">가족</option>
            <option value="CORPORATE">기업</option>
            <option value="CLUB">동호회</option>
            <option value="SCHOOL">학교</option>
            <option value="ETC">기타</option>
          </select>
        </div>

        <Field label="시작 시각" name="start_at" type="datetime-local" required />
        <Field label="종료 시각" name="end_at" type="datetime-local" required />
        <Field label="장소" name="location" required placeholder="가평 자라섬 캠핑장" />

        <div>
          <label className="mb-1 block text-sm font-medium">참가 단위</label>
          <select name="participation_type" defaultValue="BOTH"
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500">
            <option value="BOTH">개인 + 팀</option>
            <option value="INDIVIDUAL">개인 전용</option>
            <option value="TEAM">팀 전용</option>
          </select>
        </div>

        <div className="border-t pt-4">
          <p className="mb-2 text-sm font-semibold">기관 로그인 계정</p>
          <Field label="기관 비밀번호" name="manager_password" placeholder="1234" />
        </div>

        <button type="submit"
          className="w-full rounded-lg bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700">
          만들기
        </button>
      </form>
    </>
  );
}

function Field({ label, name, type = "text", required, placeholder }: {
  label: string; name: string; type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">{label}</label>
      <input id={name} name={name} type={type} required={required} placeholder={placeholder}
        className="w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-violet-500" />
    </div>
  );
}
