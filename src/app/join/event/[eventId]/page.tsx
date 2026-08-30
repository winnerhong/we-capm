// 기관 행사 초대 링크 수신자용 가입·참가 페이지.
//
// 분기 2가지:
//  1) 미로그인 → JoinEventForm (폰 입력) 렌더. 로그인 성공 시 이 페이지로 redirect 돼
//     AutoJoinPanel 렌더되는 구조.
//  2) 로그인 → AutoJoinPanel ("{이름}님 반가워요!" + [참가하기] 버튼)
//
// 기관 벽 없음: 예전에는 세션 org 와 행사 org 가 다르면 OrgMismatchPanel 로
// 로그아웃을 유도했다. 한 보호자가 여러 기관 초대장을 받는 게 정상이므로 제거.
// 참가 시점(joinOrgEventAction)에 소속 추가 + 활성 기관 전환이 일어난다.
//
// 주의: notFound() 처리는 행사 자체가 없을 때만. 이미 참가한 경우는 AutoJoinPanel 에서
//       joinOrgEventAction 이 멱등 upsert 로 처리 후 /home 으로 redirect.

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/user-auth-guard";
import { isEventParticipant } from "@/lib/org-events/queries";
import { resolveEventAccess } from "@/lib/org-events/event-access";
import { joinOrgEventAction } from "@/lib/org-events/join-actions";
import { JoinEventForm } from "./join-event-form";
// 시간 표시는 KST 강제 — 서버(UTC) SSR 에서 getHours() 를 쓰면 초대장/홈보다
// 9시간 이르게 찍힌다. 메인 화면(/home, /e/[eventId])과 같은 포맷터를 쓴다.
import { fmtAmPmClockKst, fmtFullDateKst } from "@/lib/datetime/kst";

export const dynamic = "force-dynamic";

type OrgEventLite = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  cover_image_url: string | null;
  /** 접수·승인제. true 면 이 페이지의 즉시 참가 경로를 쓰지 않는다. */
  applications_enabled: boolean | null;
};

type OrgNameRow = { org_name: string | null };

/** "2026.05.16 (토)" — 값이 없으면 빈 문자열 (fmtFullDateKst 는 "-" 를 반환). */
function fmtDateWeekday(iso: string | null): string {
  if (!iso) return "";
  const label = fmtFullDateKst(iso);
  return label === "-" ? "" : label;
}

/** "오전 09:40" / "오후 12:30" — 자정은 빈 문자열(시간 미지정으로 간주). */
const fmtClock = fmtAmPmClockKst;

