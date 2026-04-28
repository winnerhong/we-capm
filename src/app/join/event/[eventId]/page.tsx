// 기관 행사 초대 링크 수신자용 가입·참가 페이지.
//
// 분기 3가지:
//  1) 미로그인 → JoinEventForm (폰 입력) 렌더. 로그인 성공 시 이 페이지로 redirect 돼
//     AutoJoinPanel 렌더되는 구조.
//  2) 로그인 + 같은 org → AutoJoinPanel ("{이름}님 반가워요!" + [참가하기] 버튼)
//  3) 로그인 + 다른 org → OrgMismatchPanel (타 기관 안내 + 로그아웃 가이드)
//
// 주의: notFound() 처리는 행사 자체가 없을 때만. 이미 참가한 경우는 AutoJoinPanel 에서
//       joinOrgEventAction 이 멱등 upsert 로 처리 후 /home 으로 redirect.

import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { joinOrgEventAction } from "@/lib/org-events/join-actions";
import { JoinEventForm } from "./join-event-form";

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
};

type OrgNameRow = { org_name: string | null };

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** "2026.05.16(토)" */
function fmtDateWeekday(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}(${WEEKDAY[d.getDay()]})`;
}

/** "10:00" — 자정은 빈 문자열 */
function fmtClock(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  const m = d.getMinutes();
  if (h === 0 && m === 0) return "";
  return `${pad2(h)}:${pad2(m)}`;
}

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
 *  - 같은 날 + 시간: "2026.05.16(토) 10:00 ~ 13:00 (3시간)"
 *  - 다른 날 + 시간: "2026.05.16(토) 10:00 ~ 2026.05.18(월) 13:00 (2일 3시간)"
 *  - 시간 미지정: "2026.05.16(토) ~ 2026.05.16(토)"
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
    .select(
      "id, org_id, name, description, starts_at, ends_at, status, cover_image_url"
    )
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

  // 2) 현재 로그인 상태 파싱
  const cookieStore = await cookies();
  const userCookie = cookieStore.get("campnic_user")?.value;
  let loggedInUserOrgId: string | null = null;
  let loggedInName: string | null = null;
  if (userCookie) {
    try {
      const parsed = JSON.parse(userCookie) as {
        orgId?: unknown;
        parentName?: unknown;
      };
      loggedInUserOrgId =
        typeof parsed.orgId === "string" ? parsed.orgId : null;
      loggedInName =
        typeof parsed.parentName === "string" ? parsed.parentName : null;
    } catch {
      // 손상된 쿠키는 무시 — 미로그인 취급
    }
  }

  const isLoggedIn = !!userCookie && !!loggedInUserOrgId;
  const sameOrg = isLoggedIn && loggedInUserOrgId === evt.org_id;

  return (
    <main className="min-h-dvh bg-gradient-to-b from-[#FFF8F0] via-[#F5F1E8] to-[#E8F0E4] px-4 py-8">
      <div className="mx-auto max-w-md space-y-4">
        <EventPreviewCard event={evt} orgName={orgName} />

        {isLoggedIn && sameOrg ? (
          <AutoJoinPanel eventId={eventId} loggedInName={loggedInName} />
        ) : isLoggedIn && !sameOrg ? (
          <OrgMismatchPanel targetOrgName={orgName} eventId={eventId} />
        ) : (
          <JoinEventForm
            eventId={eventId}
            orgName={orgName}
            initialError={errorMessageFor(sp.err, orgName)}
            initialNeedsSignup={sp.err === "needs_signup"}
          />
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

/**
 * 로그인은 돼 있지만 다른 기관 계정일 때 — 로그아웃 유도.
 * 로그아웃 후 자동으로 이 초대 페이지로 복귀 (user-logout 이 ?redirect= 지원).
 */
function OrgMismatchPanel({
  targetOrgName,
  eventId,
}: {
  targetOrgName: string;
  eventId: string;
}) {
  const inviteHref = `/join/event/${eventId}`;
  const logoutUrl = `/api/auth/user-logout?redirect=${encodeURIComponent(inviteHref)}`;
  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
      <p className="text-3xl" aria-hidden>
        🧭
      </p>
      <h2 className="mt-2 text-lg font-bold text-amber-900">
        계정 확인이 필요해요
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-amber-800">
        이 행사는 <span className="font-bold">{targetOrgName}</span> 소속이에요.
        <br />
        현재 로그인한 계정은 다른 기관에 속해 있어요.
      </p>

      <form action={logoutUrl} method="post" className="mt-4">
        <button
          type="submit"
          className="min-h-[48px] w-full rounded-2xl bg-amber-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 active:scale-[0.99]"
        >
          로그아웃하고 다른 계정으로 로그인
        </button>
      </form>

      <p className="mt-3 text-[11px] text-amber-700">
        로그아웃하면 이 초대 페이지로 다시 돌아와서 올바른 계정으로 입장할 수
        있어요.
      </p>
      <p className="mt-3 text-[11px] text-amber-700">
        문의: {targetOrgName} 담당자에게 연락해 주세요.
      </p>
    </section>
  );
}
