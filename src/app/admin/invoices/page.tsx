import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// ---- Types --------------------------------------------------------------

type InvoiceStatus =
  | "DRAFT"
  | "PENDING"
  | "PAID"
  | "CONFIRMED"
  | "EXPIRED"
  | "CANCELED"
  | "REFUNDED";

type TargetType =
  | "PARTNER"
  | "MANAGER"
  | "PARTICIPANT"
  | "ADVERTISER"
  | "AFFILIATE"
  | "ORG"
  | "B2B_CLIENT";

type Category =
  | "ACORN_RECHARGE"
  | "SUBSCRIPTION"
  | "EVENT_FEE"
  | "AD_CAMPAIGN"
  | "COUPON_FEE"
  | "B2B_CONTRACT"
  | "SETTLEMENT"
  | "REFUND"
  | "OTHER";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  target_type: TargetType;
  target_id: string;
  target_name: string | null;
  category: Category;
  amount: number;
  total_amount: number;
  status: InvoiceStatus;
  issued_at: string;
  expires_at: string;
  paid_at: string | null;
  reminder_count: number;
};

// ---- Labels -------------------------------------------------------------

const STATUS_LABEL: Record<
  InvoiceStatus,
  { label: string; dot: string; text: string; bg: string }
> = {
  DRAFT: { label: "초안", dot: "bg-gray-400", text: "text-gray-700", bg: "bg-gray-100" },
  PENDING: { label: "대기", dot: "bg-amber-500", text: "text-amber-800", bg: "bg-amber-100" },
  PAID: { label: "입금됨", dot: "bg-blue-500", text: "text-blue-800", bg: "bg-blue-100" },
  CONFIRMED: {
    label: "확인완료",
    dot: "bg-green-500",
    text: "text-green-800",
    bg: "bg-green-100",
  },
  EXPIRED: { label: "만료", dot: "bg-gray-400", text: "text-gray-600", bg: "bg-gray-100" },
  CANCELED: { label: "취소", dot: "bg-red-400", text: "text-red-700", bg: "bg-red-50" },
  REFUNDED: { label: "환불", dot: "bg-purple-500", text: "text-purple-800", bg: "bg-purple-100" },
};

const TARGET_LABEL: Record<TargetType, { label: string; emoji: string }> = {
  PARTNER: { label: "숲지기", emoji: "🏡" },
  MANAGER: { label: "기관", emoji: "🏢" },
  PARTICIPANT: { label: "참가자", emoji: "👤" },
  ADVERTISER: { label: "광고주", emoji: "📣" },
  AFFILIATE: { label: "가맹점", emoji: "🛍️" },
  ORG: { label: "단체", emoji: "🤝" },
  B2B_CLIENT: { label: "B2B 기업", emoji: "💼" },
};

const CATEGORY_LABEL: Record<Category, { label: string; emoji: string }> = {
  ACORN_RECHARGE: { label: "도토리 충전", emoji: "🌰" },
  SUBSCRIPTION: { label: "구독료", emoji: "🔁" },
  EVENT_FEE: { label: "행사 참가비", emoji: "🎫" },
  AD_CAMPAIGN: { label: "광고비", emoji: "📣" },
  COUPON_FEE: { label: "쿠폰 수수료", emoji: "🎟️" },
  B2B_CONTRACT: { label: "B2B 계약", emoji: "💼" },
  SETTLEMENT: { label: "정산", emoji: "💸" },
  REFUND: { label: "환불", emoji: "↩️" },
  OTHER: { label: "기타", emoji: "📄" },
};

function fmtKRW(n: number): string {
  return n.toLocaleString("ko-KR");
}

