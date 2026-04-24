import Link from "next/link";
import type { OrgHomeDashboard } from "@/lib/org-home/types";
import { InviteLinkCopy } from "../events/[eventId]/invite-link-copy";

type Props = {
  event: OrgHomeDashboard["liveEvent"];
  orgId: string;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "";
  }
}

export function LiveEventCard({ event, orgId }: Props) {
  if (!event) {
    return (
      <section className="rounded-3xl border border-dashed border-[#D4E4BC] bg-white/70 p-6 text-center shadow-sm">
        <p className="text-3xl" aria-hidden>
          🎪
        </p>
        <p className="mt-2 text-sm font-bold text-[#2D5A3D]">
          아직 진행 중인 행사가 없어요
        </p>
        <p className="mt-1 text-xs text-[#6B6560]">
          첫 행사를 만들어 가족들을 초대해 보세요
        </p>
        <Link
          href={`/org/${orgId}/events/new`}
          className="mt-4 inline-flex items-center gap-1 rounded-2xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#234a30] active:scale-[0.98]"
        >
          첫 행사 만들기
          <span aria-hidden>→</span>
        </Link>
      </section>
    );
  }

  const rate = Math.max(0, Math.min(100, event.activityRatePct));
  const dateRange =
    event.startsAt || event.endsAt
      ? `${fmtDate(event.startsAt)} ~ ${fmtDate(event.endsAt)}`
      : "";

  return (
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 text-white shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm">
          <span
            className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#5EE9F0]"
            aria-hidden
          />
          진행중
        </div>
        {dateRange && (
          <p className="text-[11px] font-semibold text-[#D4E4BC]">
            {dateRange}
          </p>
        )}
      </div>

      <h2 className="mt-3 truncate text-xl font-bold">{event.name}</h2>

      {/* 활동률 */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] font-semibold text-[#D4E4BC]">
            오늘 활동률
          </p>
          <p className="text-sm font-bold tabular-nums">{rate}%</p>
        </div>
        <div
          className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/20"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={rate}
          aria-label="오늘 활동률"
        >
          <div
            className="h-full rounded-full bg-[#FAE7D0] transition-all"
            style={{ width: `${rate}%` }}
          />
        </div>
      </div>

      {/* Mini stats */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        <MiniNum icon="🧑‍🤝‍🧑" label="참가자" value={event.participantCount} />
        <MiniNum icon="📚" label="스탬프북" value={event.questPackCount} />
        <MiniNum icon="🗂" label="프로그램" value={event.programCount} />
        <MiniNum icon="📻" label="FM" value={event.fmSessionCount} />
      </div>

      {/* Invite + 관리 */}
      <div className="mt-4 rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
        <InviteLinkCopy eventId={event.id} eventName={event.name} />
      </div>

      <div className="mt-3 flex justify-end">
        <Link
          href={`/org/${orgId}/events/${event.id}`}
          className="inline-flex items-center gap-1 rounded-2xl bg-white/15 px-4 py-2 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/25"
        >
          행사 관리
          <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}

function MiniNum({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-white/10 p-2 text-center">
      <p className="text-base" aria-hidden>
        {icon}
      </p>
      <p className="mt-0.5 text-sm font-bold tabular-nums">{value}</p>
      <p className="text-[10px] font-semibold text-[#D4E4BC]">{label}</p>
    </div>
  );
}