/** "3시간" / "1시간 30분" / "2일 3시간" */
function fmtDurationFromMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const totalMin = Math.round(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}일`);
  if (hours) parts.push(`${hours}시간`);
  if (mins) parts.push(`${mins}분`);
  return parts.join(" ");
}

/**
 * 행사 일정 라벨.
 *  - 같은 날 + 시간: "2026.05.16 (토) 오전 10:00 ~ 오후 01:00 (3시간)"
 *  - 다른 날 + 시간: "2026.05.16 (토) 오전 10:00 ~ 2026.05.18 (월) 오후 01:00 (2일 3시간)"
 *  - 시간 미지정: "2026.05.16 (토) ~ 2026.05.16 (토)"
 */
function fmtRange(starts: string | null, ends: string | null): string {
  if (!starts && !ends) return "";
  const sLabel = fmtDateWeekday(starts);
  const eLabel = fmtDateWeekday(ends);
  const sClock = fmtClock(starts);
  const eClock = fmtClock(ends);
  const sameDay = starts && ends && sLabel === eLabel;
  const dur =
    starts && ends
      ? fmtDurationFromMs(new Date(ends).getTime() - new Date(starts).getTime())
      : "";
  const durSuffix = dur ? ` (${dur})` : "";

  if (!sClock && !eClock) {
    return `${sLabel}${eLabel ? ` ~ ${eLabel}` : ""}`;
  }
  if (sameDay) {
    return `${sLabel} ${sClock}${sClock && eClock ? " ~ " : ""}${eClock}${durSuffix}`;
  }
  return `${sLabel}${sClock ? ` ${sClock}` : ""} ~ ${eLabel}${eClock ? ` ${eClock}` : ""}${durSuffix}`;
}

function errorMessageFor(code: string | undefined, orgName: string): string | null {
  switch (code) {
    case "notfound":
      return `등록되지 않은 번호예요. ${orgName} 담당자에게 문의해 주세요.`;
    case "suspended":
      return "계정이 일시 정지됐어요. 기관에 문의해 주세요.";
    case "closed":
      return "계정이 종료됐어요. 기관에 문의해 주세요.";
    case "invalid_phone":
      return "연락처를 올바르게 입력해 주세요.";
    case "needs_signup":
      // 자체 가입 허용 행사에서 미등록 번호로 들어왔을 때 — 에러가 아니라
      // 이름 입력 모드로 전환해야 하므로 메시지는 숨기고 `initialNeedsSignup` 으로 처리.
      return null;
    default:
      return null;
  }
}

export default async function JoinEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ err?: string }>;
}) {
  const { eventId } = await params;
  const sp = (await searchParams) ?? {};

  // 1) 행사 + 기관명 로드
  const supabase = await createClient();
  const eventResp = (await (
    supabase.from("org_events" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: OrgEventLite | null }>;
        };
      };
    }
  )
    // "*" 인 이유: applications_enabled 는 나중에 실행될 마이그레이션 컬럼이라,
    // 명시 열거하면 SQL 적용 전 배포 창에서 undefined column 으로 페이지가 깨진다.
    .select("*")
    .eq("id", eventId)
    .maybeSingle()) as { data: OrgEventLite | null };

  const evt = eventResp.data;
  if (!evt) notFound();

  const orgResp = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: OrgNameRow | null }>;
        };
      };
    }
  )
    .select("org_name")
    .eq("id", evt.org_id)
    .maybeSingle()) as { data: OrgNameRow | null };

  const orgName = orgResp.data?.org_name ?? "소속 기관";

  // 2) 현재 로그인 상태.
  //    기관 일치 여부는 더 이상 따지지 않는다 — 한 보호자가 여러 기관 초대장을
  //    받는 게 정상 시나리오라, 로그인만 돼 있으면 바로 참가할 수 있어야 한다.
  //    참가 시점(joinOrgEventAction)에 소속이 추가되고 활성 기관이 전환된다.
  const session = await getAppUser();
  const isLoggedIn = !!session;
  const loggedInName = session?.parentName || null;

  // 3) 접수·승인제 행사라면 이 페이지의 즉시 참가 경로를 쓰지 않는다.
  //    이미 참가자인 사람(기관이 수락했거나 명단에 올린 사람)만 그대로 통과.
  //
  //    미로그인은 막지 않는다 — 승인받은 사람이 다른 기기에서 들어오면 여기가
  //    유일한 로그인 창구라, 막으면 초대장 ↔ 이 페이지를 오가는 루프가 된다.
  //    로그인해도 참가자가 아니면 아래에서 신청 안내로 보낸다. 미등록 번호는
  //    self-register 가 이미 차단돼 있어 계정이 새로 생기지도 않는다.
  const applicationsOn = !!evt.applications_enabled;
  const alreadyParticipant = session
    ? await isEventParticipant(eventId, session.id).catch(() => false)
    : false;
  const needsApplication = applicationsOn && isLoggedIn && !alreadyParticipant;

  // 4) 기관이 종료한 행사 — 새로 들어올 수는 없다.
  //    이미 참가자인 사람은 통과시킨다. 그 가족에게는 사진·설문이 남아 있고,
  //    카톡에 뿌려진 링크가 이 페이지인 경우가 많다.
  const access = resolveEventAccess({
    status: evt.status,
    startsAt: evt.starts_at,
    endsAt: evt.ends_at,
  });
  const closedToNewcomers = !access.canJoin && isLoggedIn && !alreadyParticipant;

  return (
    <main className="min-h-dvh bg-gradient-to-b from-[#FFF8F0] via-[#F5F1E8] to-[#E8F0E4] px-4 py-8">
      <div className="mx-auto max-w-md space-y-4">
        <EventPreviewCard event={evt} orgName={orgName} />

        {closedToNewcomers ? (
          <section className="rounded-3xl border border-[#E8E4DE] bg-[#FAF8F5] p-6 text-center shadow-sm">
            <p className="text-4xl" aria-hidden>
              {access.badgeEmoji}
            </p>
            <p className="mt-3 text-sm font-bold text-[#6B6560]">
              참가 신청이 마감됐어요
            </p>
            <p className="mt-1 text-xs text-[#8B7F75]">
              {orgName}에 문의해 주세요.
            </p>
          </section>
        ) : needsApplication ? (
          <ApplyFirstPanel eventId={eventId} orgName={orgName} />
        ) : isLoggedIn ? (
          <AutoJoinPanel eventId={eventId} loggedInName={loggedInName} />
        ) : (
          <>
            <JoinEventForm
              eventId={eventId}
              orgName={orgName}
              initialError={errorMessageFor(sp.err, orgName)}
              initialNeedsSignup={sp.err === "needs_signup"}
            />
            {/* 접수제 행사 — 아직 신청 전인 사람이 여기서 막히지 않도록 안내. */}
            {applicationsOn && (
              <Link
                href={`/invitation/${eventId}#apply`}
                className="block rounded-2xl border border-[#D4E4BC] bg-white/70 px-4 py-3 text-center text-xs font-semibold text-[#2D5A3D] transition hover:bg-white"
              >
                📥 아직 신청 전이신가요? 참가 신청서 작성하기 →
              </Link>
            )}
          </>
        )}

        <div className="flex justify-center pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-[#8B7F75] transition hover:text-[#2D5A3D]"
          >
            ← 첫 화면으로
          </Link>
        </div>
      </div>
    </main>
  );
}

