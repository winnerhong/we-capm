import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  COUPON_TYPES,
  classifyCoupon,
  formatDiscount,
  toCouponView,
  type CouponRow,
  type CouponView,
} from "./types";
import {
  deleteCouponAction,
  duplicateCouponAction,
  toggleCouponActiveAction,
} from "./actions";

export const dynamic = "force-dynamic";

type TabKey = "active" | "upcoming" | "expired" | "inactive";

const TAB_META: Record<TabKey, { label: string; icon: string }> = {
  active: { label: "활성", icon: "🟢" },
  upcoming: { label: "예정", icon: "🕒" },
  expired: { label: "만료", icon: "⌛" },
  inactive: { label: "비활성", icon: "🌙" },
};

const RECOMMENDED = [
  {
    icon: "🏕️",
    title: "주말 한정 10% 할인",
    desc: "금·토·일 예약 시 자동 할인",
    params: {
      type: "SEASONAL",
      name: "주말 한정 10%",
      discount_type: "PERCENT",
      discount_value: "10",
    },
  },
  {
    icon: "👨‍👩‍👧‍👦",
    title: "단체 5인 이상 15% 할인",
    desc: "가족·모임 예약을 늘려요",
    params: {
      type: "GROUP",
      name: "단체 5인 15%",
      discount_type: "PERCENT",
      discount_value: "15",
    },
  },
  {
    icon: "🎂",
    title: "생일 쿠폰 자동 발급",
    desc: "생일 주간 자동 문자 발송",
    params: {
      type: "BIRTHDAY",
      name: "생일 축하 5,000원",
      discount_type: "FIXED",
      discount_value: "5000",
      auto_issue: "on",
    },
  },
] as const;

function buildQuery(
  params: Record<string, string | undefined>
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function loadCoupons(partnerName: string): Promise<CouponView[]> {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase.from("coupons" as never) as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<{ data: CouponRow[] | null }>;
          };
        };
      }
    )
      .select(
        "id,affiliate_name,affiliate_phone,title,description,discount_type,discount_value,min_amount,category,valid_from,valid_until,max_uses,used_count,status,created_at"
      )
      .eq("affiliate_name", partnerName)
      .order("created_at", { ascending: false });

    const rows = (data ?? []) as CouponRow[];
    return rows.map(toCouponView);
  } catch {
    return [];
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "2-digit",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "-";
  }
}

