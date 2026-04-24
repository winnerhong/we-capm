// 기관 대시보드용 참가자 리스트 섹션.
// `/org/[orgId]/users` 페이지의 테이블 UI 를 최근 N명 한정으로 축약 노출.
// 액션 컴포넌트 (AttendanceToggle / AcornAdjuster / UserRowActions) 는 재사용.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AttendanceToggle } from "./users/attendance-toggle";
import { AcornAdjuster } from "./users/acorn-adjuster";
import { UserRowActions } from "./users/user-row-actions";
import { AcornIcon } from "@/components/acorn-icon";

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

const STATUS_META: Record<UserStatus, { label: string; chip: string }> = {
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

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 최근 등록 참가자 N명 + 총원 카운트. */
async function loadRecentParticipants(
  orgId: string,
  limit: number
): Promise<{ rows: AppUserWithCount[]; total: number }> {
  const supabase = await createClient();

  const [listResp, countResp] = await Promise.all([
    (
      supabase.from("app_users" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => {
              limit: (n: number) => Promise<{ data: AppUserListRow[] | null }>;
            };
          };
        };
      }
    )
      .select(
        "id, phone, parent_name, org_id, acorn_balance, status, last_login_at, created_at, attendance_status, attendance_date"
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit),
    (
      supabase.from("app_users" as never) as unknown as {
        select: (
          c: string,
          o: { count: "exact"; head: true }
        ) => {
          eq: (k: string, v: string) => Promise<{ count: number | null }>;
        };
      }
    )
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
  ]);

  const rows = (listResp.data ?? []) as AppUserListRow[];
  if (rows.length === 0) {
    return { rows: [], total: countResp.count ?? 0 };
  }

  const ids = rows.map((r) => r.id);
  const childResp = (await (
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
    .in("user_id", ids)) as {
    data: Array<{ user_id: string; name: string; is_enrolled: boolean }> | null;
  };

  const countByUser = new Map<string, number>();
  const enrolledByUser = new Map<string, string[]>();
  for (const c of childResp.data ?? []) {
    countByUser.set(c.user_id, (countByUser.get(c.user_id) ?? 0) + 1);
    if (c.is_enrolled) {
      const list = enrolledByUser.get(c.user_id) ?? [];
      list.push(c.name);
      enrolledByUser.set(c.user_id, list);
    }
  }

  const enriched = rows.map<AppUserWithCount>((r) => ({
    ...r,
    children_count: countByUser.get(r.id) ?? 0,
    enrolled_names: enrolledByUser.get(r.id) ?? [],
  }));

  return { rows: enriched, total: countResp.count ?? enriched.length };
}

const INLINE_LIMIT = 10;

export async function DashboardParticipantsSection({
  orgId,
}: {
  orgId: string;
}) {
  const { rows, total } = await loadRecentParticipants(orgId, INLINE_LIMIT);
  const today = todayIsoDate();

  return (
    <section className="rounded-2xl border border-[#D4E4BC] bg-white shadow-sm">
      {/* 헤더 */}
      <header className="flex items-center justify-between border-b border-[#F4EFE8] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            🙋
          </span>
          <h2 className="text-sm font-bold text-[#2D5A3D]">
            우리 기관 참가자{" "}
            <span className="tabular-nums text-[#6B6560]">({total}명)</span>
          </h2>
        </div>
        <Link
          href={`/org/${orgId}/users`}
          className="text-xs font-semibold text-[#3A7A52] hover:text-[#2D5A3D] hover:underline"
        >
          전체 관리 →
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-10 text-center">
          <span className="text-5xl" aria-hidden>
            🌱
          </span>
          <p className="mt-3 text-sm font-bold text-[#2D5A3D]">
            아직 등록된 참가자가 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            엑셀 일괄등록이나 참가자 링크로 가족을 초대해 보세요
          </p>
          <Link
            href={`/org/${orgId}/users`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#234a30]"
          >
            <span aria-hidden>➕</span>
            <span>참가자 등록</span>
          </Link>
        </div>
      ) : (
        <>
          {/* 데스크탑 테이블 */}
          <div className="hidden overflow-x-auto md:block">
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
                {rows.map((r) => {
                  const status =
                    STATUS_META[r.status] ?? STATUS_META.ACTIVE;
                  const displayName =
                    r.enrolled_names.length > 0
                      ? r.enrolled_names.join(", ")
                      : r.parent_name;
                  const attendanceToday =
                    r.attendance_date === today
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

          {/* 모바일 카드 */}
          <ul className="space-y-2 p-3 md:hidden">
            {rows.map((r) => {
              const status =
                STATUS_META[r.status] ?? STATUS_META.ACTIVE;
              const displayName =
                r.enrolled_names.length > 0
                  ? r.enrolled_names.join(", ")
                  : r.parent_name;
              const attendanceToday =
                r.attendance_date === today ? r.attendance_status : null;
              const phoneDigits = (r.phone ?? "").replace(/\D/g, "");
              return (
                <li
                  key={r.id}
                  className="rounded-xl border border-[#F4EFE8] bg-[#FFF8F0] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/org/${orgId}/users/${r.id}`}
                        className="truncate text-sm font-bold text-[#2D5A3D]"
                      >
                        {displayName}
                      </Link>
                      <a
                        href={`tel:${phoneDigits}`}
                        className="mt-0.5 block truncate font-mono text-[11px] text-[#6B6560]"
                      >
                        📞 {formatPhone(r.phone)}
                      </a>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${status.chip}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <AttendanceToggle
                      userId={r.id}
                      current={attendanceToday}
                      size="sm"
                    />
                    <span className="rounded-full bg-[#FAE7D0] px-2 py-0.5 font-bold text-[#6B4423]">
                      👫 {r.children_count}명
                    </span>
                    <AcornAdjuster
                      userId={r.id}
                      balance={r.acorn_balance}
                      size="row"
                    />
                  </div>
                  <div className="mt-2 border-t border-[#F4EFE8] pt-2">
                    <UserRowActions
                      orgId={orgId}
                      userId={r.id}
                      userName={displayName}
                      status={r.status}
                      variant="card"
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          {total > rows.length && (
            <div className="border-t border-[#F4EFE8] bg-[#FFF8F0] px-4 py-2.5 text-center">
              <Link
                href={`/org/${orgId}/users`}
                className="text-xs font-semibold text-[#3A7A52] hover:underline"
              >
                최근 {rows.length}명 표시 · 전체 {total}명 관리 →
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
