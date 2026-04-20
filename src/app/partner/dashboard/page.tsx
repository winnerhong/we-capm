import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type MenuItem = {
  icon: string;
  label: string;
  href: string;
  desc: string;
};

type ProgramRow = {
  id: string;
  is_published: boolean;
  rating_avg: number | null;
  rating_count: number;
  booking_count: number;
  price_per_person: number;
};

const MENUS: MenuItem[] = [
  { icon: "🗺️", label: "프로그램 관리", href: "/partner/programs", desc: "체험 상품 등록" },
  { icon: "🎨", label: "나만의 숲길", href: "/partner/dashboard", desc: "QR · 미션" },
  { icon: "🏫", label: "기관 고객", href: "/partner/dashboard", desc: "B2B2C" },
  { icon: "👥", label: "개인 고객", href: "/partner/dashboard", desc: "B2C" },
  { icon: "🏢", label: "기업 고객", href: "/partner/dashboard", desc: "B2B" },
  { icon: "📊", label: "분석", href: "/partner/analytics", desc: "성과 리포트" },
  { icon: "💳", label: "결제 관리", href: "/partner/dashboard", desc: "정산 · 수익" },
  { icon: "🛠️", label: "마케팅 센터", href: "/partner/dashboard", desc: "홍보 · 쿠폰" },
  { icon: "⚙️", label: "설정", href: "/partner/settings", desc: "계정 · 프로필" },
  { icon: "🪪", label: "내 정보", href: "/partner/my", desc: "열람 · 해지" },
];

const TASKS = [
  { done: false, text: "숲지기 프로필 작성하기" },
  { done: false, text: "첫 번째 프로그램 등록하기" },
  { done: false, text: "숲길 QR 미션 만들기" },
  { done: false, text: "정산 계좌 등록하기" },
];

function formatWon(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

async function loadQuickStats(partnerId: string) {
  const supabase = await createClient();
  try {
    const { data, error } = await (
      supabase.from("partner_programs") as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => Promise<{
            data: ProgramRow[] | null;
            error: unknown;
          }>;
        };
      }
    )
      .select(
        "id,is_published,rating_avg,rating_count,booking_count,price_per_person"
      )
      .eq("partner_id", partnerId);

    if (error || !data) return { revenue: 0, active: 0, avgRating: null as number | null };

    const active = data.filter((p) => p.is_published).length;
    const totalRevenue = data.reduce(
      (s, p) => s + (p.booking_count ?? 0) * (p.price_per_person ?? 0),
      0
    );
    const rated = data.filter(
      (p) => (p.rating_count ?? 0) > 0 && p.rating_avg != null
    );
    const avgRating =
      rated.length > 0
        ? rated.reduce((s, p) => s + (p.rating_avg ?? 0), 0) / rated.length
        : null;

    return {
      revenue: Math.round(totalRevenue * 0.35), // mock 이번달 비율
      active,
      avgRating,
    };
  } catch {
    return { revenue: 0, active: 0, avgRating: null as number | null };
  }
}

