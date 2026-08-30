import Link from "next/link";
import { notFound } from "next/navigation";
import {
  resolveStep,
  resolveStepStatuses,
  stepHref,
  stepOf,
  type StepKey,
} from "@/lib/org-events/event-steps";
import { EventStepBar } from "./event-step-bar";
import { InvitationStep } from "./invitation-step";
import { RunToolsPanel } from "./run-tools-panel";
import { ImportQuestPack } from "./import-quest-pack";
import { SurveyPanel } from "./survey-panel";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  fmtClockKst,
  fmtDateTimeKst,
  fmtFullDateKst,
  toLocalInputFromIsoKst,
} from "@/lib/datetime/kst";
import {
  loadOrgEventById,
  loadOrgEvents,
  loadOrgEventSummaryById,
  loadEventQuestPackIds,
  loadEventParticipantIds,
  loadEventProgramIds,
  loadEventTrailIds,
  loadParticipantOptionsForOrg,
  loadParticipantOptionsByIds,
} from "@/lib/org-events/queries";
import {
  ORG_EVENT_STATUS_META,
  type OrgEventStatus,
} from "@/lib/org-events/types";
import { deleteOrgEventAction } from "@/lib/org-events/actions";
import { loadTrailsAssignedToOrg } from "@/lib/trails/queries";
import { DeleteEventButton } from "./delete-button";
// 상태 변경은 목록 카드와 같은 4종 셀렉터를 재사용한다.
import { EventStatusToggle } from "../status-toggle";
import { describeEventStatus } from "@/lib/org-events/event-status-label";
import {
  QuestPacksTab,
  type QuestPackOption,
} from "./quest-packs-tab";
import { ProgramsTab, type ProgramOption } from "./programs-tab";
import { TrailsTab, type TrailOption } from "./trails-tab";
import {
  FmSessionsTab,
  type FmSessionOption,
} from "./fm-sessions-tab";
import { AnalyticsTabPanel } from "./analytics-tab";
import { TimelineTabPanel } from "./timeline-tab";
import { ParticipantsTab } from "./participants-tab";
import { ApplicationsTab } from "./applications-tab";
import {
  loadEventApplicationCounts,
  loadEventApplications,
  loadEventParticipantPhones,
  loadEventPartyCounts,
  loadOrgApplicationConsent,
} from "@/lib/org-events/application-queries";
import {
  DEFAULT_CONSENT_BODY,
  DEFAULT_CONSENT_OPTIONAL_BODY,
  type OrgConsentContext,
} from "@/lib/org-events/consent-core";
import type { OrgEventApplicationCounts } from "@/lib/org-events/types";
import { computeEffectiveCloseAt } from "@/lib/org-events/application-core";
import { loadEventChildrenByUser } from "@/lib/app-user/event-children";
import { loadEventAcornBalances } from "@/lib/app-user/event-acorns";
import { InvitationCardShare } from "./invitation-card-share";
import { PhotoFeedToggle } from "./photo-feed-toggle";

export const dynamic = "force-dynamic";

// 탭 정의·파싱·링크는 event-steps.ts 한 곳에 있다(예전 ?tab= 링크 매핑 포함).

// 시간 포맷은 KST 강제 — 서버/클라이언트 timezone 불일치 방지.
//   fmtDateWeekday → "2026.05.16(토)"
//   fmtClock       → "09:00" (자정은 빈 문자열)
const fmtDateWeekday = (iso: string | null) => {
  // fmtFullDateKst 는 "2026.05.16 (토)" 공백 포함 — 기존 라벨은 공백 없는 형태이므로 그대로 사용.
  if (!iso) return "-";
  return fmtFullDateKst(iso).replace(" (", "(");
};
const fmtClock = (iso: string | null) => fmtClockKst(iso);

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
  if (!starts && !ends) return "기간 미정";
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
    return `${sLabel} ~ ${eLabel}`;
  }
  if (sameDay) {
    return `${sLabel} ${sClock}${sClock && eClock ? " ~ " : ""}${eClock}${durSuffix}`;
  }
  return `${sLabel}${sClock ? ` ${sClock}` : ""} ~ ${eLabel}${eClock ? ` ${eClock}` : ""}${durSuffix}`;
}

