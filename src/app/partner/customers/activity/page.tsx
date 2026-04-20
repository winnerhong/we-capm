import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { ActivityFilters } from "./activity-filters";

export const dynamic = "force-dynamic";

type ActivityEvent = {
  id: string;
  timestamp: string;
  actorType: "ORG" | "CUSTOMER" | "COMPANY" | "SYSTEM";
  actorName: string;
  action: "REGISTER" | "BOOKING" | "PAYMENT" | "REFUND" | "INQUIRY";
  target: string;
  href: string | null;
  amount?: number | null;
};

const ACTION_META: Record<
  ActivityEvent["action"],
  { icon: string; label: string; color: string }
> = {
  REGISTER: { icon: "🌱", label: "등록", color: "bg-violet-100 text-violet-700" },
  BOOKING: { icon: "📅", label: "예약", color: "bg-sky-100 text-sky-700" },
  PAYMENT: { icon: "💰", label: "결제", color: "bg-emerald-100 text-emerald-700" },
  REFUND: { icon: "↩️", label: "환불", color: "bg-rose-100 text-rose-700" },
  INQUIRY: { icon: "💬", label: "문의", color: "bg-amber-100 text-amber-700" },
};

const ACTOR_META: Record<
  ActivityEvent["actorType"],
  { icon: string; label: string }
