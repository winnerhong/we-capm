import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  classifyCoupon,
  toCouponView,
  type CouponRow,
} from "../types";
import { CouponForm, type CouponFormInitial } from "../new/coupon-form";
import {
  deleteCouponAction,
  duplicateCouponAction,
  toggleCouponActiveAction,
} from "../actions";

export const dynamic = "force-dynamic";

async function loadCoupon(id: string): Promise<CouponRow | null> {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase.from("coupons" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: CouponRow | null }>;
          };
        };
      }
    )
      .select(
        "id,affiliate_name,affiliate_phone,title,description,discount_type,discount_value,min_amount,category,valid_from,valid_until,max_uses,used_count,status,created_at"
      )
      .eq("id", id)
      .maybeSingle();

    return data ?? null;
  } catch {
    return null;
  }
}

// DB의 "PERCENT" | "AMOUNT" | "FREE" → UI의 "PERCENT" | "FIXED"
function toUiDiscountType(db: string): "PERCENT" | "FIXED" {
  return db === "PERCENT" ? "PERCENT" : "FIXED";
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export default async function EditCouponPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePartner();
  const { id } = await params;
  const row = await loadCoupon(id);
  if (!row) notFound();

  const view = toCouponView(row);
  const state = classifyCoupon(row);
  const conversionRate =
    view.used_count > 0 && view.max_uses
      ? Math.round((view.used_count / view.max_uses) * 100)
      : 0;

  const initial: CouponFormInitial = {
    id: view.id,
    name: view.name,
    code: view.code,
    coupon_type: view.coupon_type,
    discount_type: toUiDiscountType(view.discount_type),
    discount_value: view.discount_value ?? "",
    min_amount: view.min_amount ?? "",
    max_discount: view.max_discount ?? "",
    usage_limit: view.max_uses ?? "",
    per_user_limit: view.per_user_limit ?? 1,
    starts_at: toDatetimeLocal(view.valid_from),
    ends_at: toDatetimeLocal(view.valid_until),
    auto_issue: view.auto_issue,
    description: view.plain_description,
  };

  const toggleForm = toggleCouponActiveAction.bind(null, view.id, !view.is_active);
  const dupForm = duplicateCouponAction.bind(null, view.id);
  const delForm = deleteCouponAction.bind(null, view.id);

  const stateLabel: Record<
    "active" | "expired" | "upcoming" | "inactive",
    { label: string; cls: string }
  > = {
    active: { label: "활성", cls: "bg-[#D4E4BC] text-[#2D5A3D]" },
    upcoming: { label: "예정", cls: "bg-amber-100 text-amber-800" },
    expired: { label: "만료", cls: "bg-[#F5F1E8] text-[#8B7F75]" },
    inactive: { label: "비활성", cls: "bg-[#F5F1E8] text-[#6B6560]" },
  };
  const badge = stateLabel[state];

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-1 py-2">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-1">/</span>
        <Link href="/partner/marketing/coupons" className="hover:text-[#2D5A3D]">
          쿠폰 &amp; 프로모션
        </Link>
        <span className="mx-1">/</span>
        <span className="text-[#2D5A3D]">쿠폰 수정</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#2D5A3D] md:text-3xl">
            <span aria-hidden>✏️</span>
            <span className="truncate">{view.name}</span>
            <span
              className={`ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}
            >
              {badge.label}
            </span>
          </h1>
          {view.code ? (
            <p className="mt-1 font-mono text-xs text-[#6B6560]">
              코드 {view.code}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={toggleForm}>
            <button
              type="submit"
              className={[
                "inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#C4956A] focus:ring-offset-2",
                view.is_active
                  ? "bg-[#E8F0E4] text-[#2D5A3D] hover:bg-[#D4E4BC]"
                  : "bg-[#F5F1E8] text-[#6B6560] hover:bg-[#E8E4DC]",
              ].join(" ")}
            >
              {view.is_active ? "🟢 활성 ON" : "⚪ 비활성"}
            </button>
          </form>
          <form action={dupForm}>
            <button
              type="submit"
              className="inline-flex items-center rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#2D5A3D] transition hover:bg-[#F5F9F3]"
            >
              📋 복제
            </button>
          </form>
          <form action={delForm}>
            <button
              type="submit"
              className="inline-flex items-center rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
            >
              🗑️ 삭제
            </button>
          </form>
        </div>
      </header>

      {/* 통계 */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="발행 한도" value={view.max_uses != null ? view.max_uses.toLocaleString("ko-KR") : "무제한"} icon="📦" />
        <Stat label="사용 건수" value={view.used_count.toLocaleString("ko-KR")} icon="🎟️" />
        <Stat
          label="잔여"
          value={
            view.max_uses != null
              ? Math.max(0, view.max_uses - view.used_count).toLocaleString("ko-KR")
              : "∞"
          }
          icon="🧮"
        />
        <Stat
          label="전환율"
          value={view.max_uses ? `${conversionRate}%` : "-"}
          icon="📈"
        />
      </section>

      <CouponForm mode="edit" initial={initial} />
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-1 text-[11px] font-semibold text-[#6B6560]">
        <span aria-hidden>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-1 text-2xl font-bold text-[#2D5A3D]">{value}</div>
    </div>
  );
}