function EventPreviewCard({
  event,
  orgName,
}: {
  event: OrgEventLite;
  orgName: string;
}) {
  const dateRange = fmtRange(event.starts_at, event.ends_at);

  return (
    <section className="overflow-hidden rounded-3xl border border-[#D4E4BC] bg-white shadow-sm">
      {event.cover_image_url ? (
        <div
          className="aspect-[16/9] w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${event.cover_image_url})` }}
          role="img"
          aria-label={`${event.name} 커버 이미지`}
        />
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59]">
          <p className="text-5xl" aria-hidden>
            🌲
          </p>
        </div>
      )}
      <div className="space-y-2 p-5">
        <p className="text-[11px] font-semibold text-[#6B6560]">
          🏡 {orgName}
        </p>
        <h1 className="text-xl font-bold text-[#2D5A3D]">{event.name}</h1>
        {dateRange && (
          <p className="text-xs font-semibold text-[#8B7F75]">📅 {dateRange}</p>
        )}
        {event.description && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-[#4A4340]">
            {event.description}
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * 접수·승인제 행사 — 신청서를 먼저 받는다.
 *
 * 이 페이지로 직접 들어온 사람(옛 링크, 북마크)을 초대장의 신청 폼으로 돌려보낸다.
 * 여기서 바로 참가시키면 승인제가 무의미해지므로 입력 폼 자체를 노출하지 않는다.
 */
function ApplyFirstPanel({
  eventId,
  orgName,
}: {
  eventId: string;
  orgName: string;
}) {
  return (
    <section className="rounded-3xl border border-[#D4E4BC] bg-white p-6 text-center shadow-sm">
      <p className="text-3xl" aria-hidden>
        📥
      </p>
      <h2 className="mt-2 text-lg font-bold text-[#2D5A3D]">
        참가 신청이 필요해요
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-[#6B6560]">
        이 행사는 {orgName}에서 신청을 받아 확인 후 참가를 확정해요.
        <br />
        초대장 아래 신청서를 작성해 주세요.
      </p>
      <Link
        href={`/invitation/${eventId}#apply`}
        className="mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] py-3.5 text-base font-bold text-white shadow-md transition hover:shadow-lg active:scale-[0.99]"
      >
        <span aria-hidden>🌲</span>
        <span>신청서 작성하러 가기</span>
        <span aria-hidden>→</span>
      </Link>
      <p className="mt-3 text-[11px] text-[#8B7F75]">
        이미 신청하셨다면 초대장에서 승인 상태를 확인하실 수 있어요.
      </p>
    </section>
  );
}

/**
 * 이미 로그인된 같은 org 사용자 — 원-클릭 참가.
 * form action 으로 서버 액션을 호출해 no-JS 환경에서도 작동.
 */
function AutoJoinPanel({
  eventId,
  loggedInName,
}: {
  eventId: string;
  loggedInName: string | null;
}) {
  return (
    <section className="rounded-3xl border border-[#D4E4BC] bg-white p-6 text-center shadow-sm">
      <p className="text-3xl" aria-hidden>
        🌱
      </p>
      <h2 className="mt-2 text-lg font-bold text-[#2D5A3D]">
        {loggedInName ? `${loggedInName}님 반가워요!` : "환영합니다"}
      </h2>
      <p className="mt-1 text-sm text-[#6B6560]">
        이 행사에 참가하시겠어요?
      </p>
      <form
        action={async () => {
          "use server";
          await joinOrgEventAction(eventId);
        }}
        className="mt-4"
      >
        <button
          type="submit"
          className="min-h-[52px] w-full rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] py-3.5 text-base font-bold text-white shadow-md transition hover:shadow-lg active:scale-[0.99]"
        >
          🌲 행사 참가하기
        </button>
      </form>
      <p className="mt-3 text-[11px] text-[#8B7F75]">
        참가하면 토리로 홈에서 스탬프북·프로그램을 바로 시작할 수 있어요.
      </p>
    </section>
  );
}