> = {
  ORG: { icon: "🏫", label: "기관" },
  CUSTOMER: { icon: "👨‍👩‍👧", label: "개인" },
  COMPANY: { icon: "🏢", label: "기업" },
  SYSTEM: { icon: "⚙️", label: "시스템" },
};

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 60) return `${diffSec}초 전`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return `${diffDay}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

async function loadActivity(partnerId: string): Promise<ActivityEvent[]> {
  const supabase = await createClient();
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order?: (c: string, o: { ascending: boolean }) => {
            limit: (n: number) => Promise<{ data: unknown[] | null }>;
          };
        } & Promise<{ data: unknown[] | null }>;
      };
    };
  };

  const events: ActivityEvent[] = [];

  // 1) 등록 이벤트 (partner_orgs/customers/companies)
  const [orgsRes, custRes, coRes] = await Promise.all([
    client
      .from("partner_orgs")
      .select("id,org_name,created_at")
      .eq("partner_id", partnerId),
    client
      .from("partner_customers")
      .select("id,parent_name,parent_phone,created_at,last_visit_at,total_events,total_spent")
      .eq("partner_id", partnerId),
    client
      .from("partner_companies")
      .select("id,company_name,created_at,total_contracts,total_revenue")
      .eq("partner_id", partnerId),
  ]);

  ((orgsRes.data ?? []) as { id: string; org_name: string; created_at: string }[]).forEach(
    (r) => {
      events.push({
        id: `org-reg-${r.id}`,
        timestamp: r.created_at,
        actorType: "ORG",
        actorName: r.org_name,
        action: "REGISTER",
        target: "기관 고객 등록",
        href: `/partner/customers/org/${r.id}`,
      });
    }
  );
  ((custRes.data ?? []) as {
    id: string;
    parent_name: string;
    created_at: string;
    last_visit_at: string | null;
    total_events: number;
    total_spent: number;
  }[]).forEach((r) => {
    events.push({
      id: `cust-reg-${r.id}`,
      timestamp: r.created_at,
      actorType: "CUSTOMER",
      actorName: r.parent_name,
      action: "REGISTER",
      target: "개인 고객 등록",
      href: `/partner/customers/individual/${r.id}`,
    });
    if (r.last_visit_at && r.last_visit_at !== r.created_at) {
      events.push({
        id: `cust-visit-${r.id}`,
        timestamp: r.last_visit_at,
        actorType: "CUSTOMER",
        actorName: r.parent_name,
        action: "BOOKING",
        target: "최근 방문",
        href: `/partner/customers/individual/${r.id}`,
      });
    }
    if ((r.total_spent ?? 0) > 0 && r.last_visit_at) {
      events.push({
        id: `cust-pay-${r.id}`,
        timestamp: r.last_visit_at,
        actorType: "CUSTOMER",
        actorName: r.parent_name,
        action: "PAYMENT",
        target: "누적 결제",
        href: `/partner/customers/individual/${r.id}`,
        amount: r.total_spent,
      });
    }
  });
  ((coRes.data ?? []) as {
    id: string;
    company_name: string;
    created_at: string;
    total_contracts: number;
    total_revenue: number;
  }[]).forEach((r) => {
    events.push({
      id: `co-reg-${r.id}`,
      timestamp: r.created_at,
      actorType: "COMPANY",
      actorName: r.company_name,
      action: "REGISTER",
      target: "기업 고객 등록",
      href: `/partner/customers/corporate/${r.id}`,
    });
    if ((r.total_contracts ?? 0) > 0) {
      events.push({
        id: `co-con-${r.id}`,
        timestamp: r.created_at,
        actorType: "COMPANY",
        actorName: r.company_name,
        action: "BOOKING",
        target: `${r.total_contracts}건 계약`,
        href: `/partner/customers/corporate/${r.id}`,
        amount: r.total_revenue,
      });
    }
  });

  // 2) invoices (결제/환불)
  try {
    const invRes = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              order: (c: string, o: { ascending: boolean }) => {
                limit: (n: number) => Promise<{
                  data:
                    | {
                        id: string;
                        amount: number;
                        status: string;
                        issued_at: string;
                        paid_at: string | null;
                      }[]
                    | null;
                }>;
              };
            };
          };
        };
      }
    )
      .from("invoices")
      .select("id,amount,status,issued_at,paid_at")
      .eq("target_id", partnerId)
      .order("issued_at", { ascending: false })
      .limit(50);

    (invRes.data ?? []).forEach((r) => {
      if (r.status === "PAID" && r.paid_at) {
        events.push({
          id: `inv-pay-${r.id}`,
          timestamp: r.paid_at,
          actorType: "SYSTEM",
          actorName: "결제 시스템",
          action: "PAYMENT",
          target: `청구서 결제`,
          href: `/partner/billing/invoices/${r.id}`,
          amount: r.amount,
        });
      } else if (r.status === "REFUNDED") {
        events.push({
          id: `inv-ref-${r.id}`,
          timestamp: r.paid_at ?? r.issued_at,
          actorType: "SYSTEM",
          actorName: "결제 시스템",
          action: "REFUND",
          target: `청구서 환불`,
          href: `/partner/billing/invoices/${r.id}`,
          amount: r.amount,
        });
      } else {
        events.push({
          id: `inv-iss-${r.id}`,
          timestamp: r.issued_at,
          actorType: "SYSTEM",
          actorName: "결제 시스템",
          action: "BOOKING",
          target: `청구서 발행`,
          href: `/partner/billing/invoices/${r.id}`,
          amount: r.amount,
        });
      }
    });
  } catch {
    // invoices 테이블 없거나 오류 — 무시
  }

  // 최신순 정렬 + 상위 100건
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events.slice(0, 100);
}

function formatWon(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

export default async function ActivityTimelinePage() {
  const partner = await requirePartner();
  const events = await loadActivity(partner.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-teal-700 via-emerald-700 to-[#2D5A3D] p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100">
              Live Activity
            </p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold md:text-3xl">
              <span>📊</span>
              <span>실시간 활동</span>
            </h1>
            <p className="mt-1 text-sm text-emerald-100">
              고객 등록·예약·결제 이력을 한 곳에서 확인하세요. (최근 100건)
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
            <span>LIVE</span>
          </div>
        </div>
      </section>

      {/* 필터 + 타임라인 (클라이언트) */}
      <ActivityFilters
        events={events.map((e) => ({
          ...e,
          timeLabel: timeAgo(e.timestamp),
          fullTime: new Date(e.timestamp).toLocaleString("ko-KR"),
          actionLabel: ACTION_META[e.action].label,
          actionIcon: ACTION_META[e.action].icon,
          actionColor: ACTION_META[e.action].color,
          actorIcon: ACTOR_META[e.actorType].icon,
          actorLabel: ACTOR_META[e.actorType].label,
          amountLabel: e.amount != null ? formatWon(e.amount) : null,
        }))}
      />
    </div>
  );
}
