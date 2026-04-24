import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

type CampaignRow = {
  id: string;
  name: string | null;
  status: string | null;
  sent_count: number | null;
  conversion_count: number | null;
  goal: string | null;
  created_at: string | null;
};

type ReviewRow = { id: string; replied_at: string | null };
type ExternalReviewRow = { id: string; replied_at: string | null };
type CouponRow = {
  id: string;
  expires_at: string | null;
  is_active: boolean | null;
};
type CustomerRow = { id: string; created_at: string | null; source: string | null };

function monthStartIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

async function loadNewCustomersThisMonth(partnerId: string): Promise<number> {
  const supabase = await createClient();
  try {
    const { data } = await (supabase.from("partner_customers" as never) as any)
      .select("id,created_at")
      .eq("partner_id", partnerId)
      .gte("created_at", monthStartIso());
    const rows = (data ?? []) as CustomerRow[];
    return rows.length;
  } catch {
    return 0;
  }
}

async function loadBulkImportedCustomers(partnerId: string): Promise<number> {
  const supabase = await createClient();
  try {
    const { data } = await (supabase.from("partner_customers" as never) as any)
      .select("id,source")
      .eq("partner_id", partnerId)
      .eq("source", "bulk_import");
    const rows = (data ?? []) as CustomerRow[];
    return rows.length;
  } catch {
    return 0;
  }
}

async function loadCampaignStats(partnerId: string): Promise<{
  monthlySent: number;
  noGoalCount: number;
  recent: CampaignRow[];
}> {
  const supabase = await createClient();
  try {
    const { data } = await (supabase.from("partner_campaigns" as never) as any)
      .select("id,name,status,sent_count,conversion_count,goal,created_at")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false })
      .limit(20);
    const rows = (data ?? []) as CampaignRow[];
    const start = monthStartIso();
    const monthlySent = rows
      .filter((r) => (r.created_at ?? "") >= start)
      .reduce((s, r) => s + (r.sent_count ?? 0), 0);
    const noGoalCount = rows.filter(
      (r) => !r.goal || r.goal.trim().length === 0
    ).length;
    const recent = rows.slice(0, 5);
    return { monthlySent, noGoalCount, recent };
  } catch {
    return { monthlySent: 0, noGoalCount: 0, recent: [] };
  }
}

async function loadReviewCounts(partnerId: string): Promise<{
  total: number;
  pendingReply: number;
}> {
  const supabase = await createClient();
  let nativeTotal = 0;
  let nativePending = 0;
  let externalTotal = 0;
  let externalPending = 0;
  try {
    const { data } = await (supabase.from("reviews" as never) as any)
      .select("id,replied_at")
      .eq("partner_id", partnerId);
    const rows = (data ?? []) as ReviewRow[];
    nativeTotal = rows.length;
    nativePending = rows.filter((r) => !r.replied_at).length;
  } catch {
    /* ignore */
  }
  try {
    const { data } = await (
      supabase.from("partner_external_reviews" as never) as any
    )
      .select("id,replied_at")
      .eq("partner_id", partnerId);
    const rows = (data ?? []) as ExternalReviewRow[];
    externalTotal = rows.length;
    externalPending = rows.filter((r) => !r.replied_at).length;
  } catch {
    /* ignore */
  }
  return {
    total: nativeTotal + externalTotal,
    pendingReply: nativePending + externalPending,
  };
}

async function loadCouponsExpiringSoon(partnerId: string): Promise<number> {
  const supabase = await createClient();
  try {
    const now = new Date();
    const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { data } = await (supabase.from("coupons" as never) as any)
      .select("id,expires_at,is_active")
      .eq("partner_id", partnerId);
    const rows = (data ?? []) as CouponRow[];
    return rows.filter((r) => {
      if (r.is_active === false) return false;
      if (!r.expires_at) return false;
      const exp = new Date(r.expires_at);
      return exp > now && exp <= in7days;
    }).length;
  } catch {
    return 0;
  }
}

async function loadReturnRate(partnerId: string): Promise<string> {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase.from("event_registrations" as never) as any
    )
      .select("user_id,phone,partner_id")
      .eq("partner_id", partnerId);
    const rows = (data ?? []) as {
      user_id: string | null;
      phone: string | null;
    }[];
    if (rows.length === 0) return "추적 중";
    const keyMap = new Map<string, number>();
    for (const r of rows) {
      const key = r.user_id || r.phone || "";
      if (!key) continue;
      keyMap.set(key, (keyMap.get(key) ?? 0) + 1);
    }
    const unique = keyMap.size;
    if (unique === 0) return "추적 중";
    const repeaters = Array.from(keyMap.values()).filter((n) => n >= 2).length;
    const rate = Math.round((repeaters / unique) * 100);
    return `${rate}%`;
  } catch {
    return "추적 중";
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "-";
  }
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: "임시", cls: "bg-[#F5F1E8] text-[#6B6560]" },
  scheduled: { label: "예약", cls: "bg-[#E8F0E4] text-[#2D5A3D]" },
  sending: { label: "발송 중", cls: "bg-amber-100 text-amber-800" },
  sent: { label: "발송완료", cls: "bg-[#D4E4BC] text-[#2D5A3D]" },
  completed: { label: "완료", cls: "bg-[#D4E4BC] text-[#2D5A3D]" },
  paused: { label: "일시정지", cls: "bg-orange-100 text-orange-800" },
  failed: { label: "실패", cls: "bg-red-100 text-red-700" },
};