export default async function PartnerDashboardPage() {
  const partner = await requirePartner();
  const quick = await loadQuickStats(partner.id);

  const STATS = [
    { icon: "🌰", label: "이번달 수입", value: "0원", sub: "준비 중" },
    { icon: "🌿", label: "진행중 프로그램", value: `${quick.active}개`, sub: "게시 중" },
    { icon: "👨‍👩‍👧", label: "활성 구독자", value: "0명", sub: "곧 오픈" },
    {
      icon: "⭐",
      label: "평균 리뷰",
      value: quick.avgRating != null ? quick.avgRating.toFixed(2) : "-",
      sub: quick.avgRating != null ? "집계 기준" : "리뷰 없음",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Forest gradient welcome header */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-sm md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#D4E4BC]">
              Today · 오늘의 숲지기 현황
            </p>
            <h1 className="mt-2 text-2xl font-bold md:text-3xl">
              안녕하세요, {partner.name} 숲지기님 🌲
            </h1>
            <p className="mt-1 text-sm text-[#E8F0E4]">
              오늘도 숲길을 가꾸어주셔서 감사해요.
            </p>
          </div>
          <div className="hidden text-right md:block">
            <div className="text-5xl">🏡</div>
          </div>
        </div>
      </section>

      {/* 4 Stat cards */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[#6B6560]">
              <span className="text-lg">{s.icon}</span>
              <span>{s.label}</span>
            </div>
            <div className="mt-2 text-xl font-bold text-[#2D5A3D] md:text-2xl">
              {s.value}
            </div>
            <div className="mt-0.5 text-[11px] text-[#B5AFA8]">{s.sub}</div>
          </div>
        ))}
      </section>

      {/* 빠른 분석 widget */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-gradient-to-br from-white to-[#E8F0E4] p-4 shadow-sm md:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>⚡</span>
            <span>빠른 분석</span>
          </h2>
          <Link
            href="/partner/analytics"
            className="text-xs font-semibold text-[#3A7A52] hover:text-[#2D5A3D] hover:underline"
          >
            전체 분석 보기 →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          <div className="rounded-xl border border-[#E5D3B8] bg-[#FFF8F0] p-3">
            <p className="text-[10px] font-semibold text-[#8B6F47] md:text-[11px]">
              💰 이번달 매출
            </p>
            <p className="mt-1 truncate text-base font-extrabold text-[#6B4423] md:text-lg">
              {formatWon(quick.revenue)}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-[10px] font-semibold text-emerald-700 md:text-[11px]">
              🌿 활성 프로그램
            </p>
            <p className="mt-1 text-base font-extrabold text-emerald-900 md:text-lg">
              {quick.active}
              <span className="ml-0.5 text-xs font-semibold">개</span>
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-[10px] font-semibold text-amber-700 md:text-[11px]">
              ⭐ 평균 평점
            </p>
            <p className="mt-1 text-base font-extrabold text-amber-900 md:text-lg">
              {quick.avgRating != null ? quick.avgRating.toFixed(2) : "-"}
            </p>
          </div>
        </div>
      </section>

      {/* 9-menu grid 3x3 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm md:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>🌳</span>
          <span>숲지기 메뉴</span>
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {MENUS.map((m) => (
            <Link
              key={m.label}
              href={m.href}
              className="group flex flex-col items-center justify-center rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-3 text-center transition hover:border-[#3A7A52] hover:bg-[#E8F0E4] md:p-4"
            >
              <div className="text-2xl md:text-3xl">{m.icon}</div>
              <div className="mt-1.5 text-xs font-semibold text-[#2D5A3D] md:text-sm">
                {m.label}
              </div>
              <div className="mt-0.5 hidden text-[10px] text-[#6B6560] md:block">
                {m.desc}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 오늘의 할 일 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>✅</span>
            <span>오늘의 할 일</span>
          </h2>
          <ul className="space-y-2">
            {TASKS.map((t) => (
              <li
                key={t.text}
                className="flex items-center gap-3 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5"
              >
                <span
                  aria-hidden
                  className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                    t.done
                      ? "border-[#3A7A52] bg-[#3A7A52] text-white"
                      : "border-[#D4E4BC] bg-white"
                  }`}
                >
                  {t.done ? "✓" : ""}
                </span>
                <span
                  className={`text-sm ${
                    t.done ? "text-[#B5AFA8] line-through" : "text-[#2C2C2C]"
                  }`}
                >
                  {t.text}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* 최근 숲길 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>🌲</span>
            <span>최근 숲길</span>
          </h2>
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-4 py-10 text-center">
            <div className="text-3xl">🌱</div>
            <p className="mt-2 text-sm font-semibold text-[#2D5A3D]">
              아직 만든 숲길이 없어요
            </p>
            <p className="mt-1 text-xs text-[#6B6560]">곧 열릴 기능입니다 🌱</p>
          </div>
        </section>
      </div>
    </div>
  );
}