export default async function OrgEventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
  searchParams: Promise<{
    step?: string;
    sub?: string;
    /** 예전 링크 — event-steps 가 새 단계로 옮겨준다. */
    tab?: string;
    saved?: string;
  }>;
}) {
  const { orgId, eventId } = await params;
  const sp = await searchParams;
  // 넷 다 서로를 필요로 하지 않는다. 줄줄이 await 하면 Supabase 왕복이 그대로
  // 4배로 쌓여, 탭을 옮길 때마다 그 지연을 다시 문다.
  //   · summary / applicationCounts 는 eventId 만 있으면 되고
  //   · 소유권 검사(event.org_id !== orgId)는 받은 뒤에 해도 늦지 않다
  //     (권한 없는 요청이면 어차피 notFound 로 끝난다)
  const [, event, summary, applicationCounts] = await Promise.all([
    requireOrg(),
    loadOrgEventById(eventId),
    loadOrgEventSummaryById(eventId),
    loadEventApplicationCounts(eventId),
  ]);

  if (!event || event.org_id !== orgId) {
    notFound();
  }

  const { step, sub } = resolveStep({
    step: sp.step,
    sub: sp.sub,
    tab: sp.tab,
  });
  const saved = sp.saved === "1";

  const pendingApplications = applicationCounts.pending_count;
  const eventBase = `/org/${orgId}/events/${eventId}`;

  // 단계 막대에 걸 상태 — 설명문 대신 이게 "다음에 뭘 하지" 에 답한다.
  const stepStatuses = resolveStepStatuses({
    hasName: Boolean(event.name?.trim()),
    hasSchedule: Boolean(event.starts_at),
    invitationReady: Boolean(
      event.invitation_message?.trim() || event.invitation_body?.trim()
    ),
    invitationPublished: Boolean(event.invitation_published_at),
    pendingApplications,
    participantCount: summary?.participant_count ?? 0,
    questPackCount: summary?.quest_pack_count ?? 0,
    surveyResponseCount: 0,
    eventEnded: event.status === "ENDED",
  });

  const statusMeta = ORG_EVENT_STATUS_META[event.status];
  // 배지가 상태만이 아니라 날짜까지 말한다 — "종료" 만 적혀 있으면 어제 끝난
  // 행사와 작년에 끝난 행사가 같은 글자다.
  const statusDesc = describeEventStatus({
    status: event.status,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
  });
  const isLive = event.status === "LIVE";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* 단계 막대 — 페이지 맨 위. 가려는 곳보다 이동 수단이 위에 있어야 한다.
          빵부스러기(기관 홈 / 행사 / 행사이름)를 대신한다: 기관 홈은 상단 🌿
          로고가, 행사 목록은 이 막대의 ← 한 줄이, 행사 이름은 바로 아래 제목이
          이미 맡고 있었다. */}
      <EventStepBar
        base={eventBase}
        current={step}
        currentSub={sub}
        statuses={stepStatuses}
        backHref={`/org/${orgId}/events`}
      />

      {/* 저장 완료 배너 */}
      {saved && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
        >
          ✅ 저장되었어요
        </div>
      )}

      {/* Header */}
      <section
        className={`overflow-hidden rounded-2xl shadow-sm ${
          isLive
            ? "border-2 border-emerald-500 ring-2 ring-emerald-300/40"
            : "border border-[#D4E4BC]"
        }`}
      >
        {event.cover_image_url ? (
          <div
            className="h-40 w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${event.cover_image_url})` }}
            role="img"
            aria-label={`${event.name} 커버 이미지`}
          />
        ) : (
          <div
            className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-[#2D5A3D] via-[#4A7C59] to-[#2D5A3D] text-6xl text-white"
            aria-hidden
          >
            🎪
          </div>
        )}

        <div className="space-y-3 bg-white p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    isLive
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : statusMeta.color
                  }`}
                >
                  {statusDesc.emoji} {statusDesc.label}
                </span>
                <span className="text-[11px] text-[#6B6560]">
                  📅 {fmtRange(event.starts_at, event.ends_at)}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold text-[#2D5A3D] md:text-3xl">
                {event.name}
              </h1>
              {/* 소개글 — 접어 둔다.
                  초대장에 실릴 홍보 문구라 길다(이 기관 건 여섯 줄이다). 기관이
                  직접 쓴 글이라 워크스페이스를 열 때마다 다시 읽을 일이 없는데,
                  펼쳐두면 화면 첫 장을 이 글이 통째로 먹었다. 실제 모습은 이제
                  ② 초대장의 폰 미리보기에서 본다. */}
              {event.description && (
                <details className="group mt-2">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[11px] font-semibold text-[#8B7F75] transition hover:text-[#2D5A3D] [&::-webkit-details-marker]:hidden">
                    <span
                      aria-hidden
                      className="inline-block transition-transform group-open:rotate-90"
                    >
                      ›
                    </span>
                    소개글
                  </summary>
                  <p className="mt-2 max-w-2xl text-sm text-[#6B6560]">
                    {event.description}
                  </p>
                </details>
              )}
            </div>

            {/* Right CTA group — 액션 버튼과 상태 칩이 한 줄에서 높이가 맞는다.
                (상태 칩은 EventStatusToggle 의 inline 변형) */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/org/${orgId}/events/${eventId}?tab=participants`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#234A31]"
                title="이 행사에 참가자를 추가하거나 명단을 관리합니다"
              >
                <span aria-hidden>➕</span>
                <span>참가자 등록</span>
              </Link>
              <a
                href={`/api/org/${orgId}/events/${eventId}/export/participants`}
                download
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-3.5 py-2 text-xs font-bold text-[#2D5A3D] hover:bg-[#F5F1E8]"
                title="이 행사 참가자 목록을 CSV 파일로 내려받습니다"
              >
                <span aria-hidden>📥</span>
                <span>참가자 CSV</span>
              </a>
              <Link
                href={`/org/${orgId}/events/${eventId}/edit`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-3.5 py-2 text-xs font-bold text-[#2D5A3D] hover:bg-[#F5F1E8]"
              >
                <span aria-hidden>✏️</span>
                <span>편집</span>
              </Link>
              {/* 상태 — 4종 전부 직접 고를 수 있게. 예전에는 "다음 단계"
                  버튼 하나(예정→시작, 진행중→종료…)뿐이라 되돌리거나 건너뛸
                  수 없었다. 목록 카드와 같은 컨트롤의 inline 변형.
                  구분선으로 "작업" 과 "상태 전환" 을 눈으로 가른다. */}
              <span
                aria-hidden
                className="mx-1 hidden h-7 w-px shrink-0 bg-[#E5D3B8] sm:block"
              />
              <EventStatusToggle
                eventId={eventId}
                initialStatus={event.status}
                startsAt={event.starts_at}
                endsAt={event.ends_at}
                variant="inline"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 단계 화면 */}
      <section>
        {sub === "overview" ? (
          <>
            {/* 승인 대기 알림 — 방치하면 참가자가 안 늘어난다. */}
            {pendingApplications > 0 && (
              <Link
                href={`${eventBase}?step=people`}
                className="mb-4 flex items-center gap-3 rounded-2xl border-2 border-rose-300 bg-rose-50 px-4 py-3 shadow-sm transition hover:bg-rose-100"
              >
                <span className="text-2xl" aria-hidden>
                  📥
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-rose-900">
                    승인 대기 {pendingApplications}건
                  </p>
                  <p className="mt-0.5 text-xs text-rose-800">
                    초대장으로 참가 신청이 들어왔어요. 수락해야 참가자가 됩니다.
                  </p>
                </div>
                <span aria-hidden className="text-lg text-rose-400">
                  →
                </span>
              </Link>
            )}

            {/* 초대장 정보 미완성 안내 — 장소·주차장이 비어있으면 admin 에게 알림 */}
            {(() => {
              const hasLocation =
                Boolean(event.invitation_location?.trim()) ||
                Boolean(event.invitation_address?.trim());
              const hasParking = (event.invitation_parkings ?? []).some(
                (p) => p.name?.trim() || p.address?.trim()
              );
              if (hasLocation && hasParking) return null;
              const missing: string[] = [];
              if (!hasLocation) missing.push("📍 장소·주소");
              if (!hasParking) missing.push("🅿 주차장");
              return (
                <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 shadow-sm">
                  <span className="text-2xl" aria-hidden>
                    ⚠️
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-amber-900">
                      초대장 정보가 비어있어요
                    </p>
                    <p className="mt-0.5 text-xs text-amber-800">
                      참가자에게 안내될 <b>{missing.join(", ")}</b> 정보가 아직
                      입력되지 않았어요. [정보 수정]에서 추가해주세요.
                    </p>
                  </div>
                  <Link
                    href={`/org/${orgId}/events/${eventId}/edit`}
                    className="shrink-0 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-600"
                  >
                    ✏️ 정보 수정
                  </Link>
                </div>
              );
            })()}

            <InvitationCardShare
              eventId={eventId}
              eventName={event.name}
              publishedAt={event.invitation_published_at ?? null}
            />
            <div className="h-4" />
            <PhotoFeedToggle
              eventId={eventId}
              initialEnabled={event.photo_feed_enabled === true}
            />
            <div className="h-4" />
            <OverviewPanel
              orgId={orgId}
              eventId={eventId}
              eventName={event.name}
              status={event.status}
              startsAt={event.starts_at}
              endsAt={event.ends_at}
              counts={{
                quest_pack_count: summary?.quest_pack_count ?? 0,
                participant_count: summary?.participant_count ?? 0,
                fm_session_count: summary?.fm_session_count ?? 0,
                program_count: summary?.program_count ?? 0,
                trail_count: summary?.trail_count ?? 0,
              }}
            />
          </>
        ) : sub === "timeline" ? (
          <TimelineTabPanel orgId={orgId} eventId={eventId} />
        ) : step === "invite" ? (
          <InvitationStep
            orgId={orgId}
            eventId={eventId}
            event={event}
            sub={sub}
          />
        ) : sub === "applications" ? (
          <ApplicationsTabPanel
            orgId={orgId}
            eventId={eventId}
            enabled={!!event.applications_enabled}
            closeAtLocal={toLocalInputFromIsoKst(event.applications_close_at)}
            capacity={
              event.applications_capacity
                ? String(event.applications_capacity)
                : ""
            }
            invitationPublished={!!event.invitation_published_at}
            counts={applicationCounts}
            defaultCloseLabel={(() => {
              // 마감을 비워뒀을 때 실제로 적용될 시각 = 행사 시작 1시간 전.
              const { at } = computeEffectiveCloseAt(
                null,
                event.starts_at
              );
              return at ? fmtDateTimeKst(at) : null;
            })()}
          />
        ) : sub === "roster" ? (
          <ParticipantsTabPanel
            orgId={orgId}
            eventId={eventId}
            allowSelfRegister={event.allow_self_register ?? false}
            eventStatus={event.status}
          />
        ) : sub === "questpacks" ? (
          <QuestPacksTabPanel orgId={orgId} eventId={eventId} />
        ) : sub === "programs" ? (
          <ProgramsTabPanel orgId={orgId} eventId={eventId} />
        ) : sub === "trails" ? (
          <TrailsTabPanel orgId={orgId} eventId={eventId} />
        ) : sub === "fm" ? (
          <FmSessionsTabPanel orgId={orgId} eventId={eventId} />
        ) : sub === "tools" ? (
          <RunToolsPanel orgId={orgId} />
        ) : sub === "analytics" ? (
          <AnalyticsTabPanel orgId={orgId} eventId={eventId} />
        ) : sub === "survey" ? (
          <SurveyPanel
            orgId={orgId}
            eventId={eventId}
            surveyEnabled={
              (event as unknown as { survey_enabled?: boolean })
                .survey_enabled ?? false
            }
            endsAt={event.ends_at}
            openLeadMin={
              (event as unknown as { survey_open_lead_min?: number | null })
                .survey_open_lead_min
            }
            // 응답률의 분모. 이미 위에서 읽은 값이라 조회가 늘지 않는다.
            participantCount={summary?.participant_count ?? 0}
          />
        ) : (
          <StepComingSoon step={step} sub={sub} />
        )}
      </section>

      {/* 위험 영역 — ① 내 행사 에서만.
          예전엔 모든 단계 아래에 붙어 있었다. 설문 결과를 보다가도, 숲길을
          고치다가도 화면 끝에 빨간 "영구 삭제" 경고문 세 줄이 나왔다.
          행사를 지우는 일은 행사 자체를 다루는 자리에 있으면 된다. */}
      {step === "event" && (
        <DangerZone eventId={eventId} eventName={event.name} />
      )}
    </div>
  );
}

