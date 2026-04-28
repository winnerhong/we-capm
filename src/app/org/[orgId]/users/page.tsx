import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { QuickAddUser } from "./quick-add-user";
import { UsersTable } from "./users-table";
import {
  loadEventParticipantIds,
  loadOrgEventSummaries,
} from "@/lib/org-events/queries";
import { createSingleEventParticipantAction } from "../events/[eventId]/users/actions";

export const dynamic = "force-dynamic";

type UserStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";
type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT";

type AppUserListRow = {
  id: string;
  phone: string;
  parent_name: string;
  org_id: string;
  acorn_balance: number;
  status: UserStatus;
  last_login_at: string | null;
  created_at: string;
  attendance_status: AttendanceStatus | null;
  attendance_date: string | null;
};

type AppUserWithCount = AppUserListRow & {
  children_count: number;
  enrolled_names: string[];
};

const STATUS_META: Record<
  UserStatus,
  { label: string; chip: string }
> = {
  ACTIVE: {
    label: "활성화",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  SUSPENDED: {
    label: "비활성화",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
  },
  CLOSED: {
    label: "해지",
    chip: "bg-zinc-100 text-zinc-600 border-zinc-200",
  },
};

function formatPhone(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "-";
  }
}

/* ─────────── 행사 hero 용 일정 포맷 헬퍼 (events/page.tsx 와 동일 톤) ─────────── */
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function fmtDateWeekday(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}(${WEEKDAY[d.getDay()]})`;
}

function fmtClock(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  const m = d.getMinutes();
  if (h === 0 && m === 0) return "";
  return `${pad2(h)}:${pad2(m)}`;
}

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

function fmtEventRange(starts: string | null, ends: string | null): string {
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
  if (!sClock && !eClock) return `${sLabel} ~ ${eLabel}`;
  if (sameDay) {
    return `${sLabel} ${sClock}${sClock && eClock ? " ~ " : ""}${eClock}${durSuffix}`;
  }
  return `${sLabel}${sClock ? ` ${sClock}` : ""} ~ ${eLabel}${eClock ? ` ${eClock}` : ""}${durSuffix}`;
}


async function loadUsers(orgId: string): Promise<AppUserWithCount[]> {
  const supabase = await createClient();

  const { data: users } = await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: AppUserListRow[] | null }>;
        };
      };
    }
  )
    .select(
      "id, phone, parent_name, org_id, acorn_balance, status, last_login_at, created_at, attendance_status, attendance_date"
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const rows: AppUserListRow[] = (users ?? []) as AppUserListRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  const { data: children } = await (
    supabase.from("app_children" as never) as unknown as {
      select: (c: string) => {
        in: (
          k: string,
          v: string[]
        ) => Promise<{
          data: Array<{
            user_id: string;
            name: string;
            is_enrolled: boolean;
          }> | null;
        }>;
      };
    }
  )
    .select("user_id, name, is_enrolled")
    .in("user_id", ids);

  const countByUser = new Map<string, number>();
  const enrolledByUser = new Map<string, string[]>();
  for (const c of children ?? []) {
    countByUser.set(c.user_id, (countByUser.get(c.user_id) ?? 0) + 1);
    if (c.is_enrolled) {
      const list = enrolledByUser.get(c.user_id) ?? [];
      list.push(c.name);
      enrolledByUser.set(c.user_id, list);
    }
  }

  return rows.map((r) => ({
    ...r,
    children_count: countByUser.get(r.id) ?? 0,
    enrolled_names: enrolledByUser.get(r.id) ?? [],
  }));
}

export default async function OrgUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ q?: string; imported?: string; event?: string }>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  const org = await requireOrg();

  // 1) 기관 전체 참가자 + 행사 목록 동시 로드
  const [allUsers, events] = await Promise.all([
    loadUsers(orgId),
    loadOrgEventSummaries(orgId),
  ]);

  // 2) 행사 필터 — ?event={id} 가 유효한 이 기관 행사인지 검증
  const requestedEventId = (sp.event ?? "").trim();
  const selectedEvent =
    requestedEventId && events.find((e) => e.event_id === requestedEventId)
      ? events.find((e) => e.event_id === requestedEventId) ?? null
      : null;

  // 3) 행사 선택 시 — 그 행사 참가자 user_id 집합으로 좁히기
  const eventUserIdSet = selectedEvent
    ? new Set(await loadEventParticipantIds(selectedEvent.event_id))
    : null;

  const all = eventUserIdSet
    ? allUsers.filter((u) => eventUserIdSet.has(u.id))
    : allUsers;

  // 4) 텍스트 검색
  const q = (sp.q ?? "").trim().toLowerCase();
  const filtered = q
    ? all.filter((r) => {
        const hay =
          `${r.enrolled_names.join(" ")} ${r.parent_name} ${r.phone}`.toLowerCase();
        return hay.includes(q);
      })
    : all;

  const total = all.length;
  const todayIso = todayIsoDate();
  const importedCount = Number(sp.imported ?? "");

  // 검색 폼 / 필터에서 event 파라미터를 유지하기 위한 헬퍼
  const eventQs = selectedEvent ? `?event=${selectedEvent.event_id}` : "";
  const baseHref = `/org/${orgId}/users`;

  return (
    <div
      className={`min-h-dvh ${
        selectedEvent ? "bg-emerald-50/30" : ""
      }`}
    >
      {/* Sticky 컨텍스트 바 — 행사 모드일 때만, 스크롤해도 항상 보임 */}
      {selectedEvent && (
        <div
          role="status"
          className="sticky top-[64px] z-30 border-b-2 border-emerald-500/40 bg-gradient-to-r from-emerald-600 via-[#2D5A3D] to-emerald-600 text-white shadow-md"
        >
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-xs font-semibold">
            <span aria-hidden>📍</span>
            <span className="truncate">
              <b>{selectedEvent.name || "(이름 없음)"}</b> 참가자만 보는 중
            </span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
              {total.toLocaleString("ko-KR")}명
            </span>
            <Link
              href={baseHref}
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-white/25"
              aria-label="필터 해제하고 전체 참가자 보기"
            >
              <span aria-hidden>✕</span>
              <span>전체로</span>
            </Link>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
          <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
            기관 홈
          </Link>
          <span className="mx-2">/</span>
          {selectedEvent ? (
            <>
              <Link href={baseHref} className="hover:text-[#2D5A3D]">
                참가자 관리
              </Link>
              <span className="mx-2">/</span>
              <span className="font-semibold text-[#2D5A3D]">
                {selectedEvent.name || "(이름 없음)"}
              </span>
            </>
          ) : (
            <span className="font-semibold text-[#2D5A3D]">참가자 관리</span>
          )}
        </nav>

        {/* Header — 행사 모드일 때 hero 카드 / 전체 모드는 기존 그라디언트 */}
        {selectedEvent ? (
          <header className="relative overflow-hidden rounded-3xl border-2 border-emerald-300 shadow-md">
            {/* 커버 이미지 또는 그라디언트 */}
            {selectedEvent.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedEvent.cover_image_url}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-br from-emerald-100 via-[#D4E4BC] to-emerald-300"
              />
            )}
            {/* 어두운 오버레이 */}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-br from-black/65 via-black/40 to-black/55"
            />

            <div className="relative z-[1] flex flex-col gap-4 p-6 text-white md:flex-row md:items-end md:justify-between md:p-8">
              <div className="min-w-0 flex-1">
                <p className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                  📍 행사 참가자 보는 중
                </p>
                <h1 className="mt-3 text-2xl font-extrabold leading-tight drop-shadow-md md:text-3xl">
                  🎪 {selectedEvent.name || "(이름 없음)"}
                </h1>
                <p className="mt-2 flex flex-wrap items-center gap-1 text-xs font-semibold text-white/95 drop-shadow md:text-sm">
                  <span aria-hidden>📅</span>
                  <span>
                    {fmtEventRange(
                      selectedEvent.starts_at,
                      selectedEvent.ends_at
                    )}
                  </span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
                  <span className="rounded-full border border-white/30 bg-white/15 px-2.5 py-1 backdrop-blur-sm">
                    🙋 {selectedEvent.participant_count.toLocaleString("ko-KR")}명 등록
                  </span>
                  {selectedEvent.quest_pack_count > 0 && (
                    <span className="rounded-full border border-white/30 bg-white/15 px-2.5 py-1 backdrop-blur-sm">
                      🎯 {selectedEvent.quest_pack_count} 스탬프북
                    </span>
                  )}
                  {selectedEvent.fm_session_count > 0 && (
                    <span className="rounded-full border border-white/30 bg-white/15 px-2.5 py-1 backdrop-blur-sm">
                      🎙 {selectedEvent.fm_session_count} 세션
                    </span>
                  )}
                  {selectedEvent.program_count > 0 && (
                    <span className="rounded-full border border-white/30 bg-white/15 px-2.5 py-1 backdrop-blur-sm">
                      🗂 {selectedEvent.program_count} 프로그램
                    </span>
                  )}
                  {selectedEvent.trail_count > 0 && (
                    <span className="rounded-full border border-white/30 bg-white/15 px-2.5 py-1 backdrop-blur-sm">
                      🗺 {selectedEvent.trail_count} 숲길
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/org/${orgId}/events/${selectedEvent.event_id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#2D5A3D] shadow-md transition hover:bg-[#F5F1E8]"
                >
                  <span aria-hidden>🎬</span>
                  <span>행사 진행 관리</span>
                  <span aria-hidden>›</span>
                </Link>
                <Link
                  href={baseHref}
                  className="inline-flex items-center gap-1.5 rounded-xl border-2 border-white/40 bg-white/10 px-4 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
                  aria-label="필터 해제하고 전체 참가자 보기"
                >
                  <span aria-hidden>✕</span>
                  <span>전체로 돌아가기</span>
                </Link>
              </div>
            </div>
          </header>
        ) : (
          <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl" aria-hidden>
                  🙋
                </span>
                <div>
                  <h1 className="flex flex-wrap items-baseline gap-2 text-xl font-bold text-[#2D5A3D] md:text-2xl">
                    <span>우리 기관 전체 참가자</span>
                    <span className="text-base font-semibold text-[#3A7A52] md:text-lg">
                      ({total.toLocaleString("ko-KR")}명)
                    </span>
                  </h1>
                  <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
                    보호자 앱 참가자를 일괄 등록하고 현황을 확인하세요. 행사별로
                    보려면 아래 필터를 사용하세요.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/api/org/${orgId}/export/participants`}
                  download
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8]"
                  title="참가자 전체 목록을 CSV 파일로 내려받습니다"
                >
                  <span aria-hidden>📥</span>
                  <span>CSV 다운로드</span>
                </a>
                <Link
                  href={`/org/${orgId}/users/bulk-import`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8]"
                >
                  <span aria-hidden>📥</span>
                  <span>엑셀 일괄 등록</span>
                </Link>
              </div>
            </div>
          </header>
        )}

      {/* Import success banner */}
      {Number.isFinite(importedCount) && importedCount > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✅ 일괄 등록 완료 — {importedCount.toLocaleString("ko-KR")}명이
          처리되었어요.
        </div>
      )}

      {/* 행사별 필터 */}
      {events.length > 0 && (
        <section
          aria-label="행사별 필터"
          className="rounded-2xl border border-[#D4E4BC] bg-white p-3 shadow-sm"
        >
          <p className="mb-2 px-1 text-[11px] font-bold text-[#6B6560]">
            🎪 행사별로 보기
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={baseHref}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                !selectedEvent
                  ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                  : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-[#2D5A3D] hover:text-[#2D5A3D]"
              }`}
            >
              <span>전체</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  !selectedEvent ? "bg-white/20" : "bg-[#F5F1E8]"
                }`}
              >
                {allUsers.length}
              </span>
            </Link>
            {events.map((e) => {
              const active = selectedEvent?.event_id === e.event_id;
              const isLive = e.status === "LIVE";
              return (
                <Link
                  key={e.event_id}
                  href={`${baseHref}?event=${e.event_id}`}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                      : isLive
                        ? "border-emerald-400 bg-emerald-50 text-emerald-800 hover:border-emerald-600"
                        : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-[#2D5A3D] hover:text-[#2D5A3D]"
                  }`}
                  title={`${e.name} 참가자만 보기`}
                >
                  {isLive && (
                    <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
                    </span>
                  )}
                  <span className="max-w-[12rem] truncate">
                    {e.name || "(이름 없음)"}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      active ? "bg-white/20" : "bg-[#F5F1E8]"
                    }`}
                  >
                    {e.participant_count}
                  </span>
                </Link>
              );
            })}
          </div>
          {selectedEvent && (
            <p className="mt-2 px-1 text-[11px] text-[#6B6560]">
              💡 아래 등록 폼에서 추가하는 참가자는{" "}
              <b className="text-[#2D5A3D]">
                &quot;{selectedEvent.name || "(이름 없음)"}&quot;
              </b>{" "}
              행사에 자동으로 연결돼요.
            </p>
          )}
        </section>
      )}

      {/* 빠른 원생 추가 — 행사 선택 시 자동 연결, 전체 모드면 기관 전체로 등록. */}
      {selectedEvent ? (
        <div className="rounded-2xl border-l-4 border-emerald-400 bg-emerald-50/60 p-1 shadow-sm">
          <p className="px-3 pb-1 pt-2 text-[11px] font-bold text-emerald-800">
            🎪 이 행사에 등록 — 추가하는 참가자는 자동 연결돼요
          </p>
          <QuickAddUser
            orgId={orgId}
            action={createSingleEventParticipantAction.bind(
              null,
              orgId,
              selectedEvent.event_id
            )}
            successHint={`"${selectedEvent.name || "(이름 없음)"}" 행사에 자동 연결됐어요.`}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="px-1 text-[11px] text-[#6B6560]">
            💡 행사 선택 없이 등록하면 <b className="text-[#2D5A3D]">기관 전체</b>{" "}
            참가자로 추가돼요. 특정 행사에 묶고 싶으면 위{" "}
            <span className="font-bold text-[#2D5A3D]">🎪 행사별로 보기</span>{" "}
            에서 행사를 먼저 클릭해 주세요.
          </p>
          <QuickAddUser orgId={orgId} />
        </div>
      )}

      {/* 📥 엑셀 일괄 등록 — 빠른 추가 폼 바로 아래 안내 카드 */}
      <Link
        href={
          selectedEvent
            ? `/org/${orgId}/users/bulk-import?event=${selectedEvent.event_id}`
            : `/org/${orgId}/users/bulk-import`
        }
        className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-[#E5D3B8] bg-[#FFFDF8] px-4 py-3 shadow-sm transition hover:border-[#6B4423] hover:bg-[#FFF8F0]"
      >
        <span className="text-2xl" aria-hidden>
          📥
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#6B4423]">
            엑셀 일괄 등록
          </p>
          <p className="mt-0.5 text-[11px] text-[#6B6560]">
            여러 명을 한 번에 등록하려면 엑셀 / CSV 파일을 올려주세요
            {selectedEvent && (
              <>
                {" · "}
                <b className="text-emerald-800">
                  &quot;{selectedEvent.name || "(이름 없음)"}&quot;
                </b>{" "}
                행사에 자동 연결
              </>
            )}
          </p>
        </div>
        <span className="text-xs font-bold text-[#6B4423]" aria-hidden>
          →
        </span>
      </Link>

      {/* 검색 — 행사 필터를 유지. 행사 모드는 emerald 좌측 stripe + 톤. */}
      <form
        method="get"
        className={`rounded-2xl border p-4 shadow-sm ${
          selectedEvent
            ? "border-l-4 border-emerald-400 bg-emerald-50/40"
            : "border-[#D4E4BC] bg-white"
        }`}
      >
        {/* 선택된 행사 필터를 유지 */}
        {selectedEvent && (
          <input
            type="hidden"
            name="event"
            value={selectedEvent.event_id}
          />
        )}
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[200px]">
            <span className="text-[11px] font-semibold text-[#6B6560]">
              원생명 / 학부모연락처 검색
              {selectedEvent && (
                <span className="ml-1 text-[10px] text-[#3A7A52]">
                  (이 행사 안에서만 검색)
                </span>
              )}
            </span>
            <input
              type="text"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="예) 김엄마 / 010-1234-5678"
              inputMode="search"
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-sm text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-[#2D5A3D] px-4 py-2 text-xs font-bold text-white hover:bg-[#234a30]"
          >
            검색
          </button>
          <Link
            href={`${baseHref}${eventQs}`}
            className="rounded-lg border border-[#E5D3B8] bg-white px-4 py-2 text-xs font-semibold text-[#6B4423] hover:bg-[#FFF8F0]"
          >
            초기화
          </Link>
          <span className="ml-auto text-xs text-[#6B6560]">
            {filtered.length.toLocaleString("ko-KR")} /{" "}
            {total.toLocaleString("ko-KR")}명
          </span>
        </div>
      </form>

      {/* 테이블 (데스크탑) */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="text-5xl" aria-hidden>
            🌱
          </div>
          <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
            {q ? "조건에 맞는 참가자가 없어요" : "아직 등록된 참가자가 없어요"}
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            위의 ⚡ 빠른 원생 추가 카드에서 바로 등록하거나 CSV 업로드로 한 번에 등록하세요.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link
              href={`/org/${orgId}/users/bulk-import`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-xs font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8]"
            >
              <span aria-hidden>📥</span>
              <span>엑셀 일괄 등록</span>
            </Link>
          </div>
        </div>
      ) : (
        <UsersTable
          orgId={orgId}
          rows={filtered}
          todayIso={todayIso}
          events={events.map((e) => ({ event_id: e.event_id, name: e.name, status: e.status }))}
        />
      )}
      </div>
    </div>
  );
}