function fmtDate(iso: string | null | undefined): string {
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

function daysUntil(iso: string): number {
  const now = Date.now();
  const then = new Date(iso).getTime();
  return Math.ceil((then - now) / (1000 * 60 * 60 * 24));
}

// ---- Page ---------------------------------------------------------------

interface Props {
  searchParams: Promise<{
    status?: string;
    target_type?: string;
    category?: string;
  }>;
}

export default async function AdminInvoicesPage({ searchParams }: Props) {
  const params = await searchParams;
  const statusFilter = (params.status ?? "ALL") as InvoiceStatus | "ALL";
  const targetFilter = (params.target_type ?? "ALL") as TargetType | "ALL";
  const categoryFilter = (params.category ?? "ALL") as Category | "ALL";

  const supabase = await createClient();

  let rows: InvoiceRow[] = [];
  let tableMissing = false;

  try {
    const { data, error } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{
              data: InvoiceRow[] | null;
              error: { message: string; code?: string } | null;
            }>;
          };
        };
      }
    )
      .from("invoices")
      .select(
        "id, invoice_number, target_type, target_id, target_name, category, amount, total_amount, status, issued_at, expires_at, paid_at, reminder_count",
      )
      .order("issued_at", { ascending: false });

    if (error) {
      if (error.code === "42P01" || /relation .* does not exist/i.test(error.message)) {
        tableMissing = true;
      }
    } else {
      rows = data ?? [];
    }
  } catch {
    tableMissing = true;
  }

  const filtered = rows.filter((r) => {
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (targetFilter !== "ALL" && r.target_type !== targetFilter) return false;
    if (categoryFilter !== "ALL" && r.category !== categoryFilter) return false;
    return true;
  });

  // Stats (based on ALL rows, not filtered)
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const pendingCount = rows.filter((r) => r.status === "PENDING").length;
  const confirmedCount = rows.filter((r) => r.status === "CONFIRMED").length;
  const thisMonth = rows.filter((r) => r.issued_at >= thisMonthStart);
  const thisMonthCount = thisMonth.length;
  const thisMonthSum = thisMonth.reduce((acc, r) => acc + (r.total_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* 상단 네비 */}
      <div className="flex items-center justify-between">
        <Link href="/admin" className="text-sm font-medium text-[#2D5A3D] hover:underline">
          ← 대시보드
        </Link>
        {tableMissing && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
            DB 테이블 미존재
          </span>
        )}
      </div>

      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[#2D5A3D]">
            <span>📄</span>
            <span>청구서 관리</span>
          </h1>
          <p className="mt-1 text-sm text-[#6B6560]">
            숲지기·기관·광고주에게 발송한 청구서와 입금 현황을 관리하세요
          </p>
        </div>
        <Link
          href="/admin/invoices/new"
          className="whitespace-nowrap rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3A7A52]"
        >
          + 새 청구서 발송
        </Link>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
          <div className="text-xs font-medium text-[#8B6F47]">대기</div>
          <div className="mt-1 text-2xl font-bold text-amber-700">
            {fmtKRW(pendingCount)}
            <span className="ml-1 text-sm font-medium">건</span>
          </div>
        </div>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
          <div className="text-xs font-medium text-[#8B6F47]">완료</div>
          <div className="mt-1 text-2xl font-bold text-green-700">
            {fmtKRW(confirmedCount)}
            <span className="ml-1 text-sm font-medium">건</span>
          </div>
        </div>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
          <div className="text-xs font-medium text-[#8B6F47]">이번달</div>
          <div className="mt-1 text-2xl font-bold text-[#2D5A3D]">
            {fmtKRW(thisMonthCount)}
            <span className="ml-1 text-sm font-medium">건</span>
          </div>
        </div>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
          <div className="text-xs font-medium text-[#8B6F47]">이번달 총액</div>
          <div className="mt-1 text-2xl font-bold text-[#6B4423]">
            {fmtKRW(thisMonthSum)}
            <span className="ml-1 text-sm font-medium">원</span>
          </div>
        </div>
      </div>

      {/* 필터 */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#D4E4BC] bg-white p-4"
      >
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
            <option value="PENDING">대기</option>
            <option value="PAID">입금됨</option>
            <option value="CONFIRMED">확인완료</option>
            <option value="EXPIRED">만료</option>
            <option value="CANCELED">취소</option>
            <option value="REFUNDED">환불</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="f-target"
            className="block text-[11px] font-semibold text-[#8B6F47]"
          >
            대상
          </label>
          <select
            id="f-target"
            name="target_type"
            defaultValue={targetFilter}
            className="mt-1 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-1.5 text-sm focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          >
            <option value="ALL">전체</option>
            <option value="PARTNER">숲지기</option>
            <option value="MANAGER">기관</option>
            <option value="ADVERTISER">광고주</option>
            <option value="AFFILIATE">가맹점</option>
            <option value="B2B_CLIENT">B2B 기업</option>
            <option value="ORG">단체</option>
            <option value="PARTICIPANT">참가자</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="f-category"
            className="block text-[11px] font-semibold text-[#8B6F47]"
          >
            분류
          </label>
          <select
            id="f-category"
            name="category"
            defaultValue={categoryFilter}
            className="mt-1 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-1.5 text-sm focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          >
            <option value="ALL">전체</option>
            <option value="ACORN_RECHARGE">도토리 충전</option>
            <option value="SUBSCRIPTION">구독료</option>
            <option value="EVENT_FEE">행사 참가비</option>
            <option value="AD_CAMPAIGN">광고비</option>
            <option value="COUPON_FEE">쿠폰 수수료</option>
            <option value="B2B_CONTRACT">B2B 계약</option>
            <option value="SETTLEMENT">정산</option>
            <option value="REFUND">환불</option>
            <option value="OTHER">기타</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-xl border border-[#2D5A3D] bg-white px-3 py-1.5 text-sm font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
        >
          필터 적용
        </button>
        <Link
          href="/admin/invoices"
          className="text-xs text-[#8B6F47] underline-offset-2 hover:underline"
        >
          초기화
        </Link>

        <div className="ml-auto">
          <a
            href={`/api/admin/invoices/export${
              statusFilter !== "ALL" ? `?status=${statusFilter}` : ""
            }`}
            className="rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-1.5 text-xs font-semibold text-[#6B4423] hover:bg-[#F5E6D3]"
          >
            ⬇️ CSV 내보내기
          </a>
        </div>
      </form>

      {/* 리스트 */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-[#2D5A3D]">
          🧾 청구서 목록 ({fmtKRW(filtered.length)}건)
        </h2>

        {tableMissing ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            <div className="font-semibold">⚠️ invoices 테이블이 아직 준비되지 않았어요.</div>
            <p className="mt-1 text-xs">DB 마이그레이션을 먼저 실행해 주세요.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
            <div className="py-16 text-center">
              <span className="text-5xl">📭</span>
              <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
                조건에 맞는 청구서가 없어요
              </p>
              <p className="mt-1 text-xs text-[#6B6560]">
                필터를 바꾸거나 새 청구서를 발송해보세요
              </p>
              <Link
                href="/admin/invoices/new"
                className="mt-4 inline-block rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3A7A52]"
              >
                + 새 청구서 발송
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* 모바일 카드 */}
            <div className="space-y-2 md:hidden">
              {filtered.map((r) => {
                const s = STATUS_LABEL[r.status];
                const t = TARGET_LABEL[r.target_type];
                const c = CATEGORY_LABEL[r.category];
                const d2Exp = daysUntil(r.expires_at);
                return (
                  <Link
                    key={r.id}
                    href={`/admin/invoices/${r.id}`}
                    className="block rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm active:bg-[#FFF8F0]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text}`}
                          >
                            {s.label}
                          </span>
                          <span className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                            {c.emoji} {c.label}
                          </span>
                        </div>
                        <div className="mt-1 font-mono text-xs text-[#6B6560]">
                          {r.invoice_number}
                        </div>
                        <div className="mt-1 truncate font-bold text-[#2C2C2C]">
                          {t.emoji} {r.target_name ?? "(이름 없음)"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-[#2D5A3D]">
                          {fmtKRW(r.total_amount)}
                        </div>
                        <div className="text-[10px] text-[#8B6F47]">원</div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-[#8B6F47]">
                      <span>발송 {fmtDate(r.issued_at)}</span>
                      {r.status === "PENDING" && d2Exp > 0 && (
                        <span className="font-semibold text-amber-700">
                          만료까지 {d2Exp}일
                        </span>
                      )}
                      {r.status === "PENDING" && d2Exp <= 0 && (
                        <span className="font-semibold text-red-600">기한 경과</span>
                      )}
                      {r.status === "CONFIRMED" && (
                        <span className="text-green-700">✓ {fmtDate(r.paid_at)}</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* 데스크톱 테이블 */}
            <div className="hidden overflow-x-auto rounded-2xl border border-[#D4E4BC] bg-white md:block">
              <table className="w-full text-sm">
                <thead className="bg-[#F5E6D3]/40 text-left text-xs text-[#8B6F47]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">청구번호</th>
                    <th className="px-4 py-3 font-semibold">발송일</th>
                    <th className="px-4 py-3 font-semibold">대상</th>
                    <th className="px-4 py-3 font-semibold">분류</th>
                    <th className="px-4 py-3 text-right font-semibold">금액</th>
                    <th className="px-4 py-3 font-semibold">상태</th>
                    <th className="px-4 py-3 font-semibold">만료일</th>
                    <th className="px-4 py-3 font-semibold">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8F0E4]">
                  {filtered.map((r) => {
                    const s = STATUS_LABEL[r.status];
                    const t = TARGET_LABEL[r.target_type];
                    const c = CATEGORY_LABEL[r.category];
                    const d2Exp = daysUntil(r.expires_at);
                    return (
                      <tr key={r.id} className="hover:bg-[#FFF8F0]/40">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/invoices/${r.id}`}
                            className="font-mono text-xs text-[#2D5A3D] hover:underline"
                          >
                            {r.invoice_number}
                          </Link>
                          {r.reminder_count > 0 && (
                            <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                              독촉 {r.reminder_count}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#6B6560]">
                          {fmtDate(r.issued_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs">
                            <span className="rounded-full bg-[#E8F0E4] px-1.5 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                              {t.emoji} {t.label}
                            </span>
                          </div>
                          <div className="mt-0.5 font-semibold text-[#2C2C2C]">
                            {r.target_name ?? "(이름 없음)"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#6B4423]">
                          {c.emoji} {c.label}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-[#2D5A3D]">
                          {fmtKRW(r.total_amount)}원
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.bg} ${s.text}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {r.status === "PENDING" ? (
                            d2Exp > 0 ? (
                              <span className="text-amber-700">
                                {fmtDate(r.expires_at)} · D-{d2Exp}
                              </span>
                            ) : (
                              <span className="font-semibold text-red-600">경과</span>
                            )
                          ) : (
                            <span className="text-[#6B6560]">{fmtDate(r.expires_at)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/invoices/${r.id}`}
                            className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-1 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
                          >
                            상세
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
