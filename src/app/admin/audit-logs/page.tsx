import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-guard";

const PAGE_SIZE = 50;

type SearchParams = {
  user_type?: string;
  action?: string;
  page?: string;
  days?: string;
};

type LogRow = {
  id: string;
  user_type: string;
  user_id: string | null;
  user_identifier: string | null;
  action: string;
  resource: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status_code: number | null;
  created_at: string;
};

const USER_TYPES = ["ADMIN", "MANAGER", "PARTNER", "PARTICIPANT", "PUBLIC"];
const COMMON_ACTIONS = ["LOGIN", "LOGOUT", "LOGIN_FAIL", "VIEW_PROFILE", "DELETE_ACCOUNT"];

function maskIdentifier(id: string | null): string {
  if (!id) return "-";
  // Phone: 010-1234-5678 → 010-1234-****
  if (/^01[0-9]-\d{3,4}-\d{4}$/.test(id)) {
    return id.slice(0, id.length - 4) + "****";
  }
  // Email
  if (id.includes("@")) {
    const [local, domain] = id.split("@");
    const maskedLocal = local.length <= 2 ? local[0] + "*" : local[0] + "*".repeat(local.length - 2) + local[local.length - 1];
    return `${maskedLocal}@${domain}`;
  }
  // Username: show first 2 chars + mask
  if (id.length > 4) {
    return id.slice(0, 2) + "*".repeat(id.length - 2);
  }
  return id;
}

function typeBadge(userType: string): string {
  const map: Record<string, string> = {
    ADMIN: "bg-red-100 text-red-700",
    MANAGER: "bg-purple-100 text-purple-700",
    PARTNER: "bg-blue-100 text-blue-700",
    PARTICIPANT: "bg-green-100 text-green-700",
    PUBLIC: "bg-neutral-100 text-neutral-700",
  };
  return map[userType] ?? "bg-neutral-100 text-neutral-700";
}

function actionBadge(action: string): string {
  if (action === "LOGIN") return "bg-emerald-100 text-emerald-700";
  if (action === "LOGOUT") return "bg-neutral-100 text-neutral-600";
  if (action === "LOGIN_FAIL") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();

  const page = Math.max(1, Number(sp.page ?? 1));
  const days = Math.max(1, Math.min(365, Number(sp.days ?? 7)));
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const filterType = sp.user_type && USER_TYPES.includes(sp.user_type) ? sp.user_type : null;
  const filterAction = sp.action ? sp.action : null;

  type RunnerChain = {
    eq: (k: string, v: string) => RunnerChain;
    order: (k: string, o: { ascending: boolean }) => {
      range: (f: number, t: number) => Promise<{
        data: LogRow[] | null;
        count: number | null;
        error: unknown;
      }>;
    };
  };

  const queryRunner = supabase as unknown as {
    from: (t: string) => {
      select: (
        c: string,
        opts?: { count?: "exact" | "planned" | "estimated" }
      ) => { gte: (k: string, v: string) => RunnerChain };
    };
  };
  let runner: RunnerChain = queryRunner
    .from("access_logs")
    .select("*", { count: "exact" })
    .gte("created_at", sinceIso);

  if (filterType) runner = runner.eq("user_type", filterType);
  if (filterAction) runner = runner.eq("action", filterAction);

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: logs, count } = (await runner
    .order("created_at", { ascending: false })
    .range(from, to)) as { data: LogRow[] | null; count: number | null };

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const buildUrl = (overrides: Partial<SearchParams>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      user_type: sp.user_type,
      action: sp.action,
      days: String(days),
      page: String(page),
      ...overrides,
    };
    Object.entries(merged).forEach(([k, v]) => {
      if (v) params.set(k, String(v));
    });
    const qs = params.toString();
    return qs ? `/admin/audit-logs?${qs}` : "/admin/audit-logs";
  };

  const csvParams = new URLSearchParams();
  if (filterType) csvParams.set("user_type", filterType);
  if (filterAction) csvParams.set("action", filterAction);
  csvParams.set("days", String(days));
  const csvHref = `/admin/audit-logs/export?${csvParams.toString()}`;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-lg">
        <p className="text-[11px] tracking-[0.4em] opacity-70 font-light">TORIRO AUDIT</p>
        <h1 className="text-2xl font-extrabold mt-1">접근 기록</h1>
        <p className="mt-2 text-sm opacity-80">
          개인정보보호법 준수를 위한 접근 로그
          <span className="ml-2 text-[11px] bg-white/20 rounded-full px-2 py-0.5">
            {totalCount.toLocaleString()}건
          </span>
        </p>
      </div>

      {/* 필터 */}
      <form method="GET" className="rounded-xl border bg-white p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-[11px] font-semibold text-neutral-600">유형</label>
          <select
            name="user_type"
            defaultValue={sp.user_type ?? ""}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          >
            <option value="">전체</option>
            {USER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-neutral-600">액션</label>
          <select
            name="action"
            defaultValue={sp.action ?? ""}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          >
            <option value="">전체</option>
            {COMMON_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-neutral-600">최근 기간 (일)</label>
          <select
            name="days"
            defaultValue={String(days)}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          >
            <option value="1">1일</option>
            <option value="7">7일</option>
            <option value="30">30일</option>
            <option value="90">90일</option>
            <option value="180">180일</option>
            <option value="365">1년</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-[#2D5A3D] text-white text-sm font-semibold px-4 py-2 hover:bg-[#1F3F2A]"
          >
            조회
          </button>
          <a
            href={csvHref}
            className="rounded-lg border border-[#2D5A3D] text-[#2D5A3D] text-sm font-semibold px-4 py-2 hover:bg-[#F0F7F2]"
          >
            CSV
          </a>
        </div>
      </form>

      {/* 테이블 */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 border-b">
              <tr className="text-left text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">
                <th className="px-3 py-2">시각</th>
                <th className="px-3 py-2">유형</th>
                <th className="px-3 py-2">식별자</th>
                <th className="px-3 py-2">액션</th>
                <th className="px-3 py-2">리소스</th>
                <th className="px-3 py-2">IP</th>
                <th className="px-3 py-2">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs && logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2 text-[11px] text-neutral-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("ko-KR", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeBadge(
                          log.user_type
                        )}`}
                      >
                        {log.user_type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-700 font-mono">
                      {maskIdentifier(log.user_identifier)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${actionBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-500 max-w-[160px] truncate">
                      {log.resource ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-neutral-500 font-mono">
                      {log.ip_address ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-neutral-500">
                      {log.status_code ?? "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-sm text-neutral-500">
                    접근 기록이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-neutral-50 text-xs">
            <div className="text-neutral-500">
              {page} / {totalPages} 페이지 · 전체 {totalCount.toLocaleString()}건
            </div>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={buildUrl({ page: String(page - 1) })}
                  className="rounded-lg border px-3 py-1 hover:bg-white"
                >
                  이전
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={buildUrl({ page: String(page + 1) })}
                  className="rounded-lg border px-3 py-1 hover:bg-white"
                >
                  다음
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-neutral-500 text-center">
        개인정보보호법(PIPA) 제29조: 접속기록은 최소 6개월 이상 보관해야 합니다.
      </p>
    </div>
  );
}
