import Link from "next/link";
import { requirePartnerWithRole } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  ROLE_META,
  STATUS_META,
  type TeamMemberRow,
  type TeamRole,
  type TeamStatus,
} from "@/lib/team/types";
import {
  suspendTeamMemberAction,
  reactivateTeamMemberAction,
  deleteTeamMemberAction,
  regenerateTeamMemberPasswordAction,
} from "./actions";
import { InviteResultBanner } from "./page-client-banner";

export const dynamic = "force-dynamic";

type OwnerInfo = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  created_at: string;
};

async function loadTeamMembers(partnerId: string): Promise<TeamMemberRow[]> {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase.from("partner_team_members") as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            neq: (k: string, v: string) => {
              order: (
                c: string,
                opts: { ascending: boolean }
              ) => Promise<{ data: TeamMemberRow[] | null }>;
            };
          };
        };
      }
    )
      .select(
        "id,partner_id,name,email,phone,username,role,status,invited_by,invited_at,activated_at,last_login_at,suspended_at,memo,created_at,updated_at"
      )
      .eq("partner_id", partnerId)
      .neq("status", "DELETED")
      .order("created_at", { ascending: false });
    return data ?? [];
  } catch {
    return [];
  }
}

async function loadOwnerInfo(partnerId: string): Promise<OwnerInfo | null> {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase.from("partners") as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: OwnerInfo | null }>;
          };
        };
      }
    )
      .select("id,name,username,email,phone,created_at")
      .eq("id", partnerId)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

function getInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0) : "🌿";
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function roleAvatarGradient(role: TeamRole): string {
  switch (role) {
    case "OWNER":
      return "bg-gradient-to-br from-violet-500 to-fuchsia-500";
    case "MANAGER":
      return "bg-gradient-to-br from-emerald-500 to-teal-500";
    case "STAFF":
      return "bg-gradient-to-br from-sky-500 to-blue-500";
    case "FINANCE":
      return "bg-gradient-to-br from-amber-500 to-orange-500";
    case "VIEWER":
    default:
      return "bg-gradient-to-br from-zinc-400 to-zinc-500";
  }
}

type Search = {
  invited?: string;
  pw?: string;
  name?: string;
  reset?: string;
  updated?: string;
  suspended?: string;
  reactivated?: string;
  deleted?: string;
  role?: string;
  status?: string;
  q?: string;
};

