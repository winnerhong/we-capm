import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

type Invoice = {
  id: string;
  invoice_number: string;
  category: string;
  status: string;
  amount: number;
  vat: number;
  total_amount: number;
  description: string | null;
  created_at: string;
  expires_at: string | null;
  paid_at: string | null;
};

type Tab = "invoices" | "campaigns" | "monthly" | "receipts";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "invoices", label: "청구서", icon: "🧾" },
  { key: "campaigns", label: "캠페인 결제", icon: "📣" },
  { key: "monthly", label: "월별 정산", icon: "📅" },
  { key: "receipts", label: "영수증", icon: "🧷" },
];

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
  REFUNDED: {
    label: "환불",
    chip: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
  },
};

function formatWon(n: number | null | undefined): string {
  return `${(n ?? 0).toLocaleString("ko-KR")}원`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

async function loadAdvertiserInvoices(): Promise<Invoice[]> {
  try {
    const supabase = await createClient();
    const sb = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            order: (
              k: string,
              o: { ascending: boolean }
            ) => Promise<{ data: Invoice[] | null; error: unknown }>;
          };
        };
      };
    };
    const { data } = await sb
      .from("invoices")
      .select(
        "id, invoice_number, category, status, amount, vat, total_amount, description, created_at, expires_at, paid_at"
      )
      .eq("target_type", "ADVERTISER")
      .order("created_at", { ascending: false });
    return data ?? [];
  } catch {
    return [];
  }
}

function SuccessBanner({ created }: { created: boolean }) {
  if (!created) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900"
    >
      <span className="font-bold">청구서가 생성되었습니다.</span> 결제 후 도토리
      크레딧이 적립됩니다.
    </div>
  );
}

function ErrorBanner({ error }: { error?: string }) {
  if (!error) return null;
  const msg =
    error === "invoice_failed"
      ? "청구서 생성에 실패했습니다. 잠시 후 다시 시도해주세요."
      : "오류가 발생했습니다.";
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900"
    >
      {msg}
    </div>
  );
}

