import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  loadOrgEventById,
  loadOrgEventSummaryById,
  loadEventQuestPackIds,
  loadEventProgramIds,
  loadEventTrailIds,
} from "@/lib/org-events/queries";
import {
  ORG_EVENT_STATUS_META,
  type OrgEventStatus,
} from "@/lib/org-events/types";
import {
  updateOrgEventStatusAction,
  deleteOrgEventAction,
} from "@/lib/org-events/actions";
import { loadTrailsAssignedToOrg } from "@/lib/trails/queries";
import { DeleteEventButton } from "./delete-button";
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
import { InviteLinkCopy } from "./invite-link-copy";

export const dynamic = "force-dynamic";

type TabKey =
  | "overview"
  | "questpacks"
  | "fm"
  | "programs"
  | "trails"
  | "analytics";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "overview", label: "개요", icon: "📋" },
  { key: "questpacks", label: "스탬프북", icon: "📚" },
  { key: "fm", label: "토리FM", icon: "🎙" },
  { key: "programs", label: "프로그램", icon: "🗂" },
  { key: "trails", label: "숲길", icon: "🗺" },
  { key: "analytics", label: "성과", icon: "📊" },
];

function parseTab(v: string | undefined): TabKey {
  if (
    v === "questpacks" ||
    v === "fm" ||
    v === "programs" ||
    v === "trails" ||
    v === "analytics"
  )
    return v;
  return "overview";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtRange(starts: string | null, ends: string | null): string {
  if (!starts && !ends) return "기간 미정";
  return `${fmtDate(starts)} ~ ${fmtDate(ends)}`;
}

export default async function OrgEventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
  searchParams: Promise<{ tab?: string; saved?: string }>;
}) {
  const { orgId, eventId } = await params;
  const sp = await searchParams;
  await requireOrg();

  const event = await loadOrgEventById(eventId);
  if (!event || event.org_id !== orgId) {
    notFound();
  }

  const tab = parseTab(sp.tab);
  const saved = sp.saved === "1";

  // 개요 탭에서만 카운트 표시 — view_org_event_summary 에서 단건 조회
  const summary = await loadOrgEventSummaryById(eventId);

  const statusMeta = ORG_EVENT_STATUS_META[event.status];
  const isLive = event.status === "LIVE";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관 홈
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/org/${orgId}/events`}
          className="hover:text-[#2D5A3D]"
        >
          행사
        </Link>
        <span className="mx-2">/</span>
        <span className="truncate font-semibold text-[#2D5A3D]">
          {event.name}
        </span>
      </nav>

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
                  {isLive ? "🟢 진행중" : statusMeta.label}
                </span>
                <span className="text-[11px] text-[#6B6560]">
                  📅 {fmtRange(event.starts_at, event.ends_at)}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold text-[#2D5A3D] md:text-3xl">
                {event.name}
              </h1>
              {event.description && (
                <p className="mt-2 max-w-2xl text-sm text-[#6B6560]">
                  {event.description}
                </p>
              )}
            </div>

            {/* Right CTA group */}
            <div className="flex flex-wrap items-center gap-2">
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
              <StatusTransitionButtons
                eventId={eventId}
                status={event.status}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Tab bar */}
      <nav
        aria-label="행사 섹션 탭"
        className="overflow-x-auto rounded-2xl border border-[#D4E4BC] bg-white p-1 shadow-sm"
      >
        <ul className="flex min-w-max gap-1">
          {TABS.map((t) => {
            const active = t.key === tab;
            const href =
              t.key === "overview"
                ? `/org/${orgId}/events/${eventId}`
                : `/org/${orgId}/events/${eventId}?tab=${t.key}`;
            return (
              <li key={t.key}>
                <Link
                  href={href}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    active
                      ? "bg-[#2D5A3D] text-white shadow-sm"
                      : "text-[#6B6560] hover:bg-[#F5F1E8] hover:text-[#2D5A3D]"
                  }`}
                >
                  <span aria-hidden>{t.icon}</span>
                  <span>{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Tab panel */}
      <section>
        {tab === "overview" ? (
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
        ) : tab === "questpacks" ? (
          <QuestPacksTabPanel orgId={orgId} eventId={eventId} />
        ) : tab === "programs" ? (
          <ProgramsTabPanel orgId={orgId} eventId={eventId} />
        ) : tab === "trails" ? (
          <TrailsTabPanel orgId={orgId} eventId={eventId} />
        ) : tab === "fm" ? (
          <FmSessionsTabPanel orgId={orgId} eventId={eventId} />
        ) : tab === "analytics" ? (
          <AnalyticsTabPanel orgId={orgId} eventId={eventId} />
        ) : (
          <Phase2Placeholder tab={tab} />
        )}
      </section>

      {/* 위험 영역 */}
      <DangerZone eventId={eventId} eventName={event.name} />
    </div>
  );
}

