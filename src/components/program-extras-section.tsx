"use client";

// 프로그램 폼의 "주차장 + 집결장소" 섹션 — 서버 컴포넌트 form 안에서
// 사용 가능한 client 래퍼. controlled state 를 안고 hidden input 으로
// FormData 에 JSON 직렬화 전달.
//
// FormData 키:
//  - parking_lots  : JSON string (ParkingLot[])
//  - meeting_point : JSON string (MeetingPoint) | "" (NULL 표현)

import { useState } from "react";
import type {
  ParkingLot,
  MeetingPoint,
} from "@/lib/partner-programs/types";
import { ParkingLotsEditor } from "./parking-lots-editor";
import { MeetingPointEditor } from "./meeting-point-editor";

interface Props {
  initialParkingLots?: ParkingLot[];
  initialMeetingPoint?: MeetingPoint | null;
}

/**
 * 접기/펼치기 가능한 섹션 헤더.
 * 헤더 전체가 클릭 가능 + 우측 chevron 회전.
 */
function CollapsibleHeader({
  open,
  onToggle,
  icon,
  title,
  hint,
  badge,
}: {
  open: boolean;
  onToggle: () => void;
  icon: string;
  title: string;
  hint?: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center gap-2 text-left text-sm font-bold text-[#2D5A3D] transition hover:opacity-80"
    >
      <span aria-hidden>{icon}</span>
      <span>{title}</span>
      {hint && (
        <span className="text-[10px] font-normal text-[#8B7F75]">
          {hint}
        </span>
      )}
      {badge && (
        <span className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-bold text-[#2D5A3D]">
          {badge}
        </span>
      )}
      <span
        aria-hidden
        className={`ml-auto text-[#6B6560] transition-transform ${
          open ? "rotate-180" : ""
        }`}
      >
        ▼
      </span>
    </button>
  );
}

export function ProgramExtrasSection({
  initialParkingLots = [],
  initialMeetingPoint = null,
}: Props) {
  const [parkingLots, setParkingLots] = useState<ParkingLot[]>(
    Array.isArray(initialParkingLots) ? initialParkingLots : []
  );
  const [meetingPoint, setMeetingPoint] = useState<MeetingPoint | null>(
    initialMeetingPoint ?? null
  );

  // 데이터가 있으면 펼친 상태로 시작, 없으면 접힌 상태 (폼 길이 단축)
  const [parkingOpen, setParkingOpen] = useState(parkingLots.length > 0);
  const [meetingOpen, setMeetingOpen] = useState(meetingPoint !== null);

  return (
    <>
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
        <CollapsibleHeader
          open={parkingOpen}
          onToggle={() => setParkingOpen((v) => !v)}
          icon="🅿️"
          title="주차장 정보"
          hint="(선택 · 최대 10개)"
          badge={parkingLots.length > 0 ? `${parkingLots.length}개` : undefined}
        />
        {parkingOpen && (
          <div className="mt-4">
            <ParkingLotsEditor value={parkingLots} onChange={setParkingLots} />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
        <CollapsibleHeader
          open={meetingOpen}
          onToggle={() => setMeetingOpen((v) => !v)}
          icon="📍"
          title="집결 장소"
          badge={meetingPoint ? "설정됨" : undefined}
        />
        {meetingOpen && (
          <div className="mt-4">
            <MeetingPointEditor
              value={meetingPoint}
              onChange={setMeetingPoint}
            />
          </div>
        )}
      </section>

      {/* hidden inputs — FormData 직렬화. 접힌 상태에서도 폼 데이터는 유지 */}
      <input
        type="hidden"
        name="parking_lots"
        value={JSON.stringify(parkingLots)}
      />
      <input
        type="hidden"
        name="meeting_point"
        value={meetingPoint ? JSON.stringify(meetingPoint) : ""}
      />
    </>
  );
}
