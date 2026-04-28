// 기관 행사 상세 — 타임테이블 탭 (서버 컴포넌트).
//   슬롯 리스트 + 추가 폼 + 각 슬롯 인라인 수정/삭제.

import { notFound } from "next/navigation";
import { loadOrgEventById } from "@/lib/org-events/queries";
import { loadTimelineSlots } from "@/lib/event-timeline/queries";
import { TimelineEditor } from "./timeline-editor";

interface Props {
  orgId: string;
  eventId: string;
}

export async function TimelineTabPanel({ orgId, eventId }: Props) {
  const [event, slots] = await Promise.all([
    loadOrgEventById(eventId),
    loadTimelineSlots(eventId),
  ]);

  if (!event || event.org_id !== orgId) {
    notFound();
  }
  if (!event.starts_at) {
    return (
      <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-semibold text-amber-800">
        ⚠ 행사 시작 시각이 비어 있어요. 먼저 행사 정보 편집에서 시작 시각을 설정해 주세요.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-[#D4E4BC] bg-[#E8F0E4]/60 p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>📅</span>
          <span>행사 타임테이블</span>
        </h2>
        <p className="mt-1 text-[11px] text-[#6B6560]">
          소요 시간만 입력하면 시작·종료 시각은 자동으로 계산돼요. ↑↓ 버튼으로
          순서를 바꾸면 모든 슬롯의 시간이 다시 맞춰집니다.
        </p>
      </header>

      <TimelineEditor
        eventId={eventId}
        eventStartsAt={event.starts_at}
        initialSlots={slots}
        orgId={orgId}
      />
    </div>
  );
}
