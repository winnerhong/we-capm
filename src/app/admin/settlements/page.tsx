import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SettlementsTable, type SettlementRow } from "./settlements-table";

export const dynamic = "force-dynamic";

type SettlementStatus = "DRAFT" | "REVIEW" | "APPROVED" | "PAID" | "DISPUTED";

type PartnerMap = Map<string, { name: string; business_name: string | null }>;

function fmtKRW(n: number): string {
  return n.toLocaleString("ko-KR");
}

function currentMonthYYYYMM(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

interface Props {
  searchParams: Promise<{ month?: string; status?: string }>;
}

export default async function AdminSettlementsPage({ searchParams }: Props) {
  const params = await searchParams;
  const month = params.month ?? currentMonthYYYYMM();
  const statusFilter = (params.status ?? "ALL") as SettlementStatus | "ALL";

  const supabase = await createClient();

  // 월 범위
  const [y, m] = month.split("-").map((n) => parseInt(n, 10));
  const monthStart =
    y && m ? new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10) : "1970-01-01";
  const monthEnd =
    y && m ? new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10) : "9999-12-31";

  let rows: SettlementRow[] = [];
  let tableMissing = false;

  try {
    const { data, error } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            gte: (k: string, v: string) => {
              lt: (k: string, v: string) => {
                order: (
                  col: string,
                  opts: { ascending: boolean },
                ) => Promise<{
                  data:
                    | (SettlementRow & { partner_id: string | null })[]
                    | null;
                  error: { message: string; code?: string } | null;
                }>;
              };
            };
          };
        };
      }
    )
      .from("settlements")
      .select(
        "id, partner_id, period_start, period_end, gross_sales, refunds, commission_rate, commission_amount, acorn_deduction, other_deductions, net_amount, status, paid_at, pay_reference, bank_account, account_holder",
      )
      .gte("period_start", monthStart)
      .lt("period_start", monthEnd)
      .order("net_amount", { ascending: false });

    if (error) {
      if (error.code === "42P01" || /relation .* does not exist/i.test(error.message)) {
        tableMissing = true;
      }
    } else {
      rows = (data ?? []) as SettlementRow[];
    }
  } catch {
    tableMissing = true;
  }

  // partner names
  const partnerIds = Array.from(
    new Set(rows.map((r) => r.partner_id).filter((v): v is string => !!v)),
  );
  const partnerMap: PartnerMap = new Map();
  if (partnerIds.length > 0) {
    try {
      const { data: partnerData } = await (
        supabase as unknown as {
          from: (t: string) => {
            select: (c: string) => {
              in: (k: string, v: string[]) => Promise<{
                data:
                  | {
                      id: string;
                      name: string;
                      business_name: string | null;
                    }[]
                  | null;
                error: unknown;
              }>;
            };
          };
        }
      )
        .from("partners")
        .select("id, name, business_name")
        .in("id", partnerIds);

      (partnerData ?? []).forEach((p) => {
        partnerMap.set(p.id, { name: p.name, business_name: p.business_name });
      });
    } catch {
      // ignore
    }
  }

  // Apply status filter in-memory
  const filtered = rows.filter((r) =>
    statusFilter === "ALL" ? true : r.status === statusFilter,
  );

  // Stats
  const draftCount = rows.filter((r) => r.status === "DRAFT" || r.status === "REVIEW")
    .length;
  const approvedCount = rows.filter((r) => r.status === "APPROVED").length;
  const paidCount = rows.filter((r) => r.status === "PAID").length;
  const disputedCount = rows.filter((r) => r.status === "DISPUTED").length;
  const totalNet = rows.reduce((acc, r) => acc + r.net_amount, 0);
  const paidNet = rows
    .filter((r) => r.status === "PAID")
    .reduce((acc, r) => acc + r.net_amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin" className="text-sm font-medium text-[#2D5A3D] hover:underline">
          ← 대시보드
        </Link>
        {tableMissing && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
            settlements 테이블 미존재
          </span>
        )}
      </div>

      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[#2D5A3D]">
            <span>💸</span>
            <span>정산 관리</span>
          </h1>
          <p className="mt-1 text-sm text-[#6B6560]">
            숲지기별 월별 정산을 생성하고 지급을 관리합니다
          </p>
        </div>
      </div>

      {/* 필터 */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#D4E4BC] bg-white p-4"
      >
        <div>
          <label htmlFor="f-month" className="block text-[11px] font-semibold text-[#8B6F47]">
            월
          </label>
          <input
            id="f-month"
            type="month"
            name="month"
            defaultValue={month}
            className="mt-1 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-1.5 text-sm focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </div>
        <div>
          <label htmlFor="f-status" className="block text-[11px] font-semibold text-[#8B6F47]">
            상태
          </label>
          <select
            id="f-status"
            name="status"
            defaultValue={statusFilter}
            className="mt-1 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-1.5 text-sm focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          >
            <option value="ALL">전체</option>
            <option value="DRAFT">초안</option>
            <option value="REVIEW">검토중</option>
            <option value="APPROVED">승인</option>
            <option value="PAID">지급완료</option>
            <option value="DISPUTED">이의제기</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-xl border border-[#2D5A3D] bg-white px-3 py-1.5 text-sm font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
        >
          필터 적용
        </button>
      </form>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
          <div className="text-xs font-medium text-[#8B6F47]">총 정산예정</div>
          <div className="mt-1 text-2xl font-bold text-[#2D5A3D]">
            {fmtKRW(totalNet)}
            <span className="ml-1 text-sm font-medium">원</span>
          </div>
          <div className="mt-1 text-[11px] text-[#8B6F47]">{rows.length}개</div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white p-4">
          <div className="text-xs font-medium text-amber-800">대기/검토</div>
          <div className="mt-1 text-2xl font-bold text-amber-800">
            {fmtKRW(draftCount)}
            <span className="ml-1 text-sm font-medium">건</span>
          </div>
        </div>
        <div className="rounded-2xl border border-green-200 bg-white p-4">
          <div className="text-xs font-medium text-green-700">지급완료</div>
          <div className="mt-1 text-2xl font-bold text-green-700">
            {fmtKRW(paidCount)}
            <span className="ml-1 text-sm font-medium">건</span>
          </div>
          <div className="mt-1 text-[11px] text-green-700">
            {fmtKRW(paidNet)}원
          </div>
        </div>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
          <div className="text-xs font-medium text-[#8B6F47]">승인 / 이의</div>
          <div className="mt-1 text-2xl font-bold text-[#2D5A3D]">
            {fmtKRW(approvedCount)}
            <span className="ml-1 text-sm font-medium">/</span>
            <span className="text-red-700"> {fmtKRW(disputedCount)}</span>
          </div>
        </div>
      </div>

      {tableMissing ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <div className="font-semibold">⚠️ settlements 테이블이 아직 준비되지 않았어요.</div>
          <p className="mt-1 text-xs">DB 마이그레이션을 먼저 실행해 주세요.</p>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="rounded-2xl border border-[#D4E4BC] bg-white p-8 text-center text-sm text-[#6B6560]">
              테이블을 불러오는 중...
            </div>
          }
        >
          <SettlementsTable
            rows={filtered}
            month={month}
            partners={Object.fromEntries(partnerMap)}
          />
        </Suspense>
      )}
    </div>
  );
}
