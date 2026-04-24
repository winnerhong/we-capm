import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgEventSummaries } from "@/lib/org-events/queries";
import {
  ORG_EVENT_STATUS_META,
  type OrgEventStatus,
  type OrgEventSummaryRow,
} from "@/lib/org-events/types";

export const dynamic = "force-dynamic";

type StatusFilter = "ALL" | OrgEventStatus;

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "LIVE", label: "진행중" },
  { key: "DRAFT", label: "예정" },
  { key: "ENDED", label: "종료" },
  { key: "ARCHIVED", label: "보관" },
];

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

export default async function OrgEventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ status?: string }>;
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
              <span>우리 기관 행사</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[#E8F0E4]">
              캠프·체험·축제 같은 행사를 만들어 스탬프북·참가자·토리FM을 한
              곳에 묶어 운영하세요.
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
            <EventCard key={e.event_id} event={e} orgId={orgId} />
          ))}
        </ul>
      )}
    </div>
  );
}

function EventCard({
  event,
  orgId,
}: {
  event: OrgEventSummaryRow;
  orgId: string;
}) {
  const statusMeta = ORG_EVENT_STATUS_META[event.status];
  const isLive = event.status === "LIVE";
  return (
    <li
      className={`relative overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-md ${
        isLive
          ? "border-2 border-emerald-500 shadow-emerald-100 ring-2 ring-emerald-300/40 hover:border-emerald-600"
          : "border border-[#D4E4BC] hover:border-[#2D5A3D]"
      }`}
    >
      {/* LIVE 강조 뱃지 */}
      {isLive && (
        <div className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-md ring-2 ring-white">
          <span className="relative inline-flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          <span>🟢 진행중</span>
        </div>
      )}

      {/* 커버 / 플레이스홀더 */}
      <div
        className={`flex h-28 w-full items-center justify-center ${
          isLive
            ? "bg-gradient-to-br from-emerald-100 via-[#D4E4BC] to-emerald-200"
            : "bg-gradient-to-br from-[#FAE7D0] to-[#E8F0E4]"
        }`}
        aria-hidden
      >
        <span className="text-5xl">🎪</span>
      </div>

      <div className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              isLive
                ? "border-emerald-500 bg-emerald-500 text-white"
                : statusMeta.color
            }`}
          >
            {isLive ? "🟢 진행중" : statusMeta.label}
          </span>
        </div>
        <h3
          className={`truncate text-base font-bold ${
            isLive ? "text-emerald-900" : "text-[#2C2C2C]"
          }`}
        >
          {event.name || "(이름 없음)"}
        </h3>
        <p className="text-[11px] text-[#6B6560]">
          📅 {fmtRange(event.starts_at, event.ends_at)}
        </p>

        {/* 리소스 카운트 칩 */}
        <div className="flex flex-wrap gap-1 pt-1">
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

        <div className="mt-1 flex gap-2 pt-2">
          <Link
            href={`/org/${orgId}/events/${event.event_id}`}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#234a30]"
          >
            <span aria-hidden>👀</span>
            <span>상세보기</span>
          </Link>
          <Link
            href={`/org/${orgId}/events/${event.event_id}/edit`}
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
            aria-label={`${event.name} 편집`}
          >
            <span aria-hidden>✏️</span>
          </Link>
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
