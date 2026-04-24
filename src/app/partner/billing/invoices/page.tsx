import Link from "next/link";
import { redirect } from "next/navigation";
import { getPartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  category: string;
  amount: number;
  total_amount: number;
  status: string;
  expires_at: string;
  issued_at: string;
  description: string | null;
};

type FilterKey = "all" | "pending" | "confirmed" | "expired";

const FILTERS: { key: FilterKey; label: string; statuses: string[] }[] = [
  { key: "all", label: "전체", statuses: [] },
  { key: "pending", label: "대기", statuses: ["PENDING"] },
  { key: "confirmed", label: "완료", statuses: ["PAID", "CONFIRMED"] },
  { key: "expired", label: "만료", statuses: ["EXPIRED", "CANCELED"] },
];

const CATEGORY_LABEL: Record<string, string> = {
  ACORN_RECHARGE: "도토리 충전",
  SUBSCRIPTION: "구독료",
  EVENT_FEE: "행사 비용",
  AD_CAMPAIGN: "광고 캠페인",
  COUPON_FEE: "쿠폰 수수료",
  B2B_CONTRACT: "B2B 계약",
  SETTLEMENT: "정산",
  REFUND: "환불",
  OTHER: "기타",
};

function wonKR(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function statusMeta(status: string): {
  label: string;
  bg: string;
  text: string;
  ring: string;
} {
  switch (status) {
    case "PENDING":
      return {
        label: "대기",
        bg: "bg-amber-100",
        text: "text-amber-800",
        ring: "border-amber-200",
      };
    case "PAID":
    case "CONFIRMED":
      return {
        label: "완료",
        bg: "bg-emerald-100",
        text: "text-emerald-800",
        ring: "border-emerald-200",
      };
    case "EXPIRED":
      return {
        label: "만료",
        bg: "bg-gray-100",
        text: "text-gray-700",
        ring: "border-gray-200",
      };
    case "CANCELED":
      return {
        label: "취소",
        bg: "bg-rose-100",
        text: "text-rose-700",
        ring: "border-rose-200",
      };
    case "REFUNDED":
      return {
        label: "환불",
        bg: "bg-sky-100",
        text: "text-sky-700",
        ring: "border-sky-200",
      };
    default:
      return {
        label: status,
        bg: "bg-gray-100",
        text: "text-gray-700",
        ring: "border-gray-200",
      };
  }
}

async function loadInvoices(
  partnerId: string,
  filter: FilterKey,
): Promise<InvoiceRow[]> {
  const supabase = await createClient();
  const statuses = FILTERS.find((f) => f.key === filter)?.statuses ?? [];

  try {
    if (statuses.length === 0) {
      const { data } = await (
        supabase as unknown as {
          from: (t: string) => {
            select: (c: string) => {
              eq: (k: string, v: string) => {
                eq: (k: string, v: string) => {
                  order: (
                    col: string,
                    opts: { ascending: boolean },
                  ) => Promise<{ data: InvoiceRow[] | null }>;
                };
              };
            };
          };
        }
      )
        .from("invoices")
        .select(
          "id, invoice_number, category, amount, total_amount, status, expires_at, issued_at, description",
        )
        .eq("target_type", "PARTNER")
        .eq("target_id", partnerId)
        .order("issued_at", { ascending: false });
      return data ?? [];
    }

    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: string) => {
                in: (k: string, v: string[]) => {
                  order: (
                    col: string,
                    opts: { ascending: boolean },
                  ) => Promise<{ data: InvoiceRow[] | null }>;
                };
              };
            };
          };
        };
      }
    )
      .from("invoices")
      .select(
        "id, invoice_number, category, amount, total_amount, status, expires_at, issued_at, description",
      )
      .eq("target_type", "PARTNER")
      .eq("target_id", partnerId)
      .in("status", statuses)
      .order("issued_at", { ascending: false });
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function PartnerInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const partner = await getPartner();
  if (!partner) redirect("/partner");

  const sp = await searchParams;
  const filter: FilterKey =
    (sp.filter as FilterKey) && FILTERS.some((f) => f.key === sp.filter)
      ? (sp.filter as FilterKey)
      : "all";

  const invoices = await loadInvoices(partner.id, filter);

  return (
    <div className="space-y-5">
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
          <span>🧾</span>
          <span>청구서</span>
        </h1>
        <p className="mt-1 text-sm text-[#6B6560]">
          숲지기님께 발행된 모든 청구서를 확인하고 결제할 수 있어요.
        </p>
      </header>

      {/* 필터 탭 */}
      <div
        role="tablist"
        aria-label="청구서 상태 필터"
        className="flex gap-2 overflow-x-auto rounded-2xl border border-[#D4E4BC] bg-white p-1.5 shadow-sm"
      >
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Link
              key={f.key}
              href={`/partner/billing/invoices?filter=${f.key}`}
              role="tab"
              aria-selected={active}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-[#2D5A3D] text-white"
                  : "text-[#6B6560] hover:bg-[#FFF8F0]"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* 티켓 카드 리스트 */}
      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <span className="text-5xl" aria-hidden>
            📭
          </span>
          <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
            청구서가 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            도토리를 충전하거나 행사를 운영하면 청구서가 발행돼요.
          </p>
          <Link
            href="/partner/billing/acorns"
            className="mt-4 inline-block rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3A7A52]"
          >
            <AcornIcon /> 도토리 충전하러 가기
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {invoices.map((inv) => {
            const meta = statusMeta(inv.status);
            const clickable = inv.status === "PENDING";
            return (
              <li key={inv.id}>
                <Link
                  href={`/partner/billing/invoices/${inv.id}`}
                  className={`group block overflow-hidden rounded-2xl border-2 border-dashed ${meta.ring} bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] p-5 shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#3A7A52]`}
                  aria-label={`청구서 ${inv.invoice_number} 상세 보기`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.bg} ${meta.text}`}
                        >
                          {meta.label}
                        </span>
                        <span className="text-[10px] font-semibold text-[#8B6F47]">
                          {CATEGORY_LABEL[inv.category] ?? inv.category}
                        </span>
                      </div>
                      <p className="mt-1.5 truncate text-base font-bold text-[#6B4423]">
                        {inv.description ?? inv.invoice_number}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-[#8B6F47]">
                        {inv.invoice_number}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-extrabold text-[#6B4423]">
                        {wonKR(inv.total_amount)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[#8B6F47]">
                        공급가 {wonKR(inv.amount)}
                      </p>
                    </div>
                  </div>

                  {/* 점선 구분 */}
                  <div
                    aria-hidden
                    className="my-3 border-t border-dashed border-[#C4956A]/40"
                  />

                  <div className="flex items-center justify-between text-[11px] text-[#8B6F47]">
                    <span>
                      발행{" "}
                      {new Date(inv.issued_at).toLocaleDateString("ko-KR")}
                    </span>
                    <span>
                      만기{" "}
                      {new Date(inv.expires_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>

                  {clickable && (
                    <div className="mt-3">
                      <span className="inline-flex items-center justify-center rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-semibold text-white group-hover:bg-[#3A7A52]">
                        결제하기 →
                      </span>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