export default async function TeamMembersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  let session;
  try {
    session = await requirePartnerWithRole(["OWNER"]);
  } catch {
    return (
      <div className="space-y-4">
        <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
          <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
            대시보드
          </Link>
          <span className="mx-2">/</span>
          <Link href="/partner/settings" className="hover:text-[#2D5A3D]">
            설정
          </Link>
          <span className="mx-2">/</span>
          <span className="font-semibold text-[#2D5A3D]">팀 관리</span>
        </nav>
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center shadow-sm">
          <div className="mb-2 text-3xl" aria-hidden>
            🔒
          </div>
          <h1 className="text-lg font-bold text-rose-900">
            이 페이지는 OWNER만 접근할 수 있어요
          </h1>
          <p className="mt-1 text-sm text-rose-700">
            팀 관리 권한이 필요하다면 숲지기 오너에게 문의해 주세요.
          </p>
          <Link
            href="/partner/dashboard"
            className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100"
          >
            대시보드로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const sp = await searchParams;
  const [members, owner] = await Promise.all([
    loadTeamMembers(session.id),
    loadOwnerInfo(session.id),
  ]);

  // 통계
  const total = members.length + 1; // OWNER 포함
  const active =
    members.filter((m) => m.status === "ACTIVE").length + 1; // OWNER 활성
  const pending = members.filter((m) => m.status === "PENDING").length;
  const suspended = members.filter((m) => m.status === "SUSPENDED").length;

  // 필터
  const roleFilter = (sp.role ?? "") as TeamRole | "";
  const statusFilter = (sp.status ?? "") as TeamStatus | "";
  const query = (sp.q ?? "").trim().toLowerCase();

  const filtered = members.filter((m) => {
    if (roleFilter && m.role !== roleFilter) return false;
    if (statusFilter && m.status !== statusFilter) return false;
    if (query) {
      const hay = `${m.name} ${m.email ?? ""} ${m.username}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/settings" className="hover:text-[#2D5A3D]">
          설정
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">팀 관리</span>
      </nav>

      {/* 헤더 */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              👥
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
                팀 관리
              </h1>
              <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
                숲지기 계정에 팀원을 초대하고 역할을 관리하세요
              </p>
            </div>
          </div>
          <Link
            href="/partner/settings/team/new"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 md:w-auto"
          >
            <span aria-hidden>➕</span>
            <span>팀원 초대</span>
          </Link>
        </div>
      </header>

      {/* 초대/재발급 결과 배너 */}
      <InviteResultBanner
        invited={sp.invited}
        resetFor={sp.reset}
        name={sp.name}
        pw={sp.pw}
      />

      {/* 변경 저장 성공 배너 */}
      {sp.updated && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          ✅ 팀원 정보가 성공적으로 저장되었어요.
        </div>
      )}
      {sp.suspended && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          🚫 팀원을 정지했습니다. 해당 팀원은 로그인이 차단돼요.
        </div>
      )}
      {sp.reactivated && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          ✅ 팀원이 다시 활성화되었어요.
        </div>
      )}
      {sp.deleted && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
          🗑 팀원이 삭제되었습니다. 데이터는 법정 보존 기간 동안 보관돼요.
        </div>
      )}

      {/* 통계 4카드 */}
      <section
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
        aria-label="팀 통계"
      >
        <StatCard label="전체" value={total} icon="👥" tone="green" />
        <StatCard label="활성" value={active} icon="✅" tone="emerald" />
        <StatCard label="대기" value={pending} icon="⏳" tone="amber" />
        <StatCard label="정지" value={suspended} icon="🚫" tone="zinc" />
      </section>

      {/* 필터 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
        <form
          method="GET"
          className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]"
        >
          <div>
            <label
              htmlFor="q"
              className="mb-1 block text-[11px] font-semibold text-[#6B6560]"
            >
              🔍 검색 (이름·이메일·아이디)
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="예: 김매니저"
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
            />
          </div>
          <div>
            <label
              htmlFor="role"
              className="mb-1 block text-[11px] font-semibold text-[#6B6560]"
            >
              역할
            </label>
            <select
              id="role"
              name="role"
              defaultValue={roleFilter}
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30 md:w-[160px]"
            >
              <option value="">전체 역할</option>
              {(Object.keys(ROLE_META) as TeamRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_META[r].icon} {ROLE_META[r].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="status"
              className="mb-1 block text-[11px] font-semibold text-[#6B6560]"
            >
              상태
            </label>
            <select
              id="status"
              name="status"
              defaultValue={statusFilter}
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30 md:w-[140px]"
            >
              <option value="">전체 상태</option>
              {(Object.keys(STATUS_META) as TeamStatus[])
                .filter((s) => s !== "DELETED")
                .map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].icon} {STATUS_META[s].label}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-bold text-white hover:bg-[#234a30]"
            >
              적용
            </button>
            <Link
              href="/partner/settings/team"
              className="inline-flex items-center justify-center rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm text-[#6B6560] hover:bg-[#FFF8F0]"
            >
              초기화
            </Link>
          </div>
        </form>
      </section>

      {/* 팀원 리스트 */}
      <section className="space-y-3">
        {/* OWNER 카드 먼저 */}
        {owner && (
          <OwnerCard
            owner={owner}
            initial={getInitial(owner.name)}
          />
        )}

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-8 text-center shadow-sm">
            <div className="mb-2 text-3xl" aria-hidden>
              🌱
            </div>
            <p className="text-sm font-semibold text-[#2D5A3D]">
              {members.length === 0
                ? "아직 초대된 팀원이 없어요"
                : "조건에 맞는 팀원이 없어요"}
            </p>
            <p className="mt-1 text-xs text-[#6B6560]">
              {members.length === 0
                ? "“팀원 초대”를 눌러 첫 동료를 초대해 보세요."
                : "검색어나 필터를 바꿔 보세요."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((m) => (
              <li key={m.id}>
                <MemberCard
                  member={m}
                  initial={getInitial(m.name)}
                  avatarClass={roleAvatarGradient(m.role)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: string;
  tone: "green" | "emerald" | "amber" | "zinc";
}) {
  const toneMap: Record<string, string> = {
    green: "from-[#E8F0E4] to-white border-[#D4E4BC] text-[#2D5A3D]",
    emerald: "from-emerald-50 to-white border-emerald-200 text-emerald-800",
    amber: "from-amber-50 to-white border-amber-200 text-amber-800",
    zinc: "from-zinc-50 to-white border-zinc-200 text-zinc-700",
  };
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br p-4 shadow-sm ${toneMap[tone]}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold opacity-80">{label}</span>
        <span aria-hidden className="text-lg">
          {icon}
        </span>
      </div>
      <div className="mt-1 text-2xl font-bold md:text-3xl">{value}</div>
    </div>
  );
}

function OwnerCard({
  owner,
  initial,
}: {
  owner: OwnerInfo;
  initial: string;
}) {
  const meta = ROLE_META.OWNER;
  return (
    <article className="rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-bold text-white shadow-md"
          >
            {initial}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-bold text-violet-900">
                {owner.name}
              </h3>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${meta.color}`}
              >
                <span aria-hidden>👑</span>
                <span>{meta.label}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-violet-800">
                본인
              </span>
            </div>
            <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-violet-900/80">
              <div>
                <dt className="sr-only">아이디</dt>
                <dd className="font-mono">@{owner.username}</dd>
              </div>
              {owner.email && (
                <div>
                  <dt className="sr-only">이메일</dt>
                  <dd>{owner.email}</dd>
                </div>
              )}
              {owner.phone && (
                <div>
                  <dt className="sr-only">휴대폰</dt>
                  <dd>{owner.phone}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/partner/my"
            className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100"
          >
            ✏️ 내 정보 수정
          </Link>
        </div>
      </div>
    </article>
  );
}

function MemberCard({
  member,
  initial,
  avatarClass,
}: {
  member: TeamMemberRow;
  initial: string;
  avatarClass: string;
}) {
  const roleMeta = ROLE_META[member.role];
  const statusMeta = STATUS_META[member.status];
  const isSuspended = member.status === "SUSPENDED";

  return (
    <article className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm transition-shadow hover:shadow-md md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* 좌측 정보 */}
        <div className="flex items-start gap-3">
          <div
            aria-hidden
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow-sm ${avatarClass}`}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-bold text-[#2D5A3D]">
                {member.name}
              </h3>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${roleMeta.color}`}
              >
                <span aria-hidden>{roleMeta.icon}</span>
                <span>{roleMeta.label}</span>
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusMeta.color}`}
              >
                <span aria-hidden>{statusMeta.icon}</span>
                <span>{statusMeta.label}</span>
              </span>
            </div>
            <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#6B6560]">
              <div className="flex items-center gap-1">
                <dt className="sr-only">아이디</dt>
                <dd className="font-mono">@{member.username}</dd>
              </div>
              {member.email && (
                <div className="flex items-center gap-1">
                  <dt className="sr-only">이메일</dt>
                  <dd className="truncate">✉️ {member.email}</dd>
                </div>
              )}
              {member.phone && (
                <div className="flex items-center gap-1">
                  <dt className="sr-only">휴대폰</dt>
                  <dd>📱 {member.phone}</dd>
                </div>
              )}
            </dl>
            <p className="mt-1 text-[11px] text-[#8B7F75]">
              마지막 로그인:{" "}
              <time>{formatDateTime(member.last_login_at)}</time>
              <span className="mx-1.5">·</span>
              초대일: <time>{formatDateTime(member.invited_at)}</time>
            </p>
          </div>
        </div>

        {/* 우측 액션 */}
        <div className="flex flex-wrap items-center gap-1.5 md:flex-shrink-0">
          <Link
            href={`/partner/settings/team/${member.id}/edit`}
            className="inline-flex items-center gap-1 rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            ✏️ 수정
          </Link>

          {isSuspended ? (
            <form action={reactivateTeamMemberAction.bind(null, member.id)}>
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                ✅ 재활성화
              </button>
            </form>
          ) : (
            <form action={suspendTeamMemberAction.bind(null, member.id)}>
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50"
              >
                🚫 정지
              </button>
            </form>
          )}

          <form action={regenerateTeamMemberPasswordAction.bind(null, member.id)}>
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-50"
            >
              🔑 비번재발급
            </button>
          </form>

          <form action={deleteTeamMemberAction.bind(null, member.id)}>
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-50"
            >
              🗑 삭제
            </button>
          </form>
        </div>
      </div>

      {member.memo && (
        <p className="mt-3 rounded-lg bg-[#FFF8F0] px-3 py-2 text-xs text-[#6B6560]">
          📝 {member.memo}
        </p>
      )}
    </article>
  );
}