function OverviewPanel({
  orgId,
  eventId,
  eventName,
  status,
  startsAt,
  endsAt,
  counts,
}: {
  orgId: string;
  eventId: string;
  eventName: string;
  status: OrgEventStatus;
  startsAt: string | null;
  endsAt: string | null;
  counts: {
    quest_pack_count: number;
    participant_count: number;
    fm_session_count: number;
    program_count: number;
    trail_count: number;
  };
}) {
  const items: Array<{
    icon: string;
    label: string;
    value: number;
    step: StepKey;
    sub: string;
    /** 강조 카드 — 참가자처럼 "지금 등록해야 할" 핵심 자원 */
    highlight?: boolean;
  }> = [
    {
      icon: "🙋",
      label: "참가자",
      value: counts.participant_count,
      step: "people",
      sub: "roster",
      highlight: true,
    },
    {
      icon: "📚",
      label: "스탬프북",
      value: counts.quest_pack_count,
      step: "run",
      sub: "questpacks",
    },
    {
      icon: "🎙",
      label: "토리FM 세션",
      value: counts.fm_session_count,
      step: "run",
      sub: "fm",
    },
    {
      icon: "🗂",
      label: "프로그램",
      value: counts.program_count,
      step: "run",
      sub: "programs",
    },
    {
      icon: "🗺",
      label: "숲길",
      value: counts.trail_count,
      step: "run",
      sub: "trails",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {items.map((it) => {
          const isZero = it.value === 0;
          const isParticipants = it.sub === "roster";
          return (
            <Link
              key={it.sub}
              href={stepHref(
                `/org/${orgId}/events/${eventId}`,
                it.step,
                it.sub
              )}
              className={`rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
                it.highlight && isZero
                  ? "border-amber-400 bg-amber-50 hover:border-amber-500"
                  : "border-[#D4E4BC] hover:border-[#2D5A3D]"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-[#6B6560]">
                  {it.label}
                </p>
                <span className="text-2xl" aria-hidden>
                  {it.icon}
                </span>
              </div>
              <p
                className={`mt-1 text-2xl font-extrabold ${
                  it.highlight && isZero ? "text-amber-700" : "text-[#2D5A3D]"
                }`}
              >
                {it.value.toLocaleString("ko-KR")}
                {isParticipants && (
                  <span className="ml-1 text-xs font-semibold text-[#6B6560]">
                    명
                  </span>
                )}
              </p>
              {isParticipants && (
                <p
                  className={`mt-1 text-[11px] font-bold ${
                    isZero ? "text-amber-700" : "text-[#2D5A3D]"
                  }`}
                >
                  {isZero ? "👉 지금 등록하기" : "+ 등록 / 관리"}
                </p>
              )}
            </Link>
          );
        })}
      </div>

      <NextStepsPanel
        orgId={orgId}
        eventId={eventId}
        eventName={eventName}
        status={status}
        startsAt={startsAt}
        endsAt={endsAt}
        counts={counts}
      />
    </div>
  );
}

function NextStepsPanel({
  orgId,
  eventId,
  eventName,
  status,
  startsAt,
  endsAt,
  counts,
}: {
  orgId: string;
  eventId: string;
  eventName: string;
  status: OrgEventStatus;
  startsAt: string | null;
  endsAt: string | null;
  counts: {
    quest_pack_count: number;
    participant_count: number;
    fm_session_count: number;
    program_count: number;
    trail_count: number;
  };
}) {
  if (status === "DRAFT") {
    return (
      <DraftNextSteps
        orgId={orgId}
        eventId={eventId}
        startsAt={startsAt}
        endsAt={endsAt}
        counts={counts}
      />
    );
  }
  if (status === "LIVE") {
    return (
      <LiveNextSteps
        orgId={orgId}
        eventId={eventId}
        eventName={eventName}
        counts={counts}
      />
    );
  }
  if (status === "ENDED") {
    return <EndedNextSteps orgId={orgId} eventId={eventId} />;
  }
  return <ArchivedNextSteps />;
}

function DraftNextSteps({
  orgId,
  eventId,
  startsAt,
  endsAt,
  counts,
}: {
  orgId: string;
  eventId: string;
  startsAt: string | null;
  endsAt: string | null;
  counts: {
    quest_pack_count: number;
    participant_count: number;
    fm_session_count: number;
    program_count: number;
    trail_count: number;
  };
}) {
  const checks = [
    {
      done: counts.quest_pack_count > 0,
      label: "스탬프북 연결",
      hint: "아이들이 찍을 미션 모음이에요.",
      cta: {
        label: "스탬프북으로",
        href: stepHref(`/org/${orgId}/events/${eventId}`, "run", "questpacks"),
      },
    },
    {
      done: Boolean(startsAt && endsAt),
      label: "기간 설정",
      hint: "시작·종료 일시를 지정하세요.",
      cta: { label: "편집 열기", href: `/org/${orgId}/events/${eventId}/edit` },
    },
    {
      done: counts.participant_count > 0,
      label: "참가자 1명 이상",
      hint: "먼저 시작 후 초대 링크로 받아도 괜찮아요.",
      cta: null as null | { label: string; href?: string },
    },
  ];
  const doneCount = checks.filter((c) => c.done).length;
  const allReady = doneCount === checks.length;

  return (
    <div className="rounded-2xl border border-[#E5D3B8] bg-[#FFF8F0] p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold text-[#8B6F47]">
          <span aria-hidden>🧭</span>
          <span>시작 전 체크리스트</span>
        </p>
        <p className="text-[11px] font-semibold text-[#8B6F47]">
          {doneCount}/{checks.length} 완료
        </p>
      </div>

      <ul className="mt-3 space-y-2">
        {checks.map((c) => (
          <li
            key={c.label}
            className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-[#D4E4BC] bg-white p-3"
          >
            <div className="flex min-w-0 items-start gap-2">
              <span className="text-lg" aria-hidden>
                {c.done ? "✅" : "⬜️"}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#2D5A3D]">
                  {c.label}
                </p>
                <p className="text-[11px] text-[#6B6560]">{c.hint}</p>
              </div>
            </div>
            {!c.done && c.cta?.href && (
              <Link
                href={c.cta.href}
                className="shrink-0 rounded-lg border border-[#D4E4BC] bg-[#F5F1E8] px-2.5 py-1.5 text-[11px] font-bold text-[#2D5A3D] hover:border-[#2D5A3D]"
              >
                {c.cta.label} →
              </Link>
            )}
          </li>
        ))}
      </ul>

      {allReady ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800">
          🎉 준비 완료! 상단 <span className="font-bold">🚀 시작</span> 버튼을
          눌러 행사를 공개해 주세요.
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-[#6B6560]">
          체크리스트가 모두 채워지면 상단에서 행사를 시작할 수 있어요.
        </p>
      )}
    </div>
  );
}

function LiveNextSteps({
  orgId,
  eventId,
  eventName,
  counts,
}: {
  orgId: string;
  eventId: string;
  eventName: string;
  counts: {
    quest_pack_count: number;
    participant_count: number;
    fm_session_count: number;
    program_count: number;
    trail_count: number;
  };
}) {
  return (
    <div className="space-y-3">
      {/* 참가자 초대 링크 카드는 상단 [📨 초대장 공유] 카드와 동일한 URL 을 노출해
          중복이라 제거됨 (2026-05-06). 발행 토글·복사·공유·미리보기는 모두
          [InvitationCardShare] 가 담당한다. */}

      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>🧭</span>
          <span>운영 중 빠른 이동</span>
        </p>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          <QuickLink
            href={`/org/${orgId}/missions/review`}
            icon="🧐"
            title="미션 검토"
            hint="참가자가 올린 제출을 확인·승인"
          />
          <QuickLink
            href={`/org/${orgId}/events/${eventId}?tab=analytics`}
            icon="📊"
            title="성과 실시간"
            hint="참여율·도토리 지급 현황"
          />
          <QuickLink
            href={`/org/${orgId}/events/${eventId}?tab=fm`}
            icon="🎙"
            title="토리FM"
            hint={`연결된 세션 ${counts.fm_session_count}개`}
          />
          <QuickLink
            href={`/org/${orgId}/missions/broadcast`}
            icon="📣"
            title="돌발 미션 보내기"
            hint="지금 참가자에게 공지·미션 발송"
          />
        </ul>
      </section>
    </div>
  );
}

function EndedNextSteps({
  orgId,
  eventId,
}: {
  orgId: string;
  eventId: string;
}) {
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-bold text-sky-800">
        <span aria-hidden>🏁</span>
        <span>행사 마무리</span>
      </p>
      <p className="mt-1 text-[11px] text-sky-800/80">
        종료된 행사예요. 성과를 확인하고 보관까지 진행해 보세요.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/org/${orgId}/events/${eventId}?tab=analytics`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700"
        >
          <span aria-hidden>📊</span>
          <span>성과 보기</span>
        </Link>
        <Link
          href={`/org/${orgId}/events/${eventId}?tab=questpacks`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] hover:bg-[#F5F1E8]"
        >
          <span aria-hidden>📚</span>
          <span>스탬프북 확인</span>
        </Link>
      </div>
      <p className="mt-3 text-[11px] text-[#6B6560]">
        상단 <span className="font-bold">🗑 보관</span> 버튼으로 보관 처리할 수
        있어요.
      </p>
    </div>
  );
}

function ArchivedNextSteps() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-bold text-zinc-700">
        <span aria-hidden>📦</span>
        <span>보관된 행사</span>
      </p>
      <p className="mt-1 text-[11px] text-[#6B6560]">
        이 행사는 보관함에 있어요. 상단{" "}
        <span className="font-bold">↩️ 보관 해제</span> 버튼으로 다시 종료
        상태로 되돌릴 수 있어요.
      </p>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  hint,
}: {
  href: string;
  icon: string;
  title: string;
  hint: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-xl border border-[#D4E4BC] bg-[#F5F1E8] p-3 transition hover:border-[#2D5A3D] hover:bg-white"
      >
        <span className="text-xl" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#2D5A3D]">{title}</p>
          <p className="truncate text-[11px] text-[#6B6560]">{hint}</p>
        </div>
        <span className="text-[#6B6560]" aria-hidden>
          →
        </span>
      </Link>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Tab panels — server components (lazy-load data only when tab is active)    */
/* -------------------------------------------------------------------------- */

async function QuestPacksTabPanel({
  orgId,
  eventId,
}: {
  orgId: string;
  eventId: string;
}) {
  const [allPacks, selectedIds] = await Promise.all([
    loadQuestPackOptionsForOrg(orgId),
    loadEventQuestPackIds(eventId),
  ]);

  // 가져오기 후보 — 이 행사에 아직 안 붙은, 미션이 들어 있는 스탬프북.
  // 빈 스탬프북을 복사하는 건 아무 도움이 안 되고, 이미 붙은 걸 또 복사하면
  // 같은 미션이 두 벌 생긴다.
  const importable = allPacks
    .filter((p) => !selectedIds.includes(p.id) && p.missionCount > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      missionCount: p.missionCount,
      usedIn: null as string | null,
    }));

  return (
    <div className="space-y-3">
      <ImportQuestPack eventId={eventId} packs={importable} />
      <QuestPacksTab
        orgId={orgId}
        eventId={eventId}
        allPacks={allPacks}
        initialSelectedIds={selectedIds}
      />
    </div>
  );
}

/**
 * 접수 탭 — 신청서 목록 + 설정.
 * 참가자 탭과 달리 계정이 아직 없는 데이터라 조회가 가볍다.
 */
async function ApplicationsTabPanel({
  orgId,
  eventId,
  enabled,
  closeAtLocal,
  capacity,
  invitationPublished,
  counts,
  defaultCloseLabel,
}: {
  orgId: string;
  eventId: string;
  enabled: boolean;
  closeAtLocal: string;
  capacity: string;
  invitationPublished: boolean;
  counts: OrgEventApplicationCounts;
  defaultCloseLabel: string | null;
}) {
  const [applications, participantPhones, consentRow] = await Promise.all([
    loadEventApplications(eventId),
    loadEventParticipantPhones(eventId),
    // 기관명도 같은 행에서 함께 온다 — 이름 때문에 한 번 더 왕복하지 않는다.
    loadOrgApplicationConsent(orgId).catch(
      (): OrgConsentContext => ({ org_name: "소속 기관" })
    ),
  ]);

  // 편집 화면에는 **치환 전 원본**을 넘긴다 — 관리자가 {기관명} 토큰을
  // 그대로 보고 고칠 수 있어야 하기 때문. 치환은 미리보기에서만 한다.
  const consent = {
    orgName: consentRow.org_name,
    body: consentRow.application_consent_body?.trim() || DEFAULT_CONSENT_BODY,
    optionalBody:
      consentRow.application_consent_optional_body?.trim() ||
      DEFAULT_CONSENT_OPTIONAL_BODY,
    optionalEnabled:
      consentRow.application_consent_optional_enabled !== false,
    updatedAt: consentRow.application_consent_updated_at ?? null,
  };

  return (
    <ApplicationsTab
      orgId={orgId}
      eventId={eventId}
      applications={applications}
      counts={counts}
      enabled={enabled}
      closeAtLocal={closeAtLocal}
      capacity={capacity}
      invitationPublished={invitationPublished}
      defaultCloseLabel={defaultCloseLabel}
      participantPhones={participantPhones}
      consent={consent}
    />
  );
}

async function ParticipantsTabPanel({
  orgId,
  eventId,
  allowSelfRegister,
  eventStatus,
}: {
  orgId: string;
  eventId: string;
  allowSelfRegister: boolean;
  eventStatus: OrgEventStatus;
}) {
  const [
    orgPool,
    selectedIds,
    orgEvents,
    partyCounts,
    eventChildren,
    eventAcorns,
  ] = await Promise.all([
    loadParticipantOptionsForOrg(orgId),
    loadEventParticipantIds(eventId),
    loadOrgEvents(orgId),
    // 접수 승인분의 아동/성인 구성 — 행별 "참석" 배지용.
    loadEventPartyCounts(eventId),
    // 이 행사에 참가하는 아동만 — 계정 전체 자녀가 아니라.
    loadEventChildrenByUser(eventId),
    // 이 행사에서 번 도토리만 — 계정 전역 누적이 아니라.
    loadEventAcornBalances(eventId),
  ]);
  // 이 행사에 연결됐지만 기관 풀에 없는 = 다른 기관 소속(cross-org) 참가자.
  const poolIds = new Set(orgPool.map((p) => p.id));
  const crossIds = selectedIds.filter((id) => !poolIds.has(id));
  const crossParticipants =
    crossIds.length > 0
      ? await loadParticipantOptionsByIds(crossIds, orgId)
      : [];
  const rawParticipants = [...orgPool, ...crossParticipants];

  // 원생명을 "이 행사에 참가하는 아동" 으로 좁힌다.
  //   app_children 은 계정 단위(사람)라, 그냥 두면 다른 기관 원생까지 우리 명단에
  //   뜬다. 지정이 없는 보호자는 기존 값(전체 자녀)을 그대로 둔다 — 명단이
  //   갑자기 빈칸이 되는 게 더 나쁘다.
  //
  // 도토리도 마찬가지 — app_users.acorn_balance 는 계정 전역 누적이라 참좋은에서
  // 모은 21개가 도원센트럴 명단에 얹혀 보였다. 이 행사에서 번 것만 센다.
  // 전역 누적은 globalAcorns 로 따로 넘겨 툴팁으로만 보여준다.
  const globalAcorns: Record<string, number> = {};
  const allParticipants = rawParticipants.map((p) => {
    globalAcorns[p.id] = p.acorn_balance;
    const picked = eventChildren[p.id];
    const next = { ...p, acorn_balance: eventAcorns[p.id] ?? 0 };
    if (!picked || picked.length === 0) return next;
    return {
      ...next,
      children_count: picked.length,
      enrolled_child_names: picked.map((c) => c.name),
      class_name: picked.find((c) => c.class_name)?.class_name ?? p.class_name,
    };
  });

  // 중복 감지 패널에서 선택할 행사 — 진행중/예정만.
  const events = orgEvents
    .filter((e) => e.status === "LIVE" || e.status === "DRAFT")
    .map((e) => ({ id: e.id, name: e.name, status: e.status }));
  return (
    <ParticipantsTab
      orgId={orgId}
      eventId={eventId}
      allParticipants={allParticipants}
      initialSelectedIds={selectedIds}
      events={events}
      allowSelfRegister={allowSelfRegister}
      eventStatus={eventStatus}
      partyCounts={partyCounts}
      globalAcorns={globalAcorns}
    />
  );
}

async function ProgramsTabPanel({
  orgId,
  eventId,
}: {
  orgId: string;
  eventId: string;
}) {
  const [allPrograms, selectedIds] = await Promise.all([
    loadProgramOptionsForOrg(orgId),
    loadEventProgramIds(eventId),
  ]);
  return (
    <ProgramsTab
      orgId={orgId}
      eventId={eventId}
      allPrograms={allPrograms}
      initialSelectedIds={selectedIds}
    />
  );
}

async function TrailsTabPanel({
  orgId,
  eventId,
}: {
  orgId: string;
  eventId: string;
}) {
  const [allTrails, selectedIds] = await Promise.all([
    loadTrailOptionsForOrg(orgId),
    loadEventTrailIds(eventId),
  ]);
  return (
    <TrailsTab
      orgId={orgId}
      eventId={eventId}
      allTrails={allTrails}
      initialSelectedIds={selectedIds}
    />
  );
}

async function FmSessionsTabPanel({
  orgId,
  eventId,
}: {
  orgId: string;
  eventId: string;
}) {
  const { linked, unlinked } = await loadFmSessionsForFmTab(orgId, eventId);
  return (
    <FmSessionsTab
      orgId={orgId}
      eventId={eventId}
      linkedSessions={linked}
      unlinkedSessions={unlinked}
    />
  );
}

/**
 * 기관의 모든 스탬프북 + 각 스탬프북의 미션 개수.
 * 2-step: org_quest_packs 전체 → 해당 pack_ids 로 org_missions count.
 */
async function loadQuestPackOptionsForOrg(
  orgId: string
): Promise<QuestPackOption[]> {
  if (!orgId) return [];
  const supabase = await createClient();

  type PackRow = {
    id: string;
    name: string;
    description: string | null;
    status: "DRAFT" | "LIVE" | "ENDED" | "ARCHIVED";
    starts_at: string | null;
    ends_at: string | null;
    cover_image_url: string | null;
  };

  const packsResp = (await (
    supabase.from("org_quest_packs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: PackRow[] | null; error: unknown }>;
        };
      };
    }
  )
    .select(
      "id, name, description, status, starts_at, ends_at, cover_image_url"
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })) as {
    data: PackRow[] | null;
    error: unknown;
  };

  if (packsResp.error) {
    console.error(
      "[events/loadQuestPackOptionsForOrg] packs error",
      packsResp.error
    );
    return [];
  }
  const packs = packsResp.data ?? [];
  if (packs.length === 0) return [];

  const packIds = packs.map((p) => p.id);
  const missionsResp = (await (
    supabase.from("org_missions" as never) as unknown as {
      select: (c: string) => {
        in: (
          k: string,
          v: string[]
        ) => Promise<{
          data: Array<{ quest_pack_id: string | null }> | null;
          error: unknown;
        }>;
      };
    }
  )
    .select("quest_pack_id")
    .in("quest_pack_id", packIds)) as {
    data: Array<{ quest_pack_id: string | null }> | null;
    error: unknown;
  };

  const counts = new Map<string, number>();
  for (const m of missionsResp.data ?? []) {
    if (!m.quest_pack_id) continue;
    counts.set(m.quest_pack_id, (counts.get(m.quest_pack_id) ?? 0) + 1);
  }

  return packs.map<QuestPackOption>((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    starts_at: p.starts_at,
    ends_at: p.ends_at,
    cover_image_url: p.cover_image_url,
    missionCount: counts.get(p.id) ?? 0,
  }));
}

/**
 * 기관의 활성 프로그램 — programs 탭용. ARCHIVED 제외.
 */
async function loadProgramOptionsForOrg(
  orgId: string
): Promise<ProgramOption[]> {
  if (!orgId) return [];
  const supabase = await createClient();

  type Row = {
    id: string;
    title: string;
    category: string;
    description: string | null;
    status: "ACTIVATED" | "CUSTOMIZED" | "PUBLISHED" | "PAUSED" | "ARCHIVED";
    price_per_person: number;
    duration_hours: number | null;
    image_url: string | null;
  };

  const resp = (await (
    supabase.from("org_programs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: Row[] | null; error: unknown }>;
        };
      };
    }
  )
    .select(
      "id, title, category, description, status, price_per_person, duration_hours, image_url"
    )
    .eq("org_id", orgId)
    .order("activated_at", { ascending: false })) as {
    data: Row[] | null;
    error: unknown;
  };

  if (resp.error) {
    console.error(
      "[events/loadProgramOptionsForOrg] error",
      resp.error
    );
    return [];
  }
  // ARCHIVED 는 연결 대상에서 숨김 (목록에 나오지 않게).
  return (resp.data ?? [])
    .filter((r) => r.status !== "ARCHIVED")
    .map<ProgramOption>((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      description: r.description,
      status: r.status as ProgramOption["status"],
      price_per_person: r.price_per_person,
      duration_hours: r.duration_hours,
      image_url: r.image_url,
    }));
}