function TabBar({ active }: { active: Tab }) {
  return (
    <nav
      aria-label="결제 탭"
      className="flex gap-1 overflow-x-auto rounded-2xl border border-[#E5D3B8] bg-white p-1"
    >
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={`/ads-portal/billing?tab=${t.key}`}
            className={
              isActive
                ? "flex-1 min-w-max rounded-xl bg-gradient-to-r from-[#C4956A] to-[#8B6F47] px-3 py-2 text-center text-xs font-bold text-white shadow-sm"
                : "flex-1 min-w-max rounded-xl px-3 py-2 text-center text-xs font-semibold text-[#8B6F47] hover:bg-[#FFF8F0]"
            }
            aria-current={isActive ? "page" : undefined}
          >
            <span className="mr-1" aria-hidden>
              {t.icon}
            </span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

function StatusChip({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.DRAFT;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
      {meta.label}
    </span>
  );
}

function MonthlySummary({ invoices }: { invoices: Invoice[] }) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}`;
  const thisMonth = invoices.filter((i) =>
    (i.created_at ?? "").startsWith(ym)
  );
  const approved = thisMonth.reduce((s, i) => s + (i.amount ?? 0), 0);
  // 실집행액: 확정/결제된 건 합계
  const spent = thisMonth
    .filter((i) => i.status === "PAID" || i.status === "CONFIRMED")
    .reduce((s, i) => s + (i.amount ?? 0), 0);
  const remaining = Math.max(approved - spent, 0);

  const stats = [
    {
      label: "승인 예산",
      value: approved,
      hint: "이번달 총 캠페인 예산",
      icon: "📒",
      color: "from-[#FFF8F0] to-[#F5E6D3] border-[#E5D3B8] text-[#6B4423]",
    },
    {
      label: "실제 집행",
      value: spent,
      hint: "결제 완료 기준",
      icon: "💸",
      color: "from-[#F5F9EF] to-white border-[#D4E4BC] text-[#2D5A3D]",
    },
    {
      label: "남은 예산",
      value: remaining,
      hint: "집행 가능 잔액",
      icon: "🧚",
      color: "from-[#FAE7D0] to-white border-[#E8C9A0] text-[#8B6F47]",
    },
  ];

  return (
    <section aria-label="이번달 집행 현황">
      <div className="flex items-center justify-between px-1 pb-2">
        <h2 className="text-sm font-bold text-[#6B4423] flex items-center gap-1.5">
          <span aria-hidden>📊</span>
          <span>이번달 집행 현황</span>
        </h2>
        <span className="text-[10px] text-[#8B6F47] font-medium">
          {ym.replace("-", "년 ")}월
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-2xl border bg-gradient-to-br p-4 relative overflow-hidden ${s.color}`}
          >
            <div
              className="absolute top-2 right-2 text-3xl opacity-25 select-none"
              aria-hidden
            >
              {s.icon}
            </div>
            <p className="text-[11px] font-semibold opacity-80">{s.label}</p>
            <p className="mt-2 text-2xl font-extrabold">{formatWon(s.value)}</p>
            <p className="mt-1 text-[10px] opacity-70">{s.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function InvoicesTab({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E5D3B8] bg-white p-10 text-center">
        <div className="text-5xl" aria-hidden>
          🧾
        </div>
        <p className="mt-3 text-sm font-semibold text-[#6B4423]">
          아직 받은 청구서가 없어요
        </p>
        <p className="mt-1 text-xs text-[#8B6F47]">
          선수금을 충전하면 자동으로 청구서가 생성됩니다.
        </p>
        <Link
          href="/ads-portal/billing/prepay"
          className="mt-4 inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2 text-xs font-bold text-white shadow-sm hover:from-[#234a30] hover:to-[#2D5A3D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40"
        >
          선수금 충전하기
        </Link>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {invoices.map((inv) => (
        <li key={inv.id}>
          <Link
            href={`/ads-portal/billing/invoices/${inv.id}`}
            className="block rounded-2xl border border-[#E5D3B8] bg-white p-4 hover:border-[#C4956A] hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <StatusChip status={inv.status} />
                  <span className="text-[10px] text-[#8B6F47]">
                    {inv.invoice_number}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-bold text-[#6B4423] truncate">
                  {inv.description ?? "광고 청구서"}
                </p>
                <p className="mt-0.5 text-[11px] text-[#8B6F47]">
                  발행 {formatDate(inv.created_at)}
                  {inv.expires_at && <> · 만료 {formatDate(inv.expires_at)}</>}
                </p>
              </div>
              <div className="text-right">
                <p className="text-base font-extrabold text-[#6B4423]">
                  {formatWon(inv.total_amount)}
                </p>
                <p className="text-[10px] text-[#8B6F47]">VAT 포함</p>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CampaignsTab({ invoices }: { invoices: Invoice[] }) {
  const campaignInvoices = invoices.filter(
    (i) => i.category === "AD_CAMPAIGN"
  );
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-[#8B6F47] px-1">
        캠페인 집행 건별 청구·결제 내역입니다.
      </p>
      <InvoicesTab invoices={campaignInvoices} />
    </div>
  );
}

function MonthlyTab({ invoices }: { invoices: Invoice[] }) {
  const byMonth = new Map<string, { count: number; total: number }>();
  for (const inv of invoices) {
    const ym = (inv.created_at ?? "").slice(0, 7);
    if (!ym) continue;
    const prev = byMonth.get(ym) ?? { count: 0, total: 0 };
    byMonth.set(ym, {
      count: prev.count + 1,
      total: prev.total + (inv.total_amount ?? 0),
    });
  }
  const rows = Array.from(byMonth.entries()).sort((a, b) =>
    a[0] < b[0] ? 1 : -1
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E5D3B8] bg-white p-10 text-center">
        <div className="text-5xl" aria-hidden>
          📅
        </div>
        <p className="mt-3 text-sm font-semibold text-[#6B4423]">
          월별 정산 내역이 없습니다
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5D3B8] bg-white">
      <table className="w-full text-sm">
        <thead className="bg-[#FFF8F0] text-[11px] text-[#6B4423]">
          <tr>
            <th scope="col" className="px-4 py-2 text-left font-semibold">
              정산월
            </th>
            <th scope="col" className="px-4 py-2 text-right font-semibold">
              건수
            </th>
            <th scope="col" className="px-4 py-2 text-right font-semibold">
              합계
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([ym, agg]) => (
            <tr key={ym} className="border-t border-[#F0E4D2]">
              <td className="px-4 py-3 font-semibold text-[#6B4423]">
                {ym.replace("-", "년 ")}월
              </td>
              <td className="px-4 py-3 text-right text-[#8B6F47]">
                {agg.count}건
              </td>
              <td className="px-4 py-3 text-right font-extrabold text-[#6B4423]">
                {formatWon(agg.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReceiptsTab({ invoices }: { invoices: Invoice[] }) {
  const paid = invoices.filter(
    (i) => i.status === "PAID" || i.status === "CONFIRMED"
  );
  if (paid.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E5D3B8] bg-white p-10 text-center">
        <div className="text-5xl" aria-hidden>
          🧷
        </div>
        <p className="mt-3 text-sm font-semibold text-[#6B4423]">
          발급된 영수증이 없습니다
        </p>
        <p className="mt-1 text-xs text-[#8B6F47]">
          결제가 완료된 청구서에서 영수증/세금계산서를 발급할 수 있습니다.
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {paid.map((inv) => (
        <li
          key={inv.id}
          className="rounded-2xl border border-[#E5D3B8] bg-white p-4 flex items-center justify-between gap-3"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-[#8B6F47]">{inv.invoice_number}</p>
            <p className="mt-0.5 text-sm font-bold text-[#6B4423] truncate">
              {inv.description ?? "영수증"}
            </p>
            <p className="mt-0.5 text-[11px] text-[#8B6F47]">
              결제 {formatDate(inv.paid_at ?? inv.created_at)}
            </p>
          </div>
          <Link
            href={`/ads-portal/billing/invoices/${inv.id}`}
            className="rounded-lg border border-[#E5D3B8] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B4423] hover:bg-[#FFF8F0]"
          >
            보기
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PaymentMethodRegister() {
  return (
    <section
      aria-label="결제 방식 등록"
      className="rounded-2xl border border-[#E5D3B8] bg-white p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-[#6B4423] flex items-center gap-1.5">
          <span aria-hidden>💼</span>
          <span>결제 방식 등록</span>
        </h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Link
          href="/ads-portal/billing/prepay"
          className="group rounded-xl border-2 border-[#D4E4BC] bg-gradient-to-br from-[#F5F9EF] to-white p-4 hover:border-[#2D5A3D] hover:shadow-md transition-all"
        >
          <div className="flex items-start gap-3">
            <span className="text-3xl" aria-hidden>
              🌱
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-[#2D5A3D]">
                선결제 (선수금 충전)
              </h3>
              <p className="mt-1 text-[11px] text-[#6B6560] leading-relaxed">
                원하는 금액을 미리 충전하고 캠페인 집행에 사용합니다. 큰 금액
                충전 시 보너스 도토리가 추가 지급됩니다.
              </p>
              <p className="mt-2 text-[10px] font-semibold text-[#2D5A3D] group-hover:underline">
                충전하러 가기 →
              </p>
            </div>
          </div>
        </Link>
        <div
          className="rounded-xl border-2 border-dashed border-[#E5D3B8] bg-[#FFF8F0] p-4 opacity-70"
          aria-disabled="true"
        >
          <div className="flex items-start gap-3">
            <span className="text-3xl" aria-hidden>
              📆
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-[#6B4423]">
                후불 (월말 청구)
              </h3>
              <p className="mt-1 text-[11px] text-[#8B6F47] leading-relaxed">
                한 달 간 집행한 금액을 익월 초에 일괄 청구합니다. 월 500만원
                이상 집행 광고주 대상 심사 후 승인됩니다.
              </p>
              <p className="mt-2 text-[10px] font-semibold text-[#8B6F47]">
                Stage 2 오픈 후 신청 가능
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function AdsPortalBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; created?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const tab: Tab =
    sp?.tab === "campaigns" ||
    sp?.tab === "monthly" ||
    sp?.tab === "receipts" ||
    sp?.tab === "invoices"
      ? sp.tab
      : "invoices";

  const invoices = await loadAdvertiserInvoices();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/ads-portal/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">결제·청구</span>
      </nav>

      <Suspense fallback={null}>
        <SuccessBanner created={sp?.created === "1"} />
        <ErrorBanner error={sp?.error} />
      </Suspense>

      {/* 헤더 */}
      <section className="rounded-3xl bg-gradient-to-br from-[#C4956A] via-[#B0845A] to-[#8B6F47] p-6 text-white shadow-lg relative overflow-hidden">
        <div
          className="absolute -right-6 -top-6 text-[140px] opacity-10 select-none"
          aria-hidden
        >
          💳
        </div>
        <div className="relative z-10">
          <p className="text-[11px] tracking-[0.4em] opacity-80 font-light">
            BILLING
          </p>
          <h1 className="mt-1 text-2xl font-extrabold flex items-center gap-2">
            <span aria-hidden>💳</span>
            <span>광고주 결제</span>
          </h1>
          <p className="mt-2 text-sm opacity-95">
            청구서·캠페인 결제·월별 정산·영수증을 한곳에서 관리하세요.
          </p>
        </div>
      </section>

      {/* 이번달 집행 현황 */}
      <MonthlySummary invoices={invoices} />

      {/* 탭 */}
      <TabBar active={tab} />

      {/* 탭 컨텐츠 */}
      <section aria-label="청구 내역">
        {tab === "invoices" && <InvoicesTab invoices={invoices} />}
        {tab === "campaigns" && <CampaignsTab invoices={invoices} />}
        {tab === "monthly" && <MonthlyTab invoices={invoices} />}
        {tab === "receipts" && <ReceiptsTab invoices={invoices} />}
      </section>

      {/* 결제 방식 등록 */}
      <PaymentMethodRegister />

      {/* Stage 1 안내 */}
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-center gap-3"
      >
        <span className="text-xl flex-shrink-0" aria-hidden>
          ⏳
        </span>
        <p className="text-xs text-amber-900 leading-relaxed">
          <span className="font-bold">Stage 1 (프리뷰)</span> — 실제 결제와
          세금계산서 발행은 운영팀 확인 후 순차 처리됩니다.
        </p>
      </div>
    </div>
  );
}
