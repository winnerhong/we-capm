// 행사 허브 — "내가 참여 중인 행사" 목록.
//
// 예전의 /home 은 행사 하나를 골라 그 행사 화면을 통째로 그렸다. 그래서
// 두 기관에 다니는 보호자는 "행사는 B기관, 헤더는 A기관" 같은 어긋남을 봤고,
// 다른 기관에서 쌓은 도토리·자녀가 남의 기관 화면에 그대로 노출됐다.
//
// 이제 /home 은 **기관 색이 없는 중립 화면**이다. 여기서는 어느 기관에도
// 속하지 않고, 행사 카드를 눌러 /e/{eventId} 로 들어가야 그 행사의 세계가
// 열린다. 행사는 행사로 끝난다.
//
// 회색 카드에 대하여:
//   끝난 행사도 여기 남는다. 예전에는 기관이 종료를 누르면 목록에서 통째로
//   사라졌는데, 그러면 그 행사에서 찍은 사진과 설문을 다시 찾아갈 길이 없었다.
//   지금은 회색으로 내려앉을 뿐이고, 무엇이 잠겼는지는 resolveEventAccess 가
//   한 곳에서 말해 준다.

import Link from "next/link";
import { requireAppUser } from "@/lib/user-auth-guard";
import { loadChildrenForUser } from "@/lib/app-user/queries";
import { loadEventsForUser } from "@/lib/org-events/queries";
import { listUserOrgs } from "@/lib/app-user/orgs";
import { eventHref } from "@/lib/event-context";
import {
  PHASE_ORDER,
  resolveEventAccess,
  type EventAccess,
} from "@/lib/org-events/event-access";
import { fmtFullDateKst, fmtAmPmClockKst } from "@/lib/datetime/kst";
import type { OrgEventRow } from "@/lib/org-events/types";

export const dynamic = "force-dynamic";

export default async function EventHubPage() {
  const user = await requireAppUser();

  const [events, children, orgs] = await Promise.all([
    loadEventsForUser(user.id).catch(() => []),
    loadChildrenForUser(user.id).catch(() => []),
    listUserOrgs(user.id).catch(() => []),
  ]);

  const orgNameById = new Map(orgs.map((o) => [o.orgId, o.orgName]));

  // 지금 갈 수 있는 곳이 맨 위, 끝난 곳이 맨 아래.
  // 같은 칸 안에서는 열린 행사끼리 임박한 순, 끝난 행사끼리 최근 순 —
  // 앞으로 갈 일은 가까운 것부터, 지나간 일은 방금 것부터 찾는다.
  const cards = events
    .map((event) => ({
      event,
      access: resolveEventAccess({
        status: event.status,
        startsAt: event.starts_at,
        endsAt: event.ends_at,
      }),
    }))
    .sort((a, b) => {
      const order = PHASE_ORDER[a.access.phase] - PHASE_ORDER[b.access.phase];
      if (order !== 0) return order;
      const ta = a.event.starts_at ? new Date(a.event.starts_at).getTime() : 0;
      const tb = b.event.starts_at ? new Date(b.event.starts_at).getTime() : 0;
      return a.access.dimmed ? tb - ta : ta - tb;
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

      {cards.length === 0 ? (
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
          {cards.map(({ event, access }) => (
            <li key={event.id}>
              <EventCard
                event={event}
                access={access}
                orgName={orgNameById.get(event.org_id) ?? "소속 기관"}
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
  access,
  orgName,
}: {
  event: OrgEventRow;
  access: EventAccess;
  orgName: string;
}) {
  const dateLabel = event.starts_at ? fmtFullDateKst(event.starts_at) : "";
  const startClock = event.starts_at ? fmtAmPmClockKst(event.starts_at) : "";
  const dim = access.dimmed;

  return (
    <Link
      href={eventHref(event.id)}
      className={`block overflow-hidden rounded-3xl border-2 p-5 shadow-sm transition hover:shadow-md active:scale-[0.995] ${
        dim
          ? "border-[#E8E4DE] bg-[#FAF8F5]"
          : access.phase === "live"
            ? "border-emerald-300 bg-white"
            : "border-[#E5D3B8] bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
            dim
              ? "bg-[#EFEBE4] text-[#8B7F75]"
              : access.phase === "live"
                ? "bg-emerald-500 text-white"
                : "bg-[#FAE7D0] text-[#6B4423]"
          }`}
        >
          {access.badgeEmoji} {access.badgeLabel}
        </span>
        {/* 끝난 행사에 D+숫자를 붙이면 "며칠이나 지났나" 만 눈에 남는다.
            남은 날이 의미 있을 때만 센다. */}
        {access.ddayLabel && !dim && (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold tabular-nums ${
              access.dday === 0
                ? "bg-rose-500 text-white"
                : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
            }`}
          >
            {access.ddayLabel}
          </span>
        )}
        {/* 기관명은 행사 카드 안에서만 — 어느 기관의 행사인지 구분용 */}
        <span
          className={`truncate rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            dim ? "bg-[#EFEBE4] text-[#9C948C]" : "bg-[#F5F1E8] text-[#6B6560]"
          }`}
        >
          🏡 {orgName}
        </span>
      </div>

      <h2
        className={`mt-2 text-base font-bold ${
          dim ? "text-[#8B7F75]" : "text-[#2D5A3D]"
        }`}
      >
        {event.name || "(이름 없음)"}
      </h2>
      {dateLabel && (
        <p
          className={`mt-1 text-xs font-semibold ${
            dim ? "text-[#A69C92]" : "text-[#8B7F75]"
          }`}
        >
          📅 {dateLabel}
          {startClock ? ` ${startClock}` : ""}
        </p>
      )}
      <p
        className={`mt-3 text-xs font-bold ${
          dim ? "text-[#8B7F75]" : "text-[#3A7A52]"
        }`}
      >
        {access.cta}
      </p>
    </Link>
  );
}