/**
 * 기관에 배포된 숲길 — trails 탭용. trails/queries 에서 공용 로더 재사용.
 */
async function loadTrailOptionsForOrg(orgId: string): Promise<TrailOption[]> {
  if (!orgId) return [];
  const trails = await loadTrailsAssignedToOrg(orgId);
  return trails.map<TrailOption>((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    difficulty: t.difficulty,
    estimated_minutes: t.estimated_minutes,
    total_slots: t.total_slots,
    cover_image_url: t.cover_image_url,
    slug: t.slug ?? null,
  }));
}

/**
 * 이 기관의 FM 세션 — 현재 이 행사에 연결된 것 + 어떤 행사에도 연결되지 않은 것만.
 * 다른 행사에 이미 붙어있는 세션은 숨긴다 (1:N 이므로 빼앗기 방지).
 */
async function loadFmSessionsForFmTab(
  orgId: string,
  eventId: string
): Promise<{ linked: FmSessionOption[]; unlinked: FmSessionOption[] }> {
  if (!orgId || !eventId) return { linked: [], unlinked: [] };
  const supabase = await createClient();

  type Row = {
    id: string;
    name: string | null;
    is_live: boolean;
    scheduled_start: string;
    scheduled_end: string;
    event_id: string | null;
  };

  const resp = (await (
    supabase.from("tori_fm_sessions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          or: (filter: string) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<{ data: Row[] | null; error: unknown }>;
          };
        };
      };
    }
  )
    .select("id, name, is_live, scheduled_start, scheduled_end, event_id")
    .eq("org_id", orgId)
    .or(`event_id.is.null,event_id.eq.${eventId}`)
    .order("scheduled_start", { ascending: false })) as {
    data: Row[] | null;
    error: unknown;
  };

  if (resp.error) {
    console.error("[events/loadFmSessionsForFmTab] error", resp.error);
    return { linked: [], unlinked: [] };
  }
  const rows = (resp.data ?? []).map<FmSessionOption>((r) => ({
    id: r.id,
    title: r.name,
    is_live: r.is_live,
    scheduled_start: r.scheduled_start,
    scheduled_end: r.scheduled_end,
    event_id: r.event_id,
  }));
  return {
    linked: rows.filter((r) => r.event_id === eventId),
    unlinked: rows.filter((r) => r.event_id === null),
  };
}

