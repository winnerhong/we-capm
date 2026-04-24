import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
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
  target_type: string;
  target_id: string;
  description: string | null;
  created_at: string;
  expires_at: string | null;
  paid_at: string | null;
  payment_link_token: string | null;
};

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "작성중", cls: "bg-neutral-100 text-neutral-700" },
  PENDING: { label: "미결제", cls: "bg-amber-100 text-amber-800" },
  PAID: { label: "결제완료", cls: "bg-blue-100 text-blue-700" },
  CONFIRMED: { label: "확정", cls: "bg-emerald-100 text-emerald-800" },
  EXPIRED: { label: "만료", cls: "bg-neutral-100 text-neutral-500" },
  CANCELED: { label: "취소", cls: "bg-neutral-100 text-neutral-500" },
  REFUNDED: { label: "환불", cls: "bg-rose-100 text-rose-800" },
};

const CATEGORY_LABEL: Record<string, ReactNode> = {
  ACORN_RECHARGE: (
    <span className="inline-flex items-center gap-1">
      <AcornIcon size={14} /> 도토리 충전
    </span>
  ),
  SUBSCRIPTION: "🗓 구독료",
  EVENT_FEE: "🎟 행사 참가비",
  AD_CAMPAIGN: "📣 광고",
  COUPON_FEE: "🎫 쿠폰",
  B2B_CONTRACT: "💼 B2B",
  SETTLEMENT: "💸 정산",
  REFUND: "↩️ 환불",
  OTHER: "기타",
};

