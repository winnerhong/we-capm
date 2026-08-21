// 행사 허브 — "내가 참여 중인 행사" 목록.
//
// 예전의 /home 은 행사 하나를 골라 그 행사 화면을 통째로 그렸다. 그래서
// 두 기관에 다니는 보호자는 "행사는 B기관, 헤더는 A기관" 같은 어긋남을 봤고,
// 다른 기관에서 쌓은 도토리·자녀가 남의 기관 화면에 그대로 노출됐다.
//
// 이제 /home 은 **기관 색이 없는 중립 화면**이다. 여기서는 어느 기관에도
// 속하지 않고, 행사 카드를 눌러 /e/{eventId} 로 들어가야 그 행사의 세계가
// 열린다. 행사는 행사로 끝난다.

import Link from "next/link";
import { requireAppUser } from "@/lib/user-auth-guard";
import { loadChildrenForUser } from "@/lib/app-user/queries";
import { loadActiveAndUpcomingEventsForUser } from "@/lib/org-events/queries";
import { listUserOrgs } from "@/lib/app-user/orgs";
import { eventHref } from "@/lib/event-context";
import { fmtFullDateKst, fmtAmPmClockKst } from "@/lib/datetime/kst";
import type { OrgEventRow } from "@/lib/org-events/types";

export const dynamic = "force-dynamic";

/** 행사 시작까지 남은 일수. 오늘이면 0, 지났으면 음수. */
function calcDDay(startsAt: string | null): number | null {
  if (!startsAt) return null;
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ev = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );
  return Math.round((ev.getTime() - today.getTime()) / 86_400_000);
}

function ddayLabel(d: number): string {
  if (d === 0) return "D-DAY";
  return d > 0 ? `D-${d}` : `D+${-d}`;
}

export default async function EventHubPage() {
  const user = await requireAppUser();

  const [events, children, orgs] = await Promise.all([
    loadActiveAndUpcomingEventsForUser(user.id).catch(() => []),
    loadChildrenForUser(user.id).catch(() => []),
    listUserOrgs(user.id).catch(() => []),
  ]);

  const orgNameById = new Map(orgs.map((o) => [o.orgId, o.orgName]));

  // 진행 중 먼저, 그 다음 시작일 빠른 순.
  const sorted = [...events].sort((a, b) => {
    if (a.status !== b.status) return a.status === "LIVE" ? -1 : 1;
    const ta = a.starts_at ? new Date(a.starts_at).getTime() : Infinity;
    const tb = b.starts_at ? new Date(b.starts_at).getTime() : Infinity;
    return ta - tb;
  });

  const enrolled = children.filter((c) => c.is_enrolled && c.name?.trim());
  const familyLabel =
    enrolled.length > 0
      ? `${enrolled.map((c) => c.name).join("·")} 가족`
      : `${user.parentName || "보호자"}님`;

  return (
    <div className="space-y-4">
      {/* 중립 헤더 — 기관명을 쓰지 않는다. 여기는 어느 기관도 아니다. */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#D4E4BC]">🌳 토리로</p>
            <h1 className="mt-1 truncate text-xl font-bold text-white">
              {familyLabel}
            </h1>
            <p className="mt-1 text-[11px] text-[#D4E4BC]">
              참여 중인 행사를 골라 들어가세요
            </p>
          </div>
          <Link
            href="/profile"
            className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/25"
          >
            내 정보 →
          </Link>
        </div>
      </section>

      {sorted.length === 0 ? (
        <section className="rounded-3xl border-2 border-dashed border-[#D4E4BC] bg-white/70 p-8 text-center shadow-sm">
          <p className="text-4xl" aria-hidden>
            🌱
          </p>
          <p className="mt-3 text-sm font-bold text-[#2D5A3D]">
            아직 참여 중인 행사가 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            기관에서 초대장을 받으면 여기에 나타나요
          </p>
        </section>
      ) : (
        <ul className="space-y-3">
          {sorted.map((e) => (
            <li key={e.id}>
              <EventCard
                event={e}
                orgName={orgNameById.get(e.org_id) ?? "소속 기관"}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EventCard({
  event,
  orgName,
}: {
  event: OrgEventRow;
  orgName: string;
}) {
  const isLive = event.status === "LIVE";
  const d = calcDDay(event.starts_at);
  const dateLabel = event.starts_at ? fmtFullDateKst(event.starts_at) : "";
  const startClock = event.starts_at ? fmtAmPmClockKst(event.starts_at) : "";

  return (
    <Link
      href={eventHref(event.id)}
      className={`block overflow-hidden rounded-3xl border-2 bg-white p-5 shadow-sm transition hover:shadow-md active:scale-[0.995] ${
        isLive ? "border-emerald-300" : "border-[#E5D3B8]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
            isLive
              ? "bg-emerald-500 text-white"
              : "bg-[#FAE7D0] text-[#6B4423]"
          }`}
        >
          {isLive ? "🟢 진행중" : "🌱 예정"}
        </span>
        {d !== null && (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold tabular-nums ${
              d === 0
                ? "bg-rose-500 text-white"
                : d > 0
                  ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                  : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {ddayLabel(d)}
          </span>
        )}
        {/* 기관명은 행사 카드 안에서만 — 어느 기관의 행사인지 구분용 */}
        <span className="truncate rounded-full bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#6B6560]">
          🏡 {orgName}
        </span>
      </div>

      <h2 className="mt-2 text-base font-bold text-[#2D5A3D]">
        {event.name || "(이름 없음)"}
      </h2>
      {dateLabel && (
        <p className="mt-1 text-xs font-semibold text-[#8B7F75]">
          📅 {dateLabel}
          {startClock ? ` ${startClock}` : ""}
        </p>
      )}
      <p className="mt-3 text-xs font-bold text-[#3A7A52]">
        {isLive ? "행사 입장하기 →" : "초대장·일정 보기 →"}
      </p>
    </Link>
  );
}
