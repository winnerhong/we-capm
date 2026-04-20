import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requestTaxInvoiceAction } from "../../actions";

type Invoice = {
  id: string;
  invoice_number: string;
  category: string;
  status: string;
  amount: number;
  vat: number;
  total_amount: number;
  bonus_rate: number | null;
  bonus_amount: number | null;
  acorns_credited: number | null;
  description: string | null;
  memo: string | null;
  bank_account: string | null;
  payment_methods: string[] | null;
  created_at: string;
  expires_at: string | null;
  paid_at: string | null;
  target_name: string | null;
  metadata: Record<string, unknown> | null;
  tax_invoice_requested?: boolean | null;
};

const STATUS_META: Record<
  string,
  { label: string; chip: string; dot: string }
> = {
  DRAFT: {
    label: "초안",
    chip: "bg-[#F1EDE7] text-[#6B6560] border-[#E5D3B8]",
    dot: "bg-[#B5AFA8]",
  },
  PENDING: {
    label: "결제 대기",
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  PAID: {
    label: "결제 완료",
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  CONFIRMED: {
    label: "확정",
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  EXPIRED: {
    label: "만료",
    chip: "bg-zinc-100 text-zinc-600 border-zinc-200",
    dot: "bg-zinc-400",
  },
  CANCELED: {
    label: "취소",
    chip: "bg-zinc-100 text-zinc-600 border-zinc-200",
    dot: "bg-zinc-400",
  },
};

function formatWon(n: number | null | undefined): string {
  return `${(n ?? 0).toLocaleString("ko-KR")}원`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadInvoice(id: string): Promise<Invoice | null> {
  try {
    const supabase = await createClient();
    const sb = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: Invoice | null;
              error: unknown;
            }>;
          };
        };
      };
    };
    const { data } = await sb
      .from("invoices")
      .select(
        "id, invoice_number, category, status, amount, vat, total_amount, bonus_rate, bonus_amount, acorns_credited, description, memo, bank_account, payment_methods, created_at, expires_at, paid_at, target_name, metadata, tax_invoice_requested"
      )
      .eq("id", id)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

function StatusChip({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.DRAFT;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.chip}`}
    >
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden />
      {meta.label}
    </span>
  );
}

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; tax?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const invoice = await loadInvoice(id);

  if (!invoice) notFound();

  const submitAction = requestTaxInvoiceAction.bind(null, invoice.id);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/ads-portal/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/ads-portal/billing" className="hover:text-[#2D5A3D]">
          결제·청구
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">
          {invoice.invoice_number}
        </span>
      </nav>

      {sp?.created === "1" && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          청구서가 생성되었습니다. 아래 입금 안내를 참고해주세요.
        </div>
      )}
      {sp?.tax === "1" && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          세금계산서 발행 요청이 접수되었습니다. 영업일 기준 1~2일 이내에
          이메일로 발송됩니다.
        </div>
      )}

      {/* 청구서 본문 */}
      <article className="rounded-3xl border border-[#E5D3B8] bg-white shadow-sm overflow-hidden">
        <header className="bg-gradient-to-r from-[#FFF8F0] to-[#F5E6D3] px-6 py-5 border-b border-[#E5D3B8]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold tracking-[0.3em] text-[#8B6F47]">
                INVOICE
              </p>
              <h1 className="mt-1 text-xl font-extrabold text-[#6B4423]">
                {invoice.invoice_number}
              </h1>
              <p className="mt-1 text-xs text-[#8B6F47]">
                발행 {formatDateTime(invoice.created_at)}
              </p>
            </div>
            <StatusChip status={invoice.status} />
          </div>
        </header>

        <div className="px-6 py-5 space-y-4">
          <section>
            <p className="text-[11px] font-semibold text-[#8B6F47] mb-1">
              발행 대상
            </p>
            <p className="text-sm font-bold text-[#6B4423]">
              {invoice.target_name ?? "광고주"}
            </p>
          </section>

          <section>
            <p className="text-[11px] font-semibold text-[#8B6F47] mb-1">
              품목
            </p>
            <p className="text-sm text-[#6B4423]">
              {invoice.description ?? "광고 선수금 충전"}
            </p>
          </section>

          <div className="rounded-xl border border-[#E5D3B8] bg-[#FFF8F0] p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-[#6B4423]">
              <span>공급가액</span>
              <span className="font-semibold">{formatWon(invoice.amount)}</span>
            </div>
            <div className="flex justify-between text-[#6B4423]">
              <span>부가세 (10%)</span>
              <span className="font-semibold">{formatWon(invoice.vat)}</span>
            </div>
            {(invoice.bonus_amount ?? 0) > 0 && (
              <div className="flex justify-between text-[#2D5A3D]">
                <span>
                  보너스 (
                  {Math.round(((invoice.bonus_rate ?? 0) as number) * 100)}%)
                </span>
                <span className="font-semibold">
                  +{(invoice.bonus_amount ?? 0).toLocaleString("ko-KR")} 도토리
                </span>
              </div>
            )}
            <div className="border-t border-[#E5D3B8] pt-2 mt-2 flex justify-between items-baseline">
              <span className="text-sm font-bold text-[#6B4423]">
                총 결제 금액
              </span>
              <span className="text-xl font-extrabold text-[#6B4423]">
                {formatWon(invoice.total_amount)}
              </span>
            </div>
          </div>

          {invoice.bank_account && invoice.status === "PENDING" && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-[11px] font-semibold text-amber-800 mb-1">
                입금 계좌
              </p>
              <p className="text-sm font-bold text-amber-900">
                {invoice.bank_account}
              </p>
              {invoice.expires_at && (
                <p className="mt-1 text-[11px] text-amber-800">
                  입금 기한: {formatDateTime(invoice.expires_at)}
                </p>
              )}
            </section>
          )}
        </div>
      </article>

      {/* 세금계산서 요청 */}
      <section
        aria-label="세금계산서 요청"
        className="rounded-2xl border border-[#E5D3B8] bg-white p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[#6B4423] flex items-center gap-1.5">
            <span aria-hidden>🧾</span>
            <span>세금계산서 발행 요청</span>
          </h2>
          {invoice.tax_invoice_requested && (
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              요청 완료
            </span>
          )}
        </div>

        <form action={submitAction} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="business_number"
                className="block text-xs font-semibold text-[#6B4423] mb-1"
              >
                사업자등록번호 <span className="text-rose-600">*</span>
              </label>
              <input
                id="business_number"
                name="business_number"
                type="text"
                required
                inputMode="numeric"
                autoComplete="off"
                placeholder="000-00-00000"
                className="w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-sm text-[#6B4423] placeholder:text-[#C4B9AC] focus:border-[#8B6F47] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
              />
            </div>
            <div>
              <label
                htmlFor="company_name"
                className="block text-xs font-semibold text-[#6B4423] mb-1"
              >
                상호 <span className="text-rose-600">*</span>
              </label>
              <input
                id="company_name"
                name="company_name"
                type="text"
                required
                autoComplete="organization"
                defaultValue={invoice.target_name ?? ""}
                className="w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-sm text-[#6B4423] focus:border-[#8B6F47] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
              />
            </div>
            <div>
              <label
                htmlFor="ceo_name"
                className="block text-xs font-semibold text-[#6B4423] mb-1"
              >
                대표자명
              </label>
              <input
                id="ceo_name"
                name="ceo_name"
                type="text"
                autoComplete="name"
                className="w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-sm text-[#6B4423] focus:border-[#8B6F47] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-[#6B4423] mb-1"
              >
                수신 이메일 <span className="text-rose-600">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                inputMode="email"
                autoComplete="email"
                placeholder="tax@example.com"
                className="w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-sm text-[#6B4423] placeholder:text-[#C4B9AC] focus:border-[#8B6F47] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
              />
            </div>
            <div>
              <label
                htmlFor="business_type"
                className="block text-xs font-semibold text-[#6B4423] mb-1"
              >
                업태
              </label>
              <input
                id="business_type"
                name="business_type"
                type="text"
                className="w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-sm text-[#6B4423] focus:border-[#8B6F47] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
              />
            </div>
            <div>
              <label
                htmlFor="business_item"
                className="block text-xs font-semibold text-[#6B4423] mb-1"
              >
                종목
              </label>
              <input
                id="business_item"
                name="business_item"
                type="text"
                className="w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-sm text-[#6B4423] focus:border-[#8B6F47] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="address"
              className="block text-xs font-semibold text-[#6B4423] mb-1"
            >
              사업장 주소
            </label>
            <input
              id="address"
              name="address"
              type="text"
              autoComplete="street-address"
              className="w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-sm text-[#6B4423] focus:border-[#8B6F47] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40"
          >
            세금계산서 발행 요청
          </button>
        </form>
      </section>

      <div className="flex gap-2">
        <Link
          href="/ads-portal/billing"
          className="flex-1 rounded-xl border border-[#E5D3B8] bg-white px-4 py-2.5 text-center text-sm font-semibold text-[#6B4423] hover:bg-[#FFF8F0]"
        >
          목록으로
        </Link>
      </div>
    </div>
  );
}