async function fetchInvoices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
): Promise<InvoiceRow[]> {
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        in: (k: string, v: string[]) => {
          eq: (k: string, v: string) => {
            order: (
              k: string,
              o: { ascending: boolean },
            ) => Promise<{ data: InvoiceRow[] | null; error: unknown }>;
          };
        };
      };
    };
  };

  try {
    const { data } = await sb
      .from("invoices")
      .select(
        "id, invoice_number, category, amount, total_amount, status, target_type, target_id, description, created_at, expires_at, paid_at, payment_link_token",
      )
      .in("target_type", ["MANAGER", "ORG"])
      .eq("target_id", eventId)
      .order("created_at", { ascending: false });
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function BillingHubPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, start_at")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  // 집계
  const [{ count: familyCount }, { count: missionCount }] = await Promise.all([
    supabase
      .from("event_registrations")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId),
    supabase
      .from("missions")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("is_active", true),
  ]);

  // 도토리 잔액 (event 메타에 쌓인다고 가정 → 없으면 0)
  const sbEvent = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { acorn_balance: number | null } | null;
          }>;
        };
      };
    };
  };
  let acornBalance = 0;
  try {
    const { data: evExtra } = await sbEvent
      .from("events")
      .select("acorn_balance")
      .eq("id", eventId)
      .maybeSingle();
    acornBalance = evExtra?.acorn_balance ?? 0;
  } catch {
    acornBalance = 0;
  }

  const AVG_ACORN_PER_MISSION = 10;
  const MISSIONS_EXPECTED = Math.max(missionCount ?? 5, 5);
  const estimatedNeed =
    (familyCount ?? 0) * MISSIONS_EXPECTED * AVG_ACORN_PER_MISSION;
  const shortageRate =
    estimatedNeed > 0
      ? Math.max(0, Math.round(((estimatedNeed - acornBalance) / estimatedNeed) * 100))
      : 0;
  const isShort = shortageRate > 10;

  const invoices = await fetchInvoices(supabase, eventId);
  const pending = invoices.filter(
    (i) => i.status === "PENDING" || i.status === "DRAFT",
  );
  const paidHistory = invoices.filter(
    (i) => i.status === "CONFIRMED" || i.status === "PAID",
  );
  const pendingTotal = pending.reduce((s, i) => s + (i.total_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-blue-800">
            <span aria-hidden>💰</span>
            <span>행사 비용 관리</span>
          </h1>
          <p className="mt-1 text-sm text-[#6B6560]">
            {event.name} — 결제 & 도토리 & 참가비 한눈에
          </p>
        </div>
        <Link
          href={`/manager/${eventId}`}
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          ← 대시보드
        </Link>
      </div>

      {/* 상단 Stats */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
          <div className="text-xs font-semibold text-blue-700">행사 예상 비용</div>
          <div className="mt-2 inline-flex items-center gap-1.5 text-2xl font-bold text-[#2D5A3D]">
            <AcornIcon size={20} /> {estimatedNeed.toLocaleString("ko-KR")}
            <span className="ml-1 text-xs font-normal text-[#6B6560]">도토리</span>
          </div>
          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#6B6560]">
            가족 {familyCount ?? 0}명 × 미션 {MISSIONS_EXPECTED}개 × 평균 {AVG_ACORN_PER_MISSION}<AcornIcon />
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
          <div className="text-xs font-semibold text-emerald-700">충전된 도토리</div>
          <div className="mt-2 inline-flex items-center gap-1.5 text-2xl font-bold text-[#2D5A3D]">
            <AcornIcon size={20} /> {acornBalance.toLocaleString("ko-KR")}
          </div>
          <div className="mt-1 text-[11px] text-[#6B6560]">
            이번 행사에 배정된 잔액
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
          <div className="text-xs font-semibold text-amber-700">미결제 청구서</div>
          <div className="mt-2 text-2xl font-bold text-amber-900">
            {pending.length}
            <span className="ml-1 text-xs font-normal text-[#6B6560]">건</span>
          </div>
          <div className="mt-1 text-[11px] text-[#6B6560]">
            총 {pendingTotal.toLocaleString("ko-KR")}원
          </div>
        </div>
      </div>

      {/* 탭 바로가기 */}
      <div className="grid grid-cols-3 gap-2">
        <Link
          href={`/manager/${eventId}/billing/acorns`}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-100 bg-white p-3 text-center text-sm font-semibold text-blue-800 shadow-sm transition-shadow hover:shadow-md"
        >
          <AcornIcon /> 도토리 충전
        </Link>
        <Link
          href={`/manager/${eventId}/billing/parents`}
          className="rounded-xl border border-blue-100 bg-white p-3 text-center text-sm font-semibold text-blue-800 shadow-sm transition-shadow hover:shadow-md"
        >
          👨‍👩‍👧 학부모 청구
        </Link>
        <a
          href="#history"
          className="rounded-xl border border-blue-100 bg-white p-3 text-center text-sm font-semibold text-blue-800 shadow-sm transition-shadow hover:shadow-md"
        >
          📜 결제 이력
        </a>
      </div>

      {/* 부족 경고 */}
      {isShort && (
        <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-rose-800">
            <span aria-hidden>⚠️</span>
            <span>도토리가 {shortageRate}% 부족해요</span>
          </div>
          <p className="mt-1 text-xs text-rose-700">
            예상보다 잔액이 모자라요. 지금 충전하지 않으면 행사 중 보상 지급이 멈출 수 있어요.
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href={`/manager/${eventId}/billing/acorns`}
              className="inline-block rounded-lg bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-700"
            >
              지금 충전하기 →
            </Link>
            <Link
              href={`/manager/${eventId}/billing#support`}
              className="inline-block rounded-lg border border-rose-300 bg-white px-4 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
            >
              본사 지원 요청
            </Link>
          </div>
        </div>
      )}

      {/* 받은 청구서 */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-blue-800">
          <span aria-hidden>🧾</span>
          <span>받은 청구서 ({pending.length})</span>
        </h2>
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-8 text-center">
            <div className="text-3xl" aria-hidden>✨</div>
            <p className="mt-2 text-sm font-semibold text-[#2D5A3D]">미결제 청구서가 없어요</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {pending.map((inv) => {
              const status = STATUS_STYLE[inv.status] ?? STATUS_STYLE.PENDING;
              const expSoon =
                inv.expires_at &&
                new Date(inv.expires_at).getTime() - Date.now() < 48 * 3600_000;
              return (
                <li
                  key={inv.id}
                  className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm md:flex md:items-center md:justify-between md:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        {CATEGORY_LABEL[inv.category] ?? inv.category}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}
                      >
                        {status.label}
                      </span>
                      {expSoon && (
                        <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                          마감임박
                        </span>
                      )}
                    </div>
                    <div className="mt-1 truncate font-semibold text-[#2C2C2C]">
                      {inv.description || "행사 관련 청구서"}
                    </div>
                    <div className="mt-1 text-[11px] text-[#6B6560]">
                      #{inv.invoice_number} ·{" "}
                      {new Date(inv.created_at).toLocaleString("ko-KR", {
                        month: "long",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 md:mt-0 md:justify-end">
                    <div className="text-right">
                      <div className="text-xl font-bold text-blue-800">
                        {inv.total_amount.toLocaleString("ko-KR")}
                        <span className="ml-0.5 text-xs font-normal text-[#6B6560]">원</span>
                      </div>
                      <div className="text-[11px] text-[#6B6560]">VAT 포함</div>
                    </div>
                    <Link
                      href={
                        inv.payment_link_token
                          ? `/pay/${inv.payment_link_token}`
                          : `/manager/${eventId}/billing`
                      }
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      결제하기
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 본사 지원 요청 */}
      <section id="support" className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-bold text-blue-800">
          <span aria-hidden>🤝</span>
          <span>본사에 도토리 지원 요청</span>
        </h3>
        <p className="mt-1 text-xs text-[#6B6560]">
          보조금이나 후원이 필요할 때 운영팀에 메시지를 남겨주세요. 영업일 기준 1–2일 내 답변드려요.
        </p>
        <form
          action={async (formData: FormData) => {
            "use server";
            const { requestSupportAction } = await import("./actions");
            await requestSupportAction(eventId, (formData.get("message") as string) ?? "");
          }}
          className="mt-3 space-y-2"
        >
          <label htmlFor="support-msg" className="sr-only">지원 요청 내용</label>
          <textarea
            id="support-msg"
            name="message"
            required
            minLength={5}
            maxLength={500}
            rows={3}
            placeholder="예: 학생 40명 참가 예정인데 도토리 보조가 필요합니다."
            className="w-full rounded-lg border border-blue-100 bg-blue-50/30 p-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            type="submit"
            className="rounded-lg border border-blue-200 bg-white px-4 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            요청 보내기
          </button>
        </form>
      </section>

      {/* 결제 이력 */}
      <section id="history">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-blue-800">
          <span aria-hidden>📜</span>
          <span>결제 이력 ({paidHistory.length})</span>
        </h2>
        {paidHistory.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-8 text-center">
            <p className="text-sm text-[#6B6560]">아직 결제 이력이 없어요</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-blue-50 text-blue-800">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">청구번호</th>
                  <th className="px-3 py-2 text-left font-semibold">항목</th>
                  <th className="px-3 py-2 text-right font-semibold">금액</th>
                  <th className="px-3 py-2 text-right font-semibold">결제일</th>
                </tr>
              </thead>
              <tbody>
                {paidHistory.map((inv) => (
                  <tr key={inv.id} className="border-t border-blue-50">
                    <td className="px-3 py-2 font-mono text-[11px] text-[#6B6560]">
                      {inv.invoice_number}
                    </td>
                    <td className="px-3 py-2 text-[#2C2C2C]">
                      {CATEGORY_LABEL[inv.category] ?? inv.category}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-[#2C2C2C]">
                      {inv.total_amount.toLocaleString("ko-KR")}원
                    </td>
                    <td className="px-3 py-2 text-right text-[11px] text-[#6B6560]">
                      {inv.paid_at
                        ? new Date(inv.paid_at).toLocaleDateString("ko-KR")
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
