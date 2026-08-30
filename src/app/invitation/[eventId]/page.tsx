import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAppUser } from "@/lib/user-auth-guard";
import {
  loadOrgEventById,
  isEventParticipant,
} from "@/lib/org-events/queries";
import { loadPartnerDisplayNameForOrg } from "@/lib/org-partner";
import {
  resolveOrgConsent,
  type OrgConsent,
  type OrgConsentContext,
} from "@/lib/org-events/consent-core";
import { loadTimelineSlots } from "@/lib/event-timeline/queries";
import { TimelineCollapsible } from "./timeline-collapsible";
// 시간 포맷은 KST 강제 (SSR/CSR 일치 보장).
import {
  fmtAmPmClockKst,
  fmtClockKstAlways,
  fmtDateTimeKst,
  fmtKoreanLongDateKst,
} from "@/lib/datetime/kst";
import { CopyButton } from "./copy-button";
// 입장가능시간 계산·문구는 한 곳에서 — 히어로 배지와 상세 행이 같은 값을 쓴다.
import { resolveEntryTime } from "@/lib/org-events/entry-time";
import { resolveEventAccess } from "@/lib/org-events/event-access";
import { getOrg } from "@/lib/org-auth-guard";
import {
  resolveInvitationMessage,
  resolveInvitationTitle,
} from "@/lib/org-events/invitation-copy";
import { InvitationPreviewBridge } from "./preview-bridge";
// 참가 접수(승인제) — 켜져 있으면 하단 CTA 자리가 신청 폼/상태 카드로 바뀐다.
import {
  loadEventApplicationCounts,
  loadMyApplication,
  loadOrgApplicationConsent,
} from "@/lib/org-events/application-queries";
import {
  resolveApplicationGate,
  type ApplicationGate,
} from "@/lib/org-events/application-core";
import type {
  OrgEventApplicationCounts,
  OrgEventApplicationRow,
} from "@/lib/org-events/types";
import { ApplicationForm } from "./application-form";
import { ApplicationStatusSection } from "./application-status-section";
import { ApplicationClosedCard } from "./application-status-card";

export const dynamic = "force-dynamic";

/** 미리보기 전용 — 참가자가 받는 화면에는 들어가지 않는다. */
const PREVIEW_SCROLLBAR_CSS = [
  "html{scrollbar-width:thin;scrollbar-color:rgba(45,90,61,.28) transparent}",
  "html::-webkit-scrollbar{width:6px}",
  "html::-webkit-scrollbar-track{background:transparent;margin:14px 0}",
  "html::-webkit-scrollbar-thumb{background:rgba(45,90,61,.28);border-radius:999px}",
  "html::-webkit-scrollbar-thumb:hover{background:rgba(45,90,61,.45)}",
].join("");

const fmtFullDate = fmtKoreanLongDateKst;
const fmtClock = fmtAmPmClockKst;

function fmtDuration(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt || !endsAt) return "";
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return "";
  const totalMin = Math.round((end - start) / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}일`);
  if (hours) parts.push(`${hours}시간`);
  if (mins) parts.push(`${mins}분`);
  return parts.join(" ");
}


function fmtSlotTime(iso: string): string {
  return fmtClockKstAlways(iso);
}

/**
 * 슬롯 시작 시각을 행사 시작 시각 + 누적 길이로 재계산.
 *  - DB 의 slot.starts_at 는 행사 시각이 바뀐 후 timeline 재저장이 안 됐으면
 *    구 값일 수 있어, 항상 event.starts_at 기준 누적으로 표시하는 게 안전.
 *  - duration = ends_at - starts_at (둘 다 있을 때) / 없으면 0 분.
 */
function computeSlotDisplayTimes(
  eventStartsAt: string | null,
  slots: Array<{ starts_at: string; ends_at: string | null }>
): Array<{ start: string; end: string | null; durationMin: number | null }> {
  if (!eventStartsAt || slots.length === 0) {
    return slots.map((s) => ({
      start: fmtSlotTime(s.starts_at),
      end: s.ends_at ? fmtSlotTime(s.ends_at) : null,
      durationMin: null,
    }));
  }
  const startMs = new Date(eventStartsAt).getTime();
  if (!Number.isFinite(startMs)) {
    return slots.map((s) => ({
      start: fmtSlotTime(s.starts_at),
      end: s.ends_at ? fmtSlotTime(s.ends_at) : null,
      durationMin: null,
    }));
  }
  let cursor = startMs;
  const out: Array<{ start: string; end: string | null; durationMin: number | null }> = [];
  for (const s of slots) {
    const sMs = new Date(s.starts_at).getTime();
    const eMs = s.ends_at ? new Date(s.ends_at).getTime() : NaN;
    const durMs =
      Number.isFinite(sMs) && Number.isFinite(eMs) && eMs > sMs ? eMs - sMs : 0;
    const slotStart = cursor;
    const slotEnd = cursor + durMs;
    out.push({
      start: fmtSlotTime(new Date(slotStart).toISOString()),
      end: durMs > 0 ? fmtSlotTime(new Date(slotEnd).toISOString()) : null,
      durationMin: durMs > 0 ? Math.round(durMs / 60000) : null,
    });
    cursor = slotEnd;
  }
  return out;
}

/** 행사 시작까지 남은 일수. 오늘이면 0, 지났으면 음수. */
function calcDDay(startsAt: string | null): number | null {
  if (!startsAt) return null;
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDate = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );
  return Math.round(
    (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

/** D-day 라벨: D-DAY / D-32 / D+3 (지난 행사) */
function fmtDDayLabel(d: number): string {
  if (d === 0) return "D-DAY";
  if (d > 0) return `D-${d}`;
  return `D+${-d}`;
}

/**
 * 지도 서비스 딥링크 — 카카오 / 네이버 / 티맵.
 *  - 카카오·네이버는 웹 URL 로 검색 결과 페이지 오픈.
 *  - 티맵은 mobile 전용 deep-link (앱 미설치/PC 환경에서는 동작 안 함).
 */
function buildMapUrls(query: string): {
  kakao: string;
  naver: string;
  tmap: string;
} {
  const q = encodeURIComponent(query);
  return {
    kakao: `https://map.kakao.com/?q=${q}`,
    naver: `https://map.naver.com/v5/search/${q}`,
    tmap: `tmap://search?name=${q}`,
  };
}

