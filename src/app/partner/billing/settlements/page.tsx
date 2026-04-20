import Link from "next/link";
import { redirect } from "next/navigation";
import { getPartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SettlementRow = {
  id: string;
  period_start: string;
  period_end: string;
  gross_sales: number;
  refunds: number;
  commission_rate: number;
  commission_amount: number;
  acorn_deduction: number;
  other_deductions: number;
  net_amount: number;
  status: string;
  paid_at: string | null;
  bank_account: string | null;
  account_holder: string | null;
};

function wonKR(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function statusMeta(status: string): {
  label: string;
  bg: string;
  text: string;
} {
  switch (status) {
    case "DRAFT":
      return { label: "예정", bg: "bg-gray-100", text: "text-gray-700" };
    case "REVIEW":
      return { label: "검토중", bg: "bg-amber-100", text: "text-amber-800" };
    case "APPROVED":
      return { label: "승인", bg: "bg-sky-100", text: "text-sky-800" };
    case "PAID":
      return {
        label: "지급완료",
        bg: "bg-emerald-100",
        text: "text-emerald-800",
      };
    case "DISPUTED":
      return { label: "이의제기", bg: "bg-rose-100", text: "text-rose-700" };
    default:
      return { label: status, bg: "bg-gray-100", text: "text-gray-700" };
  }
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function loadSettlements(partnerId: string): Promise<SettlementRow[]> {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => {
                limit: (n: number) => Promise<{
                  data: SettlementRow[] | null;
                }>;
              };
            };
          };
        };
      }
    )
      .from("settlements")
      .select(
        "id, period_start, period_end, gross_sales, refunds, commission_rate, commission_amount, acorn_deduction, other_deductions, net_amount, status, paid_at, bank_account, account_holder",
      )
      .eq("partner_id", partnerId)
      .order("period_start", { ascending: false })
      .limit(24);
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function PartnerSettlementsPage() {
  const partner = await getPartner();
  if (!partner) redirect("/partner");

  const settlements = await loadSettlements(partner.id);

  const now = new Date();
  const thisMonthKey = monthKey(now);
  const thisMonth = settlements.find(
    (s) => monthKey(new Date(s.period_start)) === thisMonthKey,
  );

  // 최근 12개월 그리드
  const monthMap = new Map(
    settlements.map((s) => [monthKey(new Date(s.period_start)), s]),
  );
  const last12: { date: Date; row: SettlementRow | null }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    last12.push({ date: d, row: monthMap.get(monthKey(d)) ?? null });
  }

  const total12 = last12.reduce((s, x) => s + (x.row?.net_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/partner/billing"
          className="text-sm font-medium text-[#2D5A3D] hover:underline"
        >
          ← 결제 &amp; 정산
        </Link>
      </div>

      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[#2D5A3D]">
          <span>💸</span>
          <span>정산 내역</span>
        </h1>
        <p className="mt-1 text-sm text-[#6B6560]">
          매월 집계된 정산 내역과 지급 상태를 확인할 수 있어요 (읽기 전용).
        </p>
      </header>

      {/* 이번달 카드 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-gradient-to-br from-[#2D5A3D] to-[#4A7C59] p-6 text-white shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#D4E4BC]">
          This Month · {monthLabel(now)}
        </p>
        {thisMonth ? (
          <>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[11px] text-[#D4E4BC]">예상 정산액</p>
                <p className="mt-0.5 text-3xl font-extrabold md:text-4xl">
                  {wonKR(thisMonth.net_amount)}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusMeta(thisMonth.status).bg} ${statusMeta(thisMonth.status).text}`}
              >
                {statusMeta(thisMonth.status).label}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-white/10 p-3 text-[11px] md:grid-cols-4">
              <div>
                <p className="text-[#D4E4BC]">총 매출</p>
                <p className="font-bold">{wonKR(thisMonth.gross_sales)}</p>
              </div>
              <div>
                <p className="text-[#D4E4BC]">환불</p>
                <p className="font-bold">-{wonKR(thisMonth.refunds)}</p>
              </div>
              <div>
                <p className="text-[#D4E4BC]">
                  수수료 ({Math.round(thisMonth.commission_rate * 100)}%)
                </p>
                <p className="font-bold">
                  -{wonKR(thisMonth.commission_amount)}
                </p>
              </div>
              <div>
                <p className="text-[#D4E4BC]">도토리 차감</p>
                <p className="font-bold">-{wonKR(thisMonth.acorn_deduction)}</p>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-[#D4E4BC]">
            이번달 정산 내역이 아직 집계되지 않았어요.
          </p>
        )}
      </section>

      {/* 최근 12개월 그리드 */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#2D5A3D]">
            📊 최근 12개월
          </h2>
          <p className="text-[11px] text-[#6B6560]">
            총 {wonKR(total12)}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
          {last12.map(({ date, row }) => {
            const meta = row ? statusMeta(row.status) : null;
            return (
              <div
                key={monthKey(date)}
                className="rounded-xl border border-[#D4E4BC] bg-white p-3 text-center"
              >
                <p className="text-[10px] font-semibold text-[#8B6F47]">
                  {monthLabel(date)}
                </p>
                <p className="mt-1 text-sm font-extrabold text-[#2D5A3D]">
                  {row ? wonKR(row.net_amount) : "-"}
                </p>
                {meta && (
                  <span
                    className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold ${meta.bg} ${meta.text}`}
                  >
                    {meta.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 상세 리스트 */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-[#2D5A3D]">📋 월별 상세</h2>
        {settlements.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
            <span className="text-5xl" aria-hidden>
              🌱
            </span>
            <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
              아직 정산 내역이 없어요
            </p>
            <p className="mt-1 text-xs text-[#6B6560]">
              매월 말 자동 집계되어 이곳에 표시됩니다.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {settlements.map((s) => {
              const meta = statusMeta(s.status);
              return (
                <li
                  key={s.id}
                  className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm md:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-[#8B6F47]">
                        {new Date(s.period_start).toLocaleDateString("ko-KR")} ~{" "}
                        {new Date(s.period_end).toLocaleDateString("ko-KR")}
                      </p>
                      <p className="mt-1 text-xl font-extrabold text-[#2D5A3D]">
                        {wonKR(s.net_amount)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${meta.bg} ${meta.text}`}
                    >
                      {meta.label}
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-[#FFF8F0] p-3 text-[11px] md:grid-cols-4">
                    <div>
                      <dt className="text-[#8B6F47]">총 매출</dt>
                      <dd className="font-bold text-[#6B4423]">
                        {wonKR(s.gross_sales)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#8B6F47]">환불</dt>
                      <dd className="font-bold text-[#6B4423]">
                        -{wonKR(s.refunds)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#8B6F47]">
                        수수료 ({Math.round(s.commission_rate * 100)}%)
                      </dt>
                      <dd className="font-bold text-[#6B4423]">
                        -{wonKR(s.commission_amount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#8B6F47]">기타 공제</dt>
                      <dd className="font-bold text-[#6B4423]">
                        -
                        {wonKR(
                          (s.acorn_deduction ?? 0) + (s.other_deductions ?? 0),
                        )}
                      </dd>
                    </div>
                  </dl>

                  {s.paid_at && (
                    <p className="mt-2 text-[11px] text-emerald-700">
                      ✅ {new Date(s.paid_at).toLocaleString("ko-KR")} 지급 완료
                      {s.bank_account && ` · ${s.bank_account}`}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