function StatusPill({ status }: { status: string | null }) {
  const key = (status ?? "draft").toLowerCase();
  const meta = STATUS_LABEL[key] ?? {
    label: status ?? "임시",
    cls: "bg-[#F5F1E8] text-[#6B6560]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}

type QuickLink = {
  icon: string;
  title: string;
  desc: string;
  href: string;
  soon?: boolean;
};

const QUICK_LINKS: QuickLink[] = [
  {
    icon: "📢",
    title: "캠페인",
    desc: "문자 · 이메일 · 알림톡 발송",
    href: "/partner/marketing/campaigns",
  },
  {
    icon: "🎁",
    title: "쿠폰 & 프로모션",
    desc: "할인 코드 · 기한 관리",
    href: "/partner/marketing/coupons",
  },
  {
    icon: "🤖",
    title: "자동화 시나리오",
    desc: "트리거 기반 자동 발송",
    href: "/partner/marketing/automation",
  },
  {
    icon: "⭐",
    title: "리뷰 관리",
    desc: "답글 · 외부 리뷰 모으기",
    href: "/partner/marketing/reviews",
  },
  {
    icon: "📊",
    title: "성과 분석",
    desc: "오픈율 · 전환율 · ROI",
    href: "/partner/marketing/analytics",
  },
  {
    icon: "🎨",
    title: "미디어 라이브러리",
    desc: "사진 · 영상 자산 보관",
    href: "/partner/marketing/media",
    soon: true,
  },
  {
    icon: "🌐",
    title: "랜딩 페이지",
    desc: "프로모션 페이지 빌더",
    href: "/partner/marketing/landing",
    soon: true,
  },
  {
    icon: "🎁",
    title: "추천인 이벤트",
    desc: "친구 초대 · 보상 관리",
    href: "/partner/marketing/referrals",
    soon: true,
  },
];

export default async function PartnerMarketingHubPage() {
  const partner = await requirePartner();

  const [newCustomers, campaignStats, reviews, expiringCoupons, returnRate, bulkImported] =
    await Promise.all([
      loadNewCustomersThisMonth(partner.id),
      loadCampaignStats(partner.id),
      loadReviewCounts(partner.id),
      loadCouponsExpiringSoon(partner.id),
      loadReturnRate(partner.id),
      loadBulkImportedCustomers(partner.id),
    ]);

  const stats = [
    {
      icon: "🌿",
      label: "이번 달 신규 고객",
      value: `${newCustomers.toLocaleString("ko-KR")}명`,
    },
    {
      icon: "💌",
      label: "이번 달 캠페인 발송",
      value: `${campaignStats.monthlySent.toLocaleString("ko-KR")}건`,
    },
    {
      icon: "⭐",
      label: "누적 리뷰",
      value: `${reviews.total.toLocaleString("ko-KR")}개`,
    },
    {
      icon: "🔁",
      label: "재방문율",
      value: returnRate,
    },
  ];

  type TodoCard = { icon: string; text: string; href: string };
  const todos: TodoCard[] = [];
  if (campaignStats.noGoalCount > 0) {
    todos.push({
      icon: "🎯",
      text: `목표 설정 안 된 캠페인 ${campaignStats.noGoalCount}개가 있어요`,
      href: "/partner/marketing/campaigns",
    });
  }
  if (reviews.pendingReply > 0) {
    todos.push({
      icon: "⭐",
      text: `답장 대기 리뷰 ${reviews.pendingReply}개`,
      href: "/partner/marketing/reviews",
    });
  }
  if (expiringCoupons > 0) {
    todos.push({
      icon: "🎁",
      text: `만료 임박 쿠폰 ${expiringCoupons}개`,
      href: "/partner/marketing/coupons",
    });
  }
  if (bulkImported > 0) {
    todos.push({
      icon: "📤",
      text: `엑셀로 받은 고객 ${bulkImported}명에게 환영 문자 보내보세요`,
      href: "/partner/marketing/campaigns/new",
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      {/* 1. 헤더 */}
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#2D5A3D] md:text-3xl">
            <span>🎯</span>
            <span>마케팅 센터</span>
          </h1>
          <p className="mt-1 text-sm text-[#6B6560]">
            우리 숲에 더 많은 가족이 찾아오게
          </p>
        </div>
        <Link
          href="/partner/marketing/campaigns/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3A7A52]"
        >
          <span>➕</span>
          <span>새 캠페인</span>
        </Link>
      </section>

      {/* 2. 4개 성과 통계 카드 */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[#6B6560]">
              <span className="text-lg">{s.icon}</span>
              <span>{s.label}</span>
            </div>
            <div className="mt-2 text-3xl font-bold text-[#2D5A3D]">{s.value}</div>
          </div>
        ))}
      </section>

      {/* 3. ⚡ 오늘 할 일 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>⚡</span>
          <span>오늘 할 일</span>
        </h2>
        {todos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-4 py-10 text-center">
            <div className="text-3xl">🌲</div>
            <p className="mt-2 text-sm font-semibold text-[#2D5A3D]">
              모든 작업이 완료되었어요!
            </p>
            <p className="mt-1 text-xs text-[#6B6560]">
              숲이 잘 가꿔지고 있어요 🌱
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {todos.map((t) => (
              <li key={t.text}>
                <Link
                  href={t.href}
                  className="flex items-center gap-3 rounded-2xl bg-[#FFF8F0] p-4 transition hover:bg-[#E8F0E4]"
                >
                  <span className="text-2xl">{t.icon}</span>
                  <span className="flex-1 text-sm font-medium text-[#2C2C2C]">
                    {t.text}
                  </span>
                  <span aria-hidden className="text-[#6B6560]">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 4. 🚀 빠른 시작 */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>🚀</span>
          <span>빠른 시작</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {QUICK_LINKS.map((q) => (
            <div
              key={q.title}
              className="relative flex flex-col rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm"
            >
              {q.soon ? (
                <span className="absolute right-3 top-3 rounded-full bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#6B6560]">
                  곧 공개
                </span>
              ) : null}
              <div className="text-3xl">{q.icon}</div>
              <div className="mt-2 text-sm font-bold text-[#2D5A3D]">
                {q.title}
              </div>
              <div className="mt-1 text-[11px] text-[#6B6560]">{q.desc}</div>
              <div className="mt-3">
                {q.soon ? (
                  <span className="inline-flex cursor-not-allowed items-center rounded-xl border border-[#E8E4DC] bg-[#F5F1E8] px-3 py-1.5 text-xs font-semibold text-[#B5AFA8]">
                    준비 중
                  </span>
                ) : (
                  <Link
                    href={q.href}
                    className="inline-flex items-center rounded-xl bg-[#2D5A3D] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3A7A52]"
                  >
                    바로가기 →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. 📈 최근 캠페인 성과 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>📈</span>
            <span>최근 캠페인 성과</span>
          </h2>
          {campaignStats.recent.length > 0 ? (
            <Link
              href="/partner/marketing/campaigns"
              className="text-xs font-semibold text-[#3A7A52] hover:text-[#2D5A3D] hover:underline"
            >
              전체 보기 →
            </Link>
          ) : null}
        </div>
        {campaignStats.recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-4 py-10 text-center">
            <div className="text-3xl"><AcornIcon size={28} /></div>
            <p className="mt-2 text-sm font-semibold text-[#2D5A3D]">
              아직 캠페인이 없어요
            </p>
            <p className="mt-1 text-xs text-[#6B6560]">
              ➕ 새 캠페인으로 시작해보세요!
            </p>
            <Link
              href="/partner/marketing/campaigns/new"
              className="mt-3 inline-flex items-center rounded-xl bg-[#2D5A3D] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3A7A52]"
            >
              새 캠페인 만들기
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {campaignStats.recent.map((c) => {
              const sent = c.sent_count ?? 0;
              const conv = c.conversion_count ?? 0;
              const rate = sent > 0 ? Math.round((conv / sent) * 100) : 0;
              return (
                <li key={c.id}>
                  <Link
                    href={`/partner/marketing/campaigns/${c.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E8F0E4] bg-[#FFF8F0] p-4 transition hover:border-[#3A7A52] hover:bg-[#E8F0E4]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-[#2D5A3D]">
                          {c.name ?? "제목 없는 캠페인"}
                        </span>
                        <StatusPill status={c.status} />
                      </div>
                      <div className="mt-1 text-[11px] text-[#6B6560]">
                        {formatDate(c.created_at)} 생성
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right text-xs">
                      <div>
                        <div className="text-[10px] text-[#6B6560]">발송</div>
                        <div className="text-sm font-bold text-[#2D5A3D]">
                          {sent.toLocaleString("ko-KR")}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#6B6560]">전환</div>
                        <div className="text-sm font-bold text-[#2D5A3D]">
                          {conv.toLocaleString("ko-KR")}
                          <span className="ml-1 text-[10px] font-semibold text-[#6B6560]">
                            ({rate}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