/**
 * 아직 화면이 없는 하위탭 자리.
 *
 * 예전 Phase2Placeholder 는 탭마다 다른 문구를 들고 있었는데, 정작 그 탭들은
 * 전부 실제 화면이 생겨 한 번도 쓰이지 않는 죽은 표였다. 지금은 새로 추가한
 * 단계(초대장 내용·설문 등) 중 아직 안 만든 것만 여기로 온다.
 */
function StepComingSoon({ step, sub }: { step: StepKey; sub: string }) {
  const meta = stepOf(step);
  const label = meta.subs.find((s) => s.key === sub)?.label ?? meta.label;
  return (
    <section className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white/70 p-10 text-center">
      <p className="text-3xl" aria-hidden>
        {meta.icon}
      </p>
      <p className="mt-2 text-sm font-bold text-[#2D5A3D]">
        {label} — 준비 중이에요
      </p>
    </section>
  );
}

function DangerZone({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  return (
    <section
      aria-label="위험 영역"
      className="rounded-2xl border-2 border-rose-200 bg-rose-50/60 p-5 shadow-sm"
    >
      <h2 className="flex items-center gap-2 text-sm font-bold text-rose-800">
        <span aria-hidden>⚠️</span>
        <span>위험 영역</span>
      </h2>
      <p className="mt-1 text-xs text-rose-700/80">
        행사를 삭제하면 연결된 스탬프북·참가자·세션 관계가 모두 풀려요.
        되돌릴 수 없으니 신중하게 진행하세요.
      </p>
      <form
        action={async () => {
          "use server";
          await deleteOrgEventAction(eventId);
        }}
        className="mt-3"
      >
        <input type="hidden" name="_event_name" value={eventName} />
        <DeleteEventButton eventName={eventName} />
      </form>
    </section>
  );
}
