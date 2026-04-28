// 참가자 행사 일정표 (/schedule)
//   - 사용자가 참가 중인 행사 중 가장 활성 1건 자동 선택
//   - 시간순 슬롯을 위→아래 타임라인으로 표시
//   - 클라이언트(ScheduleTimeline) 가 1초 clock + Realtime 으로 "지금" 라인 자동 이동

import Link from "next/link";
import { requireAppUser } from "@/lib/user-auth-guard";
import { loadActiveEventsForUser } from "@/lib/org-events/queries";
import { loadTimelineSlots } from "@/lib/event-timeline/queries";
import { ScheduleTimeline } from "./schedule-timeline";

export const dynamic = "force-dynamic";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ event_id?: string }>;
}) {
  const user = await requireAppUser();
  const sp = await searchParams;
  const urlEventId = sp.event_id;

  const activeEvents = await loadActiveEventsForUser(user.id);
  const selectedEvent =
    (urlEventId && activeEvents.find((e) => e.id === urlEventId)) ||
    activeEvents[0] ||
    null;

  const slots = selectedEvent
    ? await loadTimelineSlots(selectedEvent.id)
    : [];

  return (
    <div className="space-y-4">
      <nav className="text-[11px] text-[#6B6560]">
        <Link href="/home" className="hover:underline">
          ← 홈으로
        </Link>
      </nav>

      {!selectedEvent ? (
        <section className="rounded-3xl border-2 border-dashed border-[#D4E4BC] bg-white/70 p-8 text-center shadow-sm">
          <p className="text-3xl" aria-hidden>
            📅
          </p>
          <p className="mt-2 text-sm font-bold text-[#2D5A3D]">
            현재 진행 중인 행사가 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            기관에서 행사가 시작되면 일정표가 여기에 표시돼요.
          </p>
        </section>
      ) : (
        <ScheduleTimeline
          eventId={selectedEvent.id}
          eventName={selectedEvent.name}
          eventStartsAt={selectedEvent.starts_at}
          eventEndsAt={selectedEvent.ends_at}
          initialSlots={slots}
        />
      )}
    </div>
  );
}