/**
 * OG 메타 — 카카오톡/페이스북 등에 공유할 때 미리보기 카드.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  const { eventId } = await params;
  const event = await loadOrgEventById(eventId).catch(() => null);
  if (!event) {
    return {
      title: "초대장",
      description: "토리로 — 우리 아이 첫 캠프의 추억",
    };
  }
  const date = fmtFullDate(event.starts_at);
  // 공유 미리보기 설명 — 날짜 + 시간 범위(오후 5:00 ~ 8:00 (3시간)).
  //   시간 정보가 없을 때만 초대 인사말로 대체.
  const startClock = event.starts_at ? fmtClock(event.starts_at) : "";
  const endClock = event.ends_at ? fmtClock(event.ends_at) : "";
  const dur = fmtDuration(event.starts_at, event.ends_at);
  const timeLine =
    startClock && endClock
      ? `⏰ ${startClock} ~ ${endClock}${dur ? ` (${dur})` : ""}`
      : startClock
        ? `⏰ ${startClock}`
        : "";
  const message = event.invitation_message || "함께 즐거운 시간을 만들어요";
  const description = timeLine
    ? `📅 ${date}\n${timeLine}`
    : `📅 ${date} · ${message}`;
  return {
    title: `${event.name} — 초대장`,
    description,
    openGraph: {
      title: `${event.name} — 초대장`,
      description,
      images: event.cover_image_url ? [event.cover_image_url] : [],
      type: "website",
    },
  };
}

export default async function EventInvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const { eventId } = await params;
  const wantsPreview = (await searchParams)?.preview === "1";

  // 열람 정책 — 링크(UUID)가 곧 자격(credential).
  //  - 로그인 여부와 무관하게 누구나 열람. 이 페이지는 개인정보를 렌더하지 않는다
  //    (행사명·일시·장소·주차·타임테이블만). QR 을 인쇄·게시판 부착하는 운영을
  //    지원하려면 공개가 전제.
  //  - 기관 게이트 없음. 한 보호자가 여러 기관 초대장을 받을 수 있으므로
  //    "다른 기관 계정" 이라는 이유로 막지 않는다.
  //  - 유일한 비공개 조건은 미발행(invitation_published_at IS NULL).
  //  세션은 하단 CTA 문구를 고르는 용도로만 사용한다.
  const session = await getAppUser();

  const event = await loadOrgEventById(eventId);

  if (!event) notFound();

  // 미리보기 — 기관이 초대장을 쓰는 동안 결과를 보는 통로.
  //
  //   위 열람 정책의 **유일한 비공개 조건이 미발행**이다. 그 선을 그냥 열면
  //   링크(UUID)만 아는 사람이 남의 초안을 읽는다. 그래서 그 행사를 가진
  //   기관으로 로그인했을 때만 통과시킨다. 아니면 아무 일 없던 것처럼
  //   평소대로 — 미발행이면 초안 안내가 뜬다(존재 여부도 더 알려주지 않는다).
  const preview = wantsPreview && (await getOrg())?.orgId === event.org_id;

  // 행사 미발행 — 초안 안내
  if (!event.invitation_published_at && !preview) {
    return <PendingState eventName={event.name} />;
  }

  // ── 여기부터는 서로를 필요로 하지 않는 조회다. 한 번에 띄운다.
  //
  //    예전에는 7개를 줄줄이 await 해서, Supabase 왕복 하나(수십 ms)가 그대로
  //    7배로 쌓였다. 초대장은 QR 로 열리는 첫 화면이라 그 지연이 전부 체감된다.
  //
  //    접수 관련 3종은 event.applications_enabled 만 보고 미리 띄운다.
  //    "이미 참가 중이면 필요 없다"는 판단(joined)은 그 자체가 조회라, 기다렸다
  //    시작하면 직렬화가 되살아난다. 같은 물결에서 받아두고 아래에서 버린다.
  const wantsApplications = !!event.applications_enabled;

  const [
    joined,
    orgName,
    slots,
    applicationCounts,
    myApplication,
    consentRow,
  ] = await Promise.all([
    session
      ? isEventParticipant(eventId, session.id).catch(() => false)
      : Promise.resolve(false),
    loadPartnerDisplayNameForOrg(event.org_id).catch(() => null),
    loadTimelineSlots(eventId).catch(() => []),
    wantsApplications
      ? loadEventApplicationCounts(eventId).catch(() => null)
      : Promise.resolve(null),
    wantsApplications
      ? loadMyApplication(eventId).catch(() => null)
      : Promise.resolve(null),
    wantsApplications
      ? loadOrgApplicationConsent(event.org_id).catch(
          (): OrgConsentContext => ({ org_name: "소속 기관" })
        )
      : Promise.resolve(null),
  ]);

  const applicationsOn = wantsApplications && !joined;

  // "승인됐어요 → 입장하기" 는 **지금 들어갈 수 있다**는 약속이다.
  // 승인 뒤에 관리자가 계정을 지우거나 행사에서 제외하면 그 약속이 거짓이 되고,
  // 입장 버튼은 연락처 로그인 화면으로 튕긴다("승인됐다면서 왜 또?").
  // 참가 기록을 직접 확인해 약속을 지킬 수 있을 때만 카드를 띄운다.
  //   이 하나만 위 물결에 못 넣는다 — myApplication 이 나와야 대상을 안다.
  const approvedEntryReady =
    applicationsOn &&
    myApplication?.status === "APPROVED" &&
    myApplication.approved_user_id
      ? await isEventParticipant(
          eventId,
          myApplication.approved_user_id
        ).catch(() => false)
      : false;

  // 동의 문구 — 기관 단위. {기관명} 은 지사명(orgName)이 아니라 기관명이라
  // consentRow 안의 org_name 을 쓴다(같은 행에서 함께 온다).
  const applicationConsent: OrgConsent | null =
    applicationsOn && consentRow
      ? resolveOrgConsent(consentRow, consentRow.org_name)
      : null;
  const applicationGate = resolveApplicationGate({
    enabled: applicationsOn,
    closeAt: event.applications_close_at,
    // 마감을 안 정했으면 "행사 시작 1시간 전" 이 기본 마감.
    startsAt: event.starts_at,
    capacity: event.applications_capacity,
    approvedPeople: applicationCounts?.approved_people ?? 0,
  });

  const dateLabel = fmtFullDate(event.starts_at);
  const startClock = fmtClock(event.starts_at);
  const endClock = fmtClock(event.ends_at);
  const dDay = calcDDay(event.starts_at);
  // 입장가능시간 — 기관이 정한 분 단위 리드타임.
  //   null 이면 히어로 배지와 상세 행 두 곳 모두 렌더하지 않는다.
  const entry = resolveEntryTime(
    event.starts_at,
    event.invitation_entry_lead_min
  );
  const dur = fmtDuration(event.starts_at, event.ends_at);
  const timeLabel =
    startClock || endClock
      ? `${startClock}${startClock && endClock ? " ~ " : ""}${endClock}${dur ? ` (${dur})` : ""}`
      : "";

  const message = resolveInvitationMessage(event.invitation_message);
  const body = event.invitation_body?.trim() ?? "";
  const location = event.invitation_location?.trim();
  const address = event.invitation_address?.trim();
  const dressCode = event.invitation_dress_code?.trim();

  const parkings = (event.invitation_parkings ?? []).filter(
    (p) => p.name?.trim() || p.address?.trim()
  );

  // 지도 검색은 주소가 있으면 주소로, 없으면 장소명으로
  const mapQuery = address || location;
  const mapUrls = mapQuery ? buildMapUrls(mapQuery) : null;
  // 미리보기에선 장소가 비어 있어도 오시는 길 자리를 만들어 둔다(숨긴 채로).
  // 타이핑하면 바로 나타나야 하니까. 링크는 미리보기에서 어차피 안 눌린다.
  const mapUrlsForRender = mapUrls ?? (preview ? buildMapUrls(" ") : null);

  // 미리보기 표시 — 편집 폼이 보낸 글자를 이 자리에 갈아끼운다(preview-bridge).
  //   pv     이 요소의 글자를 바꾼다
  //   pvIf   값이 비면 숨긴다. 비어 있어도 자리는 만들어 둔다.
  // 미리보기가 아니면 둘 다 빈 객체 — 참가자가 받는 HTML 은 예전 그대로다.
  const pv = (field: string) => (preview ? { "data-inv": field } : {});
  const pvIf = (expr: string, on: boolean) =>
    preview
      ? { "data-inv-if": expr, style: on ? undefined : { display: "none" } }
      : {};

  return (
    <div className="min-h-dvh bg-[#FFFDF8]">
      {/* ─── Hero — 풀스크린 커버 + 행사명 ─── */}
      <section className="relative flex min-h-[24vh] w-full items-center justify-center overflow-hidden">
        {event.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.cover_image_url}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-[#2D5A3D] via-[#4A7C59] to-[#3A7A52]"
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/65"
        />

        {/* D-day 배지 — 좌상단 고정, 빨강 */}
        {dDay !== null && (
          <span
            className={`absolute left-4 top-4 z-[2] inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-extrabold tabular-nums shadow-lg ring-2 ${
              dDay === 0
                ? "animate-pulse bg-rose-500 text-white ring-rose-200/70"
                : dDay > 0
                  ? "bg-rose-600 text-white ring-white/40"
                  : "bg-white/30 text-white ring-white/30 backdrop-blur-sm"
            }`}
          >
            {fmtDDayLabel(dDay)}
          </span>
        )}

        <div className="relative z-[1] mx-auto max-w-md px-6 py-16 text-center text-white">
          <p className="mb-4 inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
            💌 INVITATION
          </p>
          {orgName && (
            <p className="mb-2 text-xs font-semibold tracking-wide text-[#D4E4BC] drop-shadow">
              🌲 {orgName}
            </p>
          )}
          <h1
            className="text-3xl font-extrabold leading-tight drop-shadow-md sm:text-4xl"
            {...pv("name")}
          >
            {resolveInvitationTitle(event.name)}
          </h1>
          {dateLabel !== "-" && (
            <p className="mt-6 text-base font-semibold drop-shadow">
              📅 {dateLabel}
            </p>
          )}
          {timeLabel && (
            <p className="mt-1 text-sm text-white/90 drop-shadow">
              ⏰ {timeLabel}
            </p>
          )}
          {entry && (
            <p className="mt-1 text-xs text-white/85 drop-shadow">
              🚪 입장가능시간:{" "}
              <span className="font-bold text-amber-200">{entry.clock}</span>{" "}
              <span className="text-white/70">({entry.leadMin}분 전)</span>
            </p>
          )}
          {(event.invitation_host || event.invitation_organizer) && (
            <div className="mt-2 space-y-0.5 text-xs text-white/90 drop-shadow">
              {event.invitation_host && (
                <p>
                  <span aria-hidden>🏫</span>{" "}
                  <span className="text-white/75">주최:</span>{" "}
                  <span className="font-bold">{event.invitation_host}</span>
                </p>
              )}
              {event.invitation_organizer && (
                <p>
                  <span aria-hidden>🎯</span>{" "}
                  <span className="text-white/75">주관:</span>{" "}
                  {event.invitation_organizer}
                </p>
              )}
            </div>
          )}
          {(preview || location || address) && (
            <div
              className="mt-1 inline-flex flex-wrap items-center justify-center gap-1.5 text-xs text-white/90 drop-shadow"
              {...pvIf("location|address", !!(location || address))}
            >
              <span aria-hidden>📍</span>
              {(preview || location) && (
                <span
                  className="font-bold"
                  {...pv("location")}
                  {...pvIf("location", !!location)}
                >
                  {location}
                </span>
              )}
              {(preview || (location && address)) && (
                <span {...pvIf("location&address", !!(location && address))}>
                  :
                </span>
              )}
              {(preview || address) && (
                <span
                  className="text-white/80"
                  {...pv("address")}
                  {...pvIf("address", !!address)}
                >
                  {address}
                </span>
              )}
              {(address || location) && (
                <CopyButton
                  text={address || location || ""}
                  label="📋 복사"
                  className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm hover:bg-white/25"
                  copiedLabel="✓ 복사됨"
                />
              )}
            </div>
          )}

          <span
            aria-hidden
            className="mt-12 inline-block animate-bounce text-2xl text-white/70"
          >
            ▼
          </span>
        </div>
      </section>

      {/* ─── 환영 인사 + 안내문 + 행사 디테일 ─── */}
      <section className="mx-auto max-w-md px-6 py-10">
        <div className="mb-6 text-center">
          <p className="text-3xl" aria-hidden>
            💬
          </p>
          <p
            className="mt-3 whitespace-pre-line break-words text-lg font-bold leading-relaxed text-[#2D5A3D] sm:text-xl"
            {...pv("message")}
          >
            {message}
          </p>
        </div>

        {/* 안내문 (본문) */}
        {(preview || body) && (
          <div
            className="mb-6 rounded-2xl border border-[#E5D3B8] bg-[#FFF8F0] p-5 shadow-sm"
            {...pvIf("body", !!body)}
          >
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#6B4423]">
              <span aria-hidden>📋</span>
              <span>안내문</span>
            </h2>
            <p
              className="whitespace-pre-line break-words text-sm leading-relaxed text-[#3D3A36]"
              {...pv("body")}
            >
              {body}
            </p>
          </div>
        )}

        {/* 준비물만 — 날짜·일시·입장·장소는 상단 히어로에 이미 있고,
            장소는 아래 '오시는 길' 에서 한 번 더 다룬다. 같은 정보를 세 번
            읽게 하지 않는다. 안내문 카드와 같은 톤으로 맞춰 한 덩어리로 읽히게. */}
        {/* 미리보기에선 구분선과 카드에 각각 표시를 단다 — 둘을 감싸는 div 를
            새로 만들면 실제 화면의 여백이 달라질 수 있다. */}
        {(preview || dressCode) && (
          <>
            <div
              className="mx-auto my-6 flex items-center justify-center gap-2 text-[#D4C8B8]"
              {...pvIf("dress", !!dressCode)}
            >
              <span className="h-px w-10 bg-current" />
              <span aria-hidden>◇</span>
              <span className="h-px w-10 bg-current" />
            </div>

            <div
              className="rounded-2xl border border-[#E5D3B8] bg-[#FFF8F0] p-5 shadow-sm"
              {...pvIf("dress", !!dressCode)}
            >
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#6B4423]">
                <span aria-hidden>🎒</span>
                <span>준비물</span>
              </h2>
              <p
                className="whitespace-pre-line break-words text-sm leading-relaxed text-[#3D3A36]"
                {...pv("dress")}
              >
                {dressCode}
              </p>
            </div>
          </>
        )}
      </section>

      {/* ─── 오시는 길 (장소 또는 주소가 있을 때만) ─── */}
      {(preview || location || address) && mapUrlsForRender && (
        <section
          className="mx-auto max-w-md space-y-4 px-6 py-6"
          {...pvIf("location|address", !!(location || address))}
        >
          {/* 메인 장소 카드 */}
          <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
              <span aria-hidden>🗺</span>
              <span>행사장 오시는 길</span>
            </h2>

            <div className="mt-3 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {(preview || location) && (
                  <p
                    className="break-words text-base font-bold text-[#2C2C2C]"
                    {...pv("location")}
                    {...pvIf("location", !!location)}
                  >
                    {location}
                  </p>
                )}
                {(preview || address) && (
                  <p
                    className="mt-0.5 break-words text-xs text-[#6B6560]"
                    {...pv("address")}
                    {...pvIf("address", !!address)}
                  >
                    {address}
                  </p>
                )}
              </div>
              {(address || location) && (
                <CopyButton
                  text={address || location || ""}
                  label="📋 복사"
                />
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <a
                href={mapUrlsForRender.kakao}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-yellow-400 px-3 py-2.5 text-xs font-bold text-yellow-900 shadow-sm hover:bg-yellow-500"
              >
                <span aria-hidden>🟡</span>
                <span>카카오지도</span>
              </a>
              <a
                href={mapUrlsForRender.naver}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-600"
              >
                <span aria-hidden>🟢</span>
                <span>네이버지도</span>
              </a>
            </div>

            {/* 행사장 사진 — 입구/간판 등 */}
            {event.invitation_location_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.invitation_location_image_url}
                alt={location ? `${location} 행사장 사진` : "행사장 사진"}
                className="mt-3 w-full rounded-xl border border-[#D4E4BC] object-cover shadow-sm"
                loading="lazy"
              />
            )}
          </div>

          {/* 주차장 카드들 */}
          {parkings.length > 0 && (
            <div className="space-y-2">
              {parkings.map((p, idx) => {
                const pQuery = (p.address?.trim() || p.name?.trim()) ?? "";
                if (!pQuery) return null;
                const pUrls = buildMapUrls(pQuery);
                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-[#E5D3B8] bg-[#FFF8F0] p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                        🅿 제{idx + 1}주차장
                      </span>
                      {(p.address || p.name) && (
                        <CopyButton
                          text={p.address || p.name}
                          label="📋 복사"
                          className="rounded-full border border-[#D4E4BC] bg-white px-2.5 py-1 text-[10px] font-bold text-[#2D5A3D] shadow-sm hover:bg-[#F5F1E8]"
                        />
                      )}
                    </div>
                    {p.name && (
                      <p className="mt-2 break-words text-sm font-bold text-[#2C2C2C]">
                        {p.name}
                      </p>
                    )}
                    {p.address && (
                      <p className="mt-0.5 break-words text-xs text-[#6B6560]">
                        {p.address}
                      </p>
                    )}
                    {p.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt={p.name ? `${p.name} 사진` : `제${idx + 1}주차장 사진`}
                        className="mt-2 w-full rounded-lg border border-[#E5D3B8] object-cover shadow-sm"
                        loading="lazy"
                      />
                    )}
                    <div className="mt-3 grid grid-cols-3 gap-1.5">
                      <a
                        href={pUrls.naver}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500 px-2 py-2 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-600"
                      >
                        <span aria-hidden>🟢</span>
                        <span>네이버</span>
                      </a>
                      <a
                        href={pUrls.kakao}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-yellow-400 px-2 py-2 text-[11px] font-bold text-yellow-900 shadow-sm hover:bg-yellow-500"
                      >
                        <span aria-hidden>🟡</span>
                        <span>카카오</span>
                      </a>
                      <a
                        href={pUrls.tmap}
                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-2 py-2 text-[11px] font-bold text-white shadow-sm hover:bg-blue-700"
                      >
                        <span aria-hidden>🔵</span>
                        <span>티맵</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ─── 타임테이블 — 4개까지 보이고 "전체 보기" 토글로 펼침. ─── */}
      {slots.length > 0 && (() => {
        const slotTimes = computeSlotDisplayTimes(event.starts_at, slots);
        return (
          <section className="mx-auto max-w-md px-6 py-10">
            <h2 className="mb-4 flex items-center justify-center gap-2 text-base font-bold text-[#2D5A3D]">
              <span aria-hidden>🕐</span>
              <span>그날의 흐름</span>
            </h2>
            <TimelineCollapsible slots={slots} slotTimes={slotTimes} />
          </section>
        );
      })()}

      {/* DRAFT(예정) 행사 — 행사 시작 전 안내만 노출. 미션/FM 링크는 숨김. */}
      {event.status === "DRAFT" && (
        <section className="mx-auto max-w-md px-6 py-8">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-center">
            <p className="text-sm font-bold text-amber-900">
              🌱 행사 시작일에 다시 만나요
            </p>
            <p className="mt-1.5 text-[11px] text-amber-800/80">
              행사가 시작되면 미션·라이브 방송이 활성화돼요.
            </p>
          </div>
        </section>
      )}

      {/* ─── 하단 — 접수제 여부에 따라 CTA / 신청 폼 / 상태 카드 ─── */}
      <InvitationFooter
        eventId={eventId}
        eventStatus={event.status}
        joined={joined}
        loggedIn={!!session}
        gate={applicationGate}
        myApplication={myApplication}
        counts={applicationCounts}
        consent={applicationConsent}
        approvedEntryReady={approvedEntryReady}
      />

      {preview && (
        <>
          {/*
            미리보기 안의 스크롤 막대 — 없애지 않고 얇게 다듬는다.

            윈도우 기본 막대는 폭을 15px 쯤 먹는다. 그만큼 본문이 390 이 아니라
            375 로 접혀서 **글줄이 실제와 다른 데서 끊긴다** — 미리보기를 만든
            목적이 바로 그 글줄이다. 6px 으로 줄이면 384 라 거의 차이가 없다.
            통째로 숨기지 않는 이유는 스크롤이 되는 화면이라는 걸 알려야 해서다.

            위아래를 14px 씩 띄운다. 폰 모서리가 둥글어서, 안 띄우면 막대 끝이
            그 곡선을 파고든다.
          */}
          <style>{PREVIEW_SCROLLBAR_CSS}</style>
          <InvitationPreviewBridge />
        </>
      )}
    </div>
  );
}

/* ────────────────────────── 보조 컴포넌트 ────────────────────────── */

function PendingState({ eventName }: { eventName: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#FFFDF8] px-6 py-12 text-center">
      <p className="text-6xl" aria-hidden>
        🌱
      </p>
      <h1 className="mt-6 text-xl font-bold text-[#2D5A3D]">
        초대장이 곧 공개돼요
      </h1>
      <p className="mt-2 max-w-sm text-sm text-[#6B6560]">
        <b className="text-[#2D5A3D]">{eventName}</b> 초대장이 아직 발행되지
        않았어요. 기관에서 발행하면 이 페이지에서 자동으로 보여집니다.
      </p>
      <Link
        href="/home"
        className="mt-6 inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8]"
      >
        <span aria-hidden>🏠</span>
        <span>홈으로 돌아가기</span>
      </Link>
    </div>
  );
}


/**
 * 초대장 하단 — 접수제 여부로 먼저 갈라진다.
 *
 *  접수 OFF                  → 기존 InvitationCta (바로 참가 / 입장)
 *  접수 ON + 이미 참가자      → InvitationCta (입장)  ※ gate 가 DISABLED 로 온다
 *  접수 ON + 마감            → 마감 안내 (단, 내 신청서가 있으면 상태 카드 우선)
 *  접수 ON + 내 신청서 대기/승인 → 상태 카드
 *  접수 ON + 그 외           → 신청 폼 (거절됐던 경우 재신청 안내 얹어서)
 */
function InvitationFooter({
  eventId,
  eventStatus,
  joined,
  loggedIn,
  gate,
  myApplication,
  counts,
  consent,
  approvedEntryReady,
}: {
  eventId: string;
  eventStatus: string;
  joined: boolean;
  loggedIn: boolean;
  gate: ApplicationGate;
  myApplication: OrgEventApplicationRow | null;
  counts: OrgEventApplicationCounts | null;
  /** 접수를 쓰지 않는 행사면 null — 신청 폼 자체가 뜨지 않는다. */
  consent: OrgConsent | null;
  /** APPROVED 신청서의 참가 기록이 실제로 살아 있는가. */
  approvedEntryReady: boolean;
}) {
  // 기관이 종료·보관한 행사 — 접수 마감 시각과 무관하게 신청을 받지 않는다.
  // 이미 참가한 가족은 그대로 들어간다(사진·설문이 남아 있다).
  const orgClosed = !resolveEventAccess({
    status: eventStatus,
    startsAt: null,
    endsAt: null,
  }).canJoin;
  if (orgClosed && !joined) {
    return (
      <section className="mx-auto max-w-md px-6 pb-14 pt-2">
        <div className="rounded-2xl border border-[#E8E4DE] bg-[#FAF8F5] px-5 py-6 text-center">
          <p className="text-3xl" aria-hidden>
            🏁
          </p>
          <p className="mt-2 text-sm font-bold text-[#6B6560]">
            마감된 행사예요
          </p>
          <p className="mt-1 text-[11px] text-[#8B7F75]">
            다음 행사에서 만나요!
          </p>
        </div>
      </section>
    );
  }

  if (gate.kind === "DISABLED") {
    return (
      <InvitationCta
        eventId={eventId}
        eventStatus={eventStatus}
        joined={joined}
        loggedIn={loggedIn}
      />
    );
  }

  // 마감 안내 문구 — 기관이 지정한 마감과 "행사 1시간 전" 기본값을 구분해 적는다.
  const closeLabel =
    gate.kind === "OPEN" && gate.closeAt
      ? gate.closeIsImplicit
        ? `${fmtDateTimeKst(gate.closeAt)} 까지 접수 (행사 시작 1시간 전)`
        : `${fmtDateTimeKst(gate.closeAt)} 까지 접수`
      : null;

  // 대기/승인 중인 내 신청서가 있으면 마감보다 상태 카드가 우선.
  // 거절·취소는 재신청을 허용하므로 카드 대신 폼을 다시 띄운다.
  const live =
    myApplication?.status === "PENDING" ||
    (myApplication?.status === "APPROVED" && approvedEntryReady);
  if (myApplication && live) {
    // 카드에서 [수정] 을 누르면 같은 자리에 폼이 뜬다 — 그래서 카드가 폼에
    // 필요한 값(동의 문구·정원·마감)까지 함께 들고 있어야 한다.
    return (
      <ApplicationStatusSection
        eventId={eventId}
        application={myApplication}
        gate={gate}
        consent={consent ?? resolveOrgConsent(null, "소속 기관")}
        atCapacity={gate.kind === "OPEN" ? gate.atCapacity : false}
        capacity={gate.kind === "OPEN" ? gate.capacity : null}
        approvedPeople={counts?.approved_people ?? 0}
        closeLabel={closeLabel}
      />
    );
  }

  if (gate.kind === "CLOSED") {
    return (
      <ApplicationClosedCard closedAt={gate.closedAt} implicit={gate.implicit} />
    );
  }

  return (
    <>
      {myApplication?.status === "APPROVED" && !approvedEntryReady && (
        <div className="mx-auto max-w-md px-6 pt-2">
          <p className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs leading-relaxed text-amber-900">
            ⚠️ 승인 기록은 있는데 참가자 명단에서 확인되지 않아요. 기관에서 참가
            정보를 정리했을 수 있어요. 번거로우시겠지만 아래에서 다시 신청해
            주세요.
          </p>
        </div>
      )}
      {myApplication?.status === "REJECTED" && (
        <div className="mx-auto max-w-md px-6 pt-2">
          <p className="rounded-2xl border border-[#E8DDC8] bg-[#F5F1E8]/70 px-4 py-3 text-xs leading-relaxed text-[#6B4423]">
            🌧 이전 신청은 승인되지 않았어요. 내용을 다시 확인하고 신청하시면
            기관에서 다시 검토해 드려요.
          </p>
        </div>
      )}
      {myApplication?.status === "CANCELED" && (
        <div className="mx-auto max-w-md px-6 pt-2">
          <p className="rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-xs leading-relaxed text-rose-800">
            🚫 참가를 취소하셨어요
            {myApplication.canceled_at
              ? ` (${fmtDateTimeKst(myApplication.canceled_at)})`
              : ""}
            . 다시 오시려면 아래에서 신청서를 새로 내주세요.
          </p>
        </div>
      )}
      <ApplicationForm
        eventId={eventId}
        atCapacity={gate.atCapacity}
        capacity={gate.capacity}
        approvedPeople={counts?.approved_people ?? 0}
        closeLabel={closeLabel}
        consent={consent ?? resolveOrgConsent(null, "소속 기관")}
      />
    </>
  );
}

/**
 * 하단 CTA — 열람자 상태별 3분기.
 *
 *  1) 미로그인            → "이 행사 참가하기" (/join/event/{id} 에서 연락처 확인)
 *  2) 로그인 + 참가 완료  → "행사 입장하기" (/home?event_id={id})
 *  3) 로그인 + 미참가     → "이 행사 참가하기" (기관이 달라도 동일 — 기관 벽 없음)
 *
 * 기관 일치 여부로는 분기하지 않는다. 한 보호자가 여러 기관 초대장을 받는 것이
 * 정상 시나리오이므로, 판단 기준은 "이 행사에 참가했는가" 하나뿐.
 */
function InvitationCta({
  eventId,
  eventStatus,
  joined,
  loggedIn,
}: {
  eventId: string;
  eventStatus: string;
  joined: boolean;
  loggedIn: boolean;
}) {
  const isLive = eventStatus === "LIVE";

  // 참가 완료 → 앱으로. 미참가 → 참가 플로우로.
  // 입장은 /api/user/enter-event 경유 — 활성 기관을 이 행사의 기관으로 전환한다.
  // (다른 기관 컨텍스트로 로그인한 채 들어와도 이 행사 화면이 뜨도록)
  const href = joined
    ? `/api/user/enter-event?event_id=${eventId}`
    : `/join/event/${eventId}`;
  const ended = eventStatus === "ENDED" || eventStatus === "ARCHIVED";
  const icon = joined ? (isLive ? "🎪" : ended ? "🏁" : "🏠") : "🌲";
  const label = joined
    ? isLive
      ? "행사 입장하기"
      : ended
        ? "추억 보기"
        : "토리로 앱 홈으로"
    : "이 행사 참가하기";
  const hint = joined
    ? ended
      ? "그날의 사진과 기록이 남아 있어요"
      : "미션·스탬프북·토리FM 라이브를 앱에서 즐겨보세요"
    : loggedIn
      ? "참가하면 스탬프북·프로그램을 바로 시작할 수 있어요"
      : "연락처만 입력하면 바로 참가할 수 있어요";

  return (
    <section className="mx-auto max-w-md px-6 pb-14 pt-2">
      <Link
        href={href}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-6 py-4 text-base font-bold text-white shadow-lg transition hover:from-[#234a30] hover:to-[#2D5A3D]"
      >
        <span aria-hidden>{icon}</span>
        <span>{label}</span>
        <span aria-hidden>→</span>
      </Link>
      <p className="mt-2 text-center text-[11px] text-[#8B7F75]">{hint}</p>
    </section>
  );
}