function StatusTransitionButtons({
  eventId,
  status,
}: {
  eventId: string;
  status: OrgEventStatus;
}) {
  if (status === "DRAFT") {
    return (
      <form
        action={async () => {
          "use server";
          await updateOrgEventStatusAction(eventId, "LIVE");
        }}
      >
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
        >
          <span aria-hidden>🚀</span>
          <span>시작</span>
        </button>
      </form>
    );
  }
  if (status === "LIVE") {
    return (
      <form
        action={async () => {
          "use server";
          await updateOrgEventStatusAction(eventId, "ENDED");
        }}
      >
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700"
        >
          <span aria-hidden>🛑</span>
          <span>종료</span>
        </button>
      </form>
    );
  }
  if (status === "ENDED") {
    return (
      <form
        action={async () => {
          "use server";
          await updateOrgEventStatusAction(eventId, "ARCHIVED");
        }}
      >
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-zinc-700"
        >
          <span aria-hidden>🗑</span>
          <span>보관</span>
        </button>
      </form>
    );
  }
  // ARCHIVED — 되돌리기
  return (
    <form
      action={async () => {
        "use server";
        await updateOrgEventStatusAction(eventId, "ENDED");
      }}
    >
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-3.5 py-2 text-xs font-bold text-[#2D5A3D] hover:bg-[#F5F1E8]"
      >
        <span aria-hidden>↩️</span>
        <span>보관 해제</span>
      </button>
    </form>
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
    tab: TabKey;
  }> = [
    {
      icon: "📚",
      label: "스탬프북",
      value: counts.quest_pack_count,
      tab: "questpacks",
    },
    { icon: "🎙", label: "토리FM 세션", value: counts.fm_session_count, tab: "fm" },
    { icon: "🗂", label: "프로그램", value: counts.program_count, tab: "programs" },
    { icon: "🗺", label: "숲길", value: counts.trail_count, tab: "trails" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {items.map((it) => (
          <Link
            key={it.tab}
            href={`/org/${orgId}/events/${eventId}?tab=${it.tab}`}
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm transition hover:border-[#2D5A3D] hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-[#6B6560]">
                {it.label}
              </p>
              <span className="text-2xl" aria-hidden>
                {it.icon}
              </span>
            </div>
            <p className="mt-1 text-2xl font-extrabold text-[#2D5A3D]">
              {it.value.toLocaleString("ko-KR")}
            </p>
          </Link>
        ))}
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
      cta: { label: "스탬프북 탭으로", tab: "questpacks" as TabKey },
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
      cta: null as null | { label: string; tab?: TabKey; href?: string },
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
            {!c.done && c.cta && (
              <Link
                href={
                  c.cta.href ??
                  `/org/${orgId}/events/${eventId}?tab=${c.cta.tab}`
                }
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
      <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
          <span aria-hidden>🔗</span>
          <span>참가자 초대 링크</span>
        </p>
        <p className="mt-1 text-[11px] text-emerald-800/80">
          이 링크를 카카오톡·문자로 공유하세요.
        </p>
        <div className="mt-3">
          <InviteLinkCopy eventId={eventId} eventName={eventName} />
        </div>
      </section>

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
  return (
    <QuestPacksTab
      orgId={orgId}
      eventId={eventId}
      allPacks={allPacks}
      initialSelectedIds={selectedIds}
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

function Phase2Placeholder({ tab }: { tab: TabKey }) {
  const meta: Record<
    Exclude<TabKey, "overview">,
    { icon: string; title: string; empty: string }
  > = {
    questpacks: {
      icon: "📚",
      title: "스탬프북",
      empty: "아직 연결된 스탬프북이 없어요.",
    },
    fm: {
      icon: "🎙",
      title: "토리FM",
      empty: "아직 예약된 라이브가 없어요.",
    },
    programs: {
      icon: "🗂",
      title: "프로그램",
      empty: "아직 연결된 프로그램이 없어요.",
    },
    trails: {
      icon: "🗺",
      title: "숲길",
      empty: "아직 연결된 숲길이 없어요.",
    },
    analytics: {
      icon: "📊",
      title: "성과",
      empty: "아직 집계할 데이터가 없어요.",
    },
  };
  const m = meta[tab as Exclude<TabKey, "overview">];
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
      <div className="text-5xl" aria-hidden>
        {m.icon}
      </div>
      <p className="mt-3 text-base font-bold text-[#2D5A3D]">{m.title}</p>
      <p className="mt-1 text-xs text-[#6B6560]">{m.empty}</p>
      <p className="mt-3 rounded-full bg-[#F5F1E8] px-3 py-1 text-[10px] font-semibold text-[#8B6F47]">
        🚧 Phase 2 에서 구현 예정
      </p>
    </div>
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
