import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { UserRowActions } from "./user-row-actions";
import { QuickAddUser } from "./quick-add-user";
import { AcornAdjuster } from "./acorn-adjuster";
import { AttendanceToggle } from "./attendance-toggle";
import { AcornIcon } from "@/components/acorn-icon";

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
  searchParams: Promise<{ q?: string; imported?: string }>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  const org = await requireOrg();

  const all = await loadUsers(orgId);

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

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관 홈
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">참가자 관리</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              🙋
            </span>
            <div>
              <h1 className="flex flex-wrap items-baseline gap-2 text-xl font-bold text-[#2D5A3D] md:text-2xl">
                <span>우리 기관 참가자</span>
                <span className="text-base font-semibold text-[#3A7A52] md:text-lg">
                  ({total.toLocaleString("ko-KR")}명)
                </span>
              </h1>
              <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
                보호자 앱 참가자를 일괄 등록하고 현황을 확인하세요.
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

      {/* Import success banner */}
      {Number.isFinite(importedCount) && importedCount > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✅ 일괄 등록 완료 — {importedCount.toLocaleString("ko-KR")}명이
          처리되었어요.
        </div>
      )}

      {/* 빠른 원생 추가 */}
      <QuickAddUser orgId={orgId} />

      {/* 검색 */}
      <form
        method="get"
        className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[200px]">
            <span className="text-[11px] font-semibold text-[#6B6560]">
              원생명 / 학부모연락처 검색
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
            href={`/org/${orgId}/users`}
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
        <>
          {/* 데스크탑 테이블 */}
          <div className="hidden overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-[#F4EFE8] text-[#6B4423]">
                  <tr>
                    <th className="px-3 py-2.5 text-center text-[11px] font-bold">
                      📋 출석
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold">
                      🎒 원생명
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold">
                      📞 학부모연락처
                    </th>
                    <th className="px-3 py-2.5 text-center text-[11px] font-bold">
                      👫 자녀
                    </th>
                    <th className="px-3 py-2.5 text-center text-[11px] font-bold">
                      <AcornIcon /> 도토리
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-bold">
                      📅 최근 로그인
                    </th>
                    <th className="px-3 py-2.5 text-center text-[11px] font-bold">
                      상태
                    </th>
                    <th className="px-3 py-2.5 text-center text-[11px] font-bold">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const status =
                      STATUS_META[r.status] ?? STATUS_META.ACTIVE;
                    const displayName =
                      r.enrolled_names.length > 0
                        ? r.enrolled_names.join(", ")
                        : r.parent_name;
                    // 출석 상태는 오늘 날짜일 때만 유효하게 취급 (자동 리셋)
                    const attendanceToday =
                      r.attendance_date === todayIso
                        ? r.attendance_status
                        : null;
                    const phoneDigits = (r.phone ?? "").replace(/\D/g, "");
                    return (
                      <tr
                        key={r.id}
                        className="border-t border-[#F4EFE8] hover:bg-[#FFF8F0]"
                      >
                        <td className="px-3 py-2.5 text-center">
                          <AttendanceToggle
                            userId={r.id}
                            current={attendanceToday}
                            size="sm"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/org/${orgId}/users/${r.id}`}
                            className="font-semibold text-[#2D5A3D] underline-offset-2 hover:underline"
                          >
                            {displayName}
                          </Link>
                          {r.enrolled_names.length === 0 && (
                            <span className="ml-1 text-[10px] text-[#8B7F75]">
                              (원생 미지정)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <a
                            href={`tel:${phoneDigits}`}
                            className="inline-flex items-center gap-1 font-mono text-xs text-[#2D5A3D] underline-offset-2 hover:underline"
                            title="클릭해서 전화 걸기"
                          >
                            📞 {formatPhone(r.phone)}
                          </a>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FAE7D0] px-2 py-0.5 text-[11px] font-bold text-[#6B4423]">
                            <span aria-hidden>👫</span>
                            {r.children_count}명
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <AcornAdjuster
                            userId={r.id}
                            balance={r.acorn_balance}
                            size="row"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right text-[#6B6560]">
                          {formatDateTime(r.last_login_at)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.chip}`}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <UserRowActions
                            orgId={orgId}
                            userId={r.id}
                            userName={displayName}
                            status={r.status}
                            variant="table"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 모바일 카드 */}
          <ul className="space-y-2 md:hidden">
            {filtered.map((r) => {
              const status = STATUS_META[r.status] ?? STATUS_META.ACTIVE;
              const displayName =
                r.enrolled_names.length > 0
                  ? r.enrolled_names.join(", ")
                  : r.parent_name;
              const attendanceToday =
                r.attendance_date === todayIso ? r.attendance_status : null;
              const phoneDigits = (r.phone ?? "").replace(/\D/g, "");
              return (
                <li
                  key={r.id}
                  className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm"
                >
                  {/* 출석 토글 — 모바일에서 가장 먼저 보이고 탭하기 쉽게 */}
                  <div className="mb-3 flex justify-center">
                    <AttendanceToggle
                      userId={r.id}
                      current={attendanceToday}
                      size="md"
                    />
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/org/${orgId}/users/${r.id}`}
                        className="block text-base font-bold text-[#2D5A3D] hover:underline"
                      >
                        🎒 {displayName}
                      </Link>
                      <a
                        href={`tel:${phoneDigits}`}
                        className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-[#2D5A3D] underline-offset-2 hover:underline"
                      >
                        📞 {formatPhone(r.phone)}
                      </a>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.chip}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-[#FAE7D0] p-2">
                      <div className="text-[10px] text-[#6B4423]">자녀</div>
                      <div className="text-sm font-bold text-[#6B4423]">
                        👫 {r.children_count}명
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#F4EFE8] p-2">
                      <div className="mb-1 text-[10px] text-[#6B4423]">
                        <AcornIcon /> 도토리
                      </div>
                      <AcornAdjuster
                        userId={r.id}
                        balance={r.acorn_balance}
                        size="row"
                      />
                    </div>
                    <div className="rounded-lg bg-[#E8F0E4] p-2">
                      <div className="text-[10px] text-[#2D5A3D]">최근</div>
                      <div className="text-xs font-bold text-[#2D5A3D]">
                        📅 {formatDateTime(r.last_login_at)}
                      </div>
                    </div>
                  </div>
                  <UserRowActions
                    orgId={orgId}
                    userId={r.id}
                    userName={displayName}
                    status={r.status}
                    variant="card"
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

