// 행사 일정표 — /e/{eventId}/schedule
//   - 어느 행사인지는 URL 이 정한다 (예전에는 "참가 중인 행사 중 아무거나" 였다)
//   - 시간순 슬롯을 위→아래 타임라인으로 표시
//   - 클라이언트(ScheduleTimeline) 가 1초 clock + Realtime 으로 "지금" 라인 자동 이동

import Link from "next/link";
import { requireEventContext } from "@/lib/event-context";
import { loadTimelineSlots } from "@/lib/event-timeline/queries";
import { ScheduleTimeline } from "./schedule-timeline";

export const dynamic = "force-dynamic";

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const ctx = await requireEventContext(eventId);

  const slots = await loadTimelineSlots(ctx.event.id).catch(() => []);

  return (
    <div className="space-y-4">
      <nav className="text-[11px] text-[#6B6560]">
        <Link href={ctx.href()} className="hover:underline">
          ← 행사홈으로
        </Link>
      </nav>

      {slots.length === 0 ? (
        <section className="rounded-3xl border-2 border-dashed border-[#D4E4BC] bg-white/70 p-8 text-center shadow-sm">
          <p className="text-3xl" aria-hidden>
            📅
          </p>
          <p className="mt-2 text-sm font-bold text-[#2D5A3D]">
            아직 일정표가 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            {ctx.orgName} 에서 타임테이블을 올리면 여기에 표시돼요.
          </p>
        </section>
      ) : (
        <ScheduleTimeline
          eventId={ctx.event.id}
          eventName={ctx.event.name}
          eventStartsAt={ctx.event.starts_at}
          eventEndsAt={ctx.event.ends_at}
          initialSlots={slots}
        />
      )}
    </div>
  );
}
