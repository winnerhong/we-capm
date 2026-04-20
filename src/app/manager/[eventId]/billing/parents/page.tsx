import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ParentBillingPanel } from "./parent-panel";

export const dynamic = "force-dynamic";

type Registration = {
  id: string;
  name: string;
  phone: string | null;
  created_at: string;
};

type InvoiceLite = {
  target_id: string;
  amount: number;
  total_amount: number;
  status: string;
  invoice_number: string;
  payment_link_token: string | null;
};

export default async function ParentBillingPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", eventId)
    .single();
  if (!event) notFound();

  const { data: regsData } = await supabase
    .from("event_registrations")
    .select("id, name, phone, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  const regs: Registration[] = ((regsData ?? []) as Registration[]).filter(
    (r) => !r.name.includes("선생님"),
  );

  // 참가비 청구서(미결제/결제)
  const phones = regs.map((r) => r.phone).filter((p): p is string => !!p);

  let invoices: InvoiceLite[] = [];
  if (phones.length > 0) {
    const sb = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              in: (k: string, v: string[]) => Promise<{
                data: InvoiceLite[] | null;
              }>;
            };
          };
        };
      };
    };
    try {
      const { data } = await sb
        .from("invoices")
        .select(
          "target_id, amount, total_amount, status, invoice_number, payment_link_token",
        )
        .eq("category", "EVENT_FEE")
        .eq("target_type", "PARTICIPANT")
        .in("target_id", phones);
      invoices = data ?? [];
    } catch {
      invoices = [];
    }
  }

  const invByPhone = new Map<string, InvoiceLite>();
  invoices.forEach((inv) => {
    const prev = invByPhone.get(inv.target_id);
    // PENDING을 우선
    if (!prev || (prev.status !== "PENDING" && inv.status === "PENDING")) {
      invByPhone.set(inv.target_id, inv);
    }
  });

  const rows = regs.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    invoice: r.phone ? invByPhone.get(r.phone) ?? null : null,
  }));

  const paidCount = rows.filter(
    (r) => r.invoice && (r.invoice.status === "CONFIRMED" || r.invoice.status === "PAID"),
  ).length;
  const unpaidCount = rows.filter(
    (r) => r.invoice && r.invoice.status === "PENDING",
  ).length;
  const notBilledCount = rows.filter((r) => !r.invoice).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-blue-800">
            <span aria-hidden>👨‍👩‍👧</span>
            <span>학부모 참가비</span>
          </h1>
          <p className="mt-1 text-sm text-[#6B6560]">
            {event.name} — 참가비 청구서 일괄 발급 & 수납 현황
          </p>
        </div>
        <Link
          href={`/manager/${eventId}/billing`}
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          ← 결제 허브
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-blue-100 bg-white p-4 text-center">
          <div className="text-[11px] text-[#6B6560]">등록 가족</div>
          <div className="mt-1 text-xl font-bold text-blue-800">{rows.length}명</div>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-center">
          <div className="text-[11px] text-emerald-700">결제 완료</div>
          <div className="mt-1 text-xl font-bold text-emerald-800">{paidCount}명</div>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-center">
          <div className="text-[11px] text-amber-700">미납</div>
          <div className="mt-1 text-xl font-bold text-amber-900">{unpaidCount}명</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-center">
          <div className="text-[11px] text-[#6B6560]">미발급</div>
          <div className="mt-1 text-xl font-bold text-[#2C2C2C]">{notBilledCount}명</div>
        </div>
      </div>

      <ParentBillingPanel
        eventId={eventId}
        eventName={event.name}
        rows={rows}
        unpaidCount={unpaidCount}
        notBilledCount={notBilledCount}
      />
    </div>
  );
}
