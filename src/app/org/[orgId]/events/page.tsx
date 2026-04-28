import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgEventSummaries } from "@/lib/org-events/queries";
import {
  type OrgEventStatus,
  type OrgEventSummaryRow,
} from "@/lib/org-events/types";
import { EventStatusToggle } from "./status-toggle";

export const dynamic = "force-dynamic";

type StatusFilter = "ALL" | OrgEventStatus;

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "DRAFT", label: "예정" },
  { key: "LIVE", label: "진행중" },
  { key: "ENDED", label: "종료" },
  { key: "ARCHIVED", label: "보관" },
];

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** "2026.05.16(토)" — 날짜 + 요일 한글 약어 */
function fmtDateWeekday(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}(${WEEKDAY[d.getDay()]})`;
}

/** "10:00" — 자정(0:00)은 시간 미지정으로 간주해 빈 문자열 */
function fmtClock(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  const m = d.getMinutes();
  if (h === 0 && m === 0) return "";
  return `${pad2(h)}:${pad2(m)}`;
}

/** "3시간" / "1시간 30분" / "2일 3시간" 식 사람-친화 라벨 */
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
    starts && ends ? fmtDurationFromMs(new Date(ends).getTime() - new Date(starts).getTime()) : "";
  const durSuffix = dur ? ` (${dur})` : "";

  // 시간 미지정 (둘 다 자정 또는 시간 정보 없음) → 날짜만
  if (!sClock && !eClock) {
    return `${sLabel} ~ ${eLabel}`;
  }

  // 같은 날 + 시간
  if (sameDay) {
    return `${sLabel} ${sClock}${sClock && eClock ? " ~ " : ""}${eClock}${durSuffix}`;
  }

  // 다른 날 + 시간
  return `${sLabel}${sClock ? ` ${sClock}` : ""} ~ ${eLabel}${eClock ? ` ${eClock}` : ""}${durSuffix}`;
}

export default async function OrgEventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ status?: string; focus?: string }>;
}) {
  const { orgId } = await params;
  // layout.tsx 에서 이미 orgId 매칭 검증됨. 세션만 확보.
  await requireOrg();

  const sp = await searchParams;
  const statusFilter: StatusFilter =
    sp.status === "DRAFT" ||
    sp.status === "LIVE" ||
    sp.status === "ENDED" ||
    sp.status === "ARCHIVED"
      ? sp.status
      : "ALL";
  const focusTimeline = sp.focus === "timeline";

  const all = await loadOrgEventSummaries(orgId);

  const list = all.filter((e) => {
    if (statusFilter !== "ALL" && e.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관 홈
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">행사</span>
      </nav>

      {/* Header */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#4A7C59] to-[#2D5A3D] p-6 text-white shadow-sm md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#D4E4BC]">
              Org · Events
            </p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold md:text-3xl">
              <span aria-hidden>🎪</span>
              <span>내 행사 관리</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[#E8F0E4]">
              캠프·체험·축제 같은 행사를 만들어 스탬프북·참가자·토리FM을 한
              곳에 묶어 운영하세요.
            </p>
            <p className="mt-1 max-w-xl text-[11px] text-[#D4E4BC]">
              💡 참가자는 <b className="text-white">행사별로 따로</b> 등록해요.
              아래 행사 카드의{" "}
              <span className="font-bold text-emerald-200">🙋 참가자 등록</span>{" "}
              버튼을 눌러 해당 행사의 참가자를 추가하세요.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/org/${orgId}/events/new`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#2D5A3D] shadow-sm transition hover:bg-[#F5F1E8]"
            >
              <span aria-hidden>➕</span>
              <span>새 행사</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 타임테이블 편집 모드 — 안내 배너 */}
      {focusTimeline && (
        <section
          className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 shadow-sm"
          role="status"
        >
          <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <span aria-hidden>📅</span>
            <span>타임테이블을 편집할 행사를 선택해 주세요</span>
          </p>
          <p className="mt-1 text-[12px] text-amber-800">
            아래 행사 카드에서 <span className="font-bold">📅 타임테이블</span>
            {" "}버튼을 클릭하면 슬롯 추가 화면으로 바로 이동해요.
          </p>
        </section>
      )}

      {/* Status tab filters */}
      <section aria-label="상태 필터" className="space-y-2">
        <p className="text-[11px] font-semibold text-[#6B6560]">상태</p>
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => {
            const isActive = tab.key === statusFilter;
            const count =
              tab.key === "ALL"
                ? all.length
                : all.filter((e) => e.status === tab.key).length;
            const href =
              tab.key === "ALL"
                ? `/org/${orgId}/events`
                : `/org/${orgId}/events?status=${tab.key}`;
            return (
              <Link
                key={tab.key}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                    : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-[#2D5A3D] hover:text-[#2D5A3D]"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    isActive ? "bg-white/20" : "bg-[#F5F1E8]"
                  }`}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* List */}
      {list.length === 0 ? (
        <EmptyState
          hasAny={all.length > 0}
          orgId={orgId}
          filtered={statusFilter !== "ALL"}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => (
            <EventCard
              key={e.event_id}
              event={e}
              orgId={orgId}
              highlightTimeline={focusTimeline}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EventCard({
  event,
  orgId,
  highlightTimeline = false,
}: {
  event: OrgEventSummaryRow;
  orgId: string;
  /** 타임테이블 편집 진입점에서 왔을 때 — 타임테이블 버튼 강조 */
  highlightTimeline?: boolean;
}) {
  const isLive = event.status === "LIVE";
  return (
    <li
      className={`relative overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-md ${
        isLive
          ? "border-2 border-emerald-500 shadow-emerald-100 ring-2 ring-emerald-300/40 hover:border-emerald-600"
          : "border border-[#D4E4BC] hover:border-[#2D5A3D]"
      }`}
    >
      {/* LIVE 강조 뱃지 — 사진 하단 중앙 (커버-본문 경계 위에 걸침) */}
      {isLive && (
        <div className="pointer-events-none absolute inset-x-0 top-44 z-20 flex -translate-y-1/2 justify-center">
          <span className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold text-white shadow-md ring-2 ring-white">
            <span className="relative inline-flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            <span>🟢 진행중</span>
          </span>
        </div>
      )}

      {/* 커버 — 사진 또는 그라디언트 + 제목·기간 오버레이 */}
      <div
        className={`relative flex h-44 w-full items-end justify-end overflow-hidden ${
          isLive
            ? "bg-gradient-to-br from-emerald-100 via-[#D4E4BC] to-emerald-200"
            : "bg-gradient-to-br from-[#FAE7D0] to-[#E8F0E4]"
        }`}
      >
        {/* 사진 — 있을 때만 absolute 로 fill */}
        {event.cover_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.cover_image_url}
            alt=""
            aria-hidden
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        {/* 사진 위 어둡게 그라디언트 오버레이 — 텍스트 가독성 */}
        {event.cover_image_url && (
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/15 to-black/40"
          />
        )}

        {/* 좌측 상단 — 제목 + 기간 + 시간 */}
        <div className="absolute left-4 right-4 top-3 z-[1] max-w-[80%] space-y-1">
          <h3
            className={`text-lg font-extrabold leading-snug drop-shadow-md ${
              event.cover_image_url
                ? "text-white"
                : isLive
                  ? "text-emerald-950"
                  : "text-[#2C2C2C]"
            }`}
          >
            {event.name || "(이름 없음)"}
          </h3>
          <p
            className={`flex items-center gap-1 text-[11px] font-semibold drop-shadow-sm ${
              event.cover_image_url
                ? "text-white/95"
                : isLive
                  ? "text-emerald-900/80"
                  : "text-[#6B4423]"
            }`}
          >
            <span aria-hidden>📅</span>
            <span>{fmtRange(event.starts_at, event.ends_at)}</span>
          </p>
        </div>

        {/* 우측 하단 — 텐트 그래픽 (커버 사진 없을 때만) */}
        {!event.cover_image_url && (
          <span
            aria-hidden
            className="relative z-[1] mb-2 mr-3 text-6xl drop-shadow-sm opacity-90"
          >
            🎪
          </span>
        )}
      </div>

      <div className="space-y-3 p-5">
        {/* 상태 토글 — 진행중 / 예정 / 종료 / 보관 즉시 전환 */}
        <EventStatusToggle
          eventId={event.event_id}
          initialStatus={event.status}
        />

        {/* 리소스 카운트 칩 */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <CountChip icon="🎯" label={`${event.quest_pack_count}개 스탬프북`} />
          <CountChip icon="🙋" label={`${event.participant_count}명`} />
          <CountChip icon="🎙" label={`${event.fm_session_count} 세션`} />
          {event.program_count > 0 && (
            <CountChip icon="🗂" label={`${event.program_count} 프로그램`} />
          )}
          {event.trail_count > 0 && (
            <CountChip icon="🗺" label={`${event.trail_count} 숲길`} />
          )}
        </div>

        <div className="mt-2 space-y-2 pt-2">
          {/* Primary CTA — 카드 가로 100% */}
          <Link
            href={`/org/${orgId}/events/${event.event_id}`}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:from-[#234a30] hover:to-[#2D5A3D]"
          >
            <span aria-hidden className="text-base">🎬</span>
            <span>행사 진행 관리</span>
            <span aria-hidden className="text-base">›</span>
          </Link>
          {/* 참가자 등록 — 부각된 secondary CTA (이 행사에 직접 등록) */}
          <Link
            href={`/org/${orgId}/events/${event.event_id}?tab=participants`}
            className="flex w-full items-center justify-between gap-1.5 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-100"
            aria-label={`${event.name} 참가자 등록`}
          >
            <span className="flex items-center gap-1.5">
              <span aria-hidden>🙋</span>
              <span>참가자 등록</span>
              <span className="rounded-full bg-emerald-600/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                현재 {event.participant_count.toLocaleString("ko-KR")}명
              </span>
            </span>
            <span aria-hidden className="text-base">›</span>
          </Link>
          {/* 보조 액션 — 작은 버튼 */}
          <div className="flex gap-2">
            <Link
              href={`/org/${orgId}/events/${event.event_id}?tab=timeline`}
              className={`inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${
                highlightTimeline
                  ? "border-2 border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200"
                  : "border border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#F5F1E8]"
              }`}
              aria-label={`${event.name} 타임테이블 편집`}
              title="타임테이블 편집"
            >
              <span aria-hidden>📅</span>
              <span>타임테이블</span>
            </Link>
            <Link
              href={`/org/${orgId}/events/${event.event_id}/edit`}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#D4E4BC] bg-white px-2 py-1.5 text-[11px] font-semibold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
              aria-label={`${event.name} 편집`}
              title="행사 정보 수정"
            >
              <span aria-hidden>✏️</span>
              <span>정보 수정</span>
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}

function CountChip({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </span>
  );
}

function EmptyState({
  hasAny,
  orgId,
  filtered,
}: {
  hasAny: boolean;
  orgId: string;
  filtered: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
      <div className="text-5xl" aria-hidden>
        {hasAny && filtered ? "🔍" : "🌱"}
      </div>
      <p className="mt-3 text-base font-bold text-[#2D5A3D]">
        {hasAny && filtered
          ? "조건에 맞는 행사가 없어요"
          : "아직 진행 중인 행사가 없어요"}
      </p>
      <p className="mt-1 max-w-sm text-xs text-[#6B6560]">
        {hasAny && filtered
          ? "다른 상태를 선택해 보세요."
          : "행사를 만들어 스탬프북과 참가자를 한 곳에 모아보세요."}
      </p>
      {!(hasAny && filtered) && (
        <Link
          href={`/org/${orgId}/events/new`}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#234a30]"
        >
          <span aria-hidden>➕</span>
          <span>첫 행사 만들기</span>
        </Link>
      )}
    </div>
  );
}