export default async function PartnerCouponsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const partner = await requirePartner();
  const sp = await searchParams;
  const activeTab: TabKey = (["active", "upcoming", "expired", "inactive"] as TabKey[]).includes(
    (sp?.tab as TabKey) ?? "active"
  )
    ? ((sp?.tab as TabKey) ?? "active")
    : "active";

  const all = await loadCoupons(partner.name);
  const buckets: Record<TabKey, CouponView[]> = {
    active: [],
    upcoming: [],
    expired: [],
    inactive: [],
  };
  for (const c of all) {
    buckets[classifyCoupon(c)].push(c);
  }
  const list = buckets[activeTab];

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-1 py-2">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-1">/</span>
        <Link href="/partner/marketing" className="hover:text-[#2D5A3D]">
          마케팅 센터
        </Link>
        <span className="mx-1">/</span>
        <span className="text-[#2D5A3D]">쿠폰 &amp; 프로모션</span>
      </nav>

      {/* 헤더 */}
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#2D5A3D] md:text-3xl">
            <span aria-hidden>🎁</span>
            <span>쿠폰 &amp; 프로모션</span>
          </h1>
          <p className="mt-1 text-sm text-[#6B6560]">
            8가지 타입으로 빠르게 시작하고, 실시간 미리보기로 실수를 줄여요.
          </p>
        </div>
        <Link
          href="/partner/marketing/coupons/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#C4956A] focus:ring-offset-2"
        >
          <span aria-hidden>➕</span>
          <span>새 쿠폰</span>
        </Link>
      </section>

      {/* 8개 타입 빠른 생성 */}
      <section aria-labelledby="quick-types" className="space-y-3">
        <h2
          id="quick-types"
          className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]"
        >
          <span aria-hidden>⚡</span>
          <span>8가지 타입 빠른 생성</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {COUPON_TYPES.map((t) => (
            <div
              key={t.key}
              className="relative flex flex-col gap-2 rounded-2xl border border-[#E8E4DC] bg-gradient-to-br from-[#FFF8F0] to-[#F5F1E8] p-4 shadow-sm"
            >
              <div className="text-3xl" aria-hidden>
                {t.icon}
              </div>
              <div className="text-sm font-bold text-[#2D5A3D]">{t.label}</div>
              <div className="text-[11px] leading-relaxed text-[#6B6560]">
                {t.desc}
              </div>
              <span className="inline-flex w-fit items-center rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                {t.autoRule}
              </span>
              <Link
                href={`/partner/marketing/coupons/new?type=${t.key}`}
                className="mt-1 inline-flex items-center justify-center rounded-xl bg-[#C4956A] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#A87A4F] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D] focus:ring-offset-2"
              >
                이 타입으로 생성
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* 내 쿠폰 리스트 */}
      <section aria-labelledby="my-coupons" className="space-y-3">
        <h2
          id="my-coupons"
          className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]"
        >
          <span aria-hidden>📋</span>
          <span>내 쿠폰</span>
          <span className="text-xs font-normal text-[#6B6560]">
            총 {all.length.toLocaleString("ko-KR")}개
          </span>
        </h2>

        {/* 탭 */}
        <div
          role="tablist"
          aria-label="쿠폰 상태 필터"
          className="flex flex-wrap gap-1 rounded-2xl border border-[#E8E4DC] bg-white p-1 shadow-sm"
        >
          {(Object.keys(TAB_META) as TabKey[]).map((k) => {
            const m = TAB_META[k];
            const count = buckets[k].length;
            const selected = activeTab === k;
            return (
              <Link
                key={k}
                href={`/partner/marketing/coupons?tab=${k}`}
                role="tab"
                aria-selected={selected}
                className={[
                  "inline-flex flex-1 items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition md:flex-none",
                  selected
                    ? "bg-[#2D5A3D] text-white shadow"
                    : "text-[#6B6560] hover:bg-[#FFF8F0]",
                ].join(" ")}
              >
                <span aria-hidden>{m.icon}</span>
                <span>{m.label}</span>
                <span
                  className={[
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    selected ? "bg-white/20 text-white" : "bg-[#F5F1E8] text-[#6B6560]",
                  ].join(" ")}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </div>

        {/* 리스트 */}
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-4 py-12 text-center">
            <div className="text-4xl" aria-hidden>
              🎁
            </div>
            <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
              아직 쿠폰이 없어요.
            </p>
            <p className="mt-1 text-xs text-[#6B6560]">
              위에서 빠른 생성으로 시작해 보세요!
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {list.map((c) => (
              <CouponCard key={c.id} coupon={c} />
            ))}
          </ul>
        )}
      </section>

      {/* 추천 프로모션 */}
      <section aria-labelledby="recommended" className="space-y-3">
        <h2
          id="recommended"
          className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]"
        >
          <span aria-hidden>💡</span>
          <span>추천 프로모션</span>
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {RECOMMENDED.map((r) => (
            <Link
              key={r.title}
              href={`/partner/marketing/coupons/new${buildQuery(r.params)}`}
              className="flex items-start gap-3 rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm transition hover:border-[#3A7A52] hover:bg-[#F5F9F3] focus:outline-none focus:ring-2 focus:ring-[#C4956A] focus:ring-offset-2"
            >
              <span className="text-2xl" aria-hidden>
                {r.icon}
              </span>
              <div className="flex-1">
                <div className="text-sm font-bold text-[#2D5A3D]">{r.title}</div>
                <div className="mt-1 text-[11px] text-[#6B6560]">{r.desc}</div>
                <div className="mt-2 text-[11px] font-semibold text-[#C4956A]">
                  템플릿으로 시작 →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function CouponCard({ coupon }: { coupon: CouponView }) {
  const state = classifyCoupon(coupon);
  const stateBadge: Record<
    "active" | "expired" | "upcoming" | "inactive",
    { label: string; cls: string }
  > = {
    active: { label: "활성", cls: "bg-[#D4E4BC] text-[#2D5A3D]" },
    upcoming: { label: "예정", cls: "bg-amber-100 text-amber-800" },
    expired: { label: "만료", cls: "bg-[#F5F1E8] text-[#8B7F75]" },
    inactive: { label: "비활성", cls: "bg-[#F5F1E8] text-[#6B6560]" },
  };
  const badge = stateBadge[state];
  const issued = coupon.max_uses ?? null;
  const used = coupon.used_count ?? 0;
  const remaining = issued !== null ? Math.max(0, issued - used) : null;

  const toggleForm = toggleCouponActiveAction.bind(null, coupon.id, !coupon.is_active);
  const dupForm = duplicateCouponAction.bind(null, coupon.id);
  const delForm = deleteCouponAction.bind(null, coupon.id);

  return (
    <li className="relative flex overflow-hidden rounded-2xl border border-[#E8E4DC] bg-[#FFF8F0] shadow-sm">
      {/* 좌측 티켓 점선 */}
      <div
        aria-hidden
        className="flex w-2 flex-col items-center justify-between py-2"
      >
        <span className="h-3 w-3 rounded-full bg-white shadow-inner" />
        <div className="flex-1 border-l border-dashed border-[#C4956A]/60" />
        <span className="h-3 w-3 rounded-full bg-white shadow-inner" />
      </div>

      <div className="flex-1 space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-bold text-[#2D5A3D]">
                {coupon.name}
              </h3>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}
              >
                {badge.label}
              </span>
            </div>
            {coupon.code ? (
              <div className="mt-1 font-mono text-[11px] text-[#6B6560]">
                코드 {coupon.code}
              </div>
            ) : null}
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold leading-none text-[#C4956A]">
              {formatDiscount(coupon)}
            </div>
            {coupon.min_amount ? (
              <div className="mt-1 text-[10px] text-[#6B6560]">
                {coupon.min_amount.toLocaleString("ko-KR")}원 이상
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-xl bg-white/70 p-2 text-center">
          <Metric label="발행" value={issued !== null ? issued.toLocaleString("ko-KR") : "무제한"} />
          <Metric label="사용" value={used.toLocaleString("ko-KR")} />
          <Metric
            label="잔여"
            value={remaining !== null ? remaining.toLocaleString("ko-KR") : "∞"}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 text-[11px] text-[#6B6560]">
          <span aria-hidden>📅</span>
          <span>
            {formatDate(coupon.valid_from)} ~ {formatDate(coupon.valid_until)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form action={toggleForm}>
            <button
              type="submit"
              className={[
                "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#C4956A] focus:ring-offset-1",
                coupon.is_active
                  ? "bg-[#E8F0E4] text-[#2D5A3D] hover:bg-[#D4E4BC]"
                  : "bg-[#F5F1E8] text-[#6B6560] hover:bg-[#E8E4DC]",
              ].join(" ")}
              aria-label={coupon.is_active ? "쿠폰 비활성화" : "쿠폰 활성화"}
            >
              <span aria-hidden>{coupon.is_active ? "🟢" : "⚪"}</span>
              <span>{coupon.is_active ? "활성 ON" : "OFF"}</span>
            </button>
          </form>
          <Link
            href={`/partner/marketing/coupons/${coupon.id}`}
            className="inline-flex items-center rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2D5A3D] transition hover:bg-[#F5F9F3]"
          >
            수정
          </Link>
          <form action={dupForm}>
            <button
              type="submit"
              className="inline-flex items-center rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2D5A3D] transition hover:bg-[#F5F9F3]"
            >
              복제
            </button>
          </form>
          <form action={delForm}>
            <button
              type="submit"
              className="inline-flex items-center rounded-lg border border-red-100 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-50"
              aria-label="쿠폰 삭제"
            >
              삭제
            </button>
          </form>
        </div>
      </div>
    </li>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-[#6B6560]">{label}</div>
      <div className="text-sm font-bold text-[#2D5A3D]">{value}</div>
    </div>
  );
}
