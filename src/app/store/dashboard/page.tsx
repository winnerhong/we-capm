import Link from "next/link";

type StatCard = {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "up" | "down" | "neutral";
  icon: string;
};

const stats: StatCard[] = [
  { label: "오늘 방문", value: "12명", delta: "+3", deltaTone: "up", icon: "👣" },
  { label: "쿠폰 사용", value: "8건", delta: "+2", deltaTone: "up", icon: "🎁" },
  { label: "이번달 매출 기여", value: "₩428,000", delta: "+18%", deltaTone: "up", icon: "💰" },
  { label: "평균 평점", value: "4.7 ★", delta: "동일", deltaTone: "neutral", icon: "⭐" },
];

type MenuCard = {
  href: string;
  icon: string;
  title: string;
  desc: string;
  accent?: boolean;
};

const menus: MenuCard[] = [
  {
    href: "/store/dashboard#coupons",
    icon: "🎁",
    title: "쿠폰 관리",
    desc: "활성·만료 쿠폰 한눈에",
  },
  {
    href: "/store/coupons/new",
    icon: "✨",
    title: "새 쿠폰 만들기",
    desc: "4단계 마법사로 쉽게",
    accent: true,
  },
  {
    href: "/store/dashboard#targeting",
    icon: "🗺️",
    title: "행사 타겟팅",
    desc: "근처에서 열리는 행사 선택",
  },
  {
    href: "/store/dashboard#analytics",
    icon: "📊",
    title: "성과 분석",
    desc: "전달→사용 퍼널 리포트",
  },
  {
    href: "/store/dashboard#talk",
    icon: "💬",
    title: "토리톡",
    desc: "고객 문의·후기 대응",
  },
  {
    href: "/store/billing",
    icon: "💳",
    title: "결제·정산",
    desc: "이번 정산 주기 확인",
  },
  {
    href: "/store/dashboard#settings",
    icon: "⚙️",
    title: "설정",
    desc: "위치·영업시간·담당자",
  },
];

type Timing = {
  icon: string;
  category: string;
  timing: string;
  note: string;
};

const timings: Timing[] = [
  {
    icon: "🍽️",
    category: "음식점",
    timing: "행사 종료 후 30분",
    note: "점심·저녁 시간대 유입 최적",
  },
  {
    icon: "☕",
    category: "카페",
    timing: "30분 또는 2시간 후",
    note: "휴식 타이밍에 자연스럽게",
  },
  {
    icon: "🎨",
    category: "체험시설",
    timing: "2시간 후",
    note: "행사 열기가 남아있을 때",
  },
  {
    icon: "📚",
    category: "교육",
    timing: "3일 후",
    note: "관심 고조 시점 재방문 유도",
  },
];

function deltaClass(tone: StatCard["deltaTone"]) {
  if (tone === "up") return "text-[#2D5A3D] bg-[#E8F0E4]";
  if (tone === "down") return "text-[#B04A4A] bg-[#FCE7E7]";
  return "text-[#6B6560] bg-[#F1EDE7]";
}

export default function StoreDashboardPage() {
  return (
    <div className="space-y-8">
      {/* Welcome header with amber gradient */}
      <section className="rounded-3xl bg-gradient-to-br from-[#C4956A] via-[#D9AB82] to-[#E8C9A0] p-6 text-white shadow-md md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
              오늘의 가게 현황
            </p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">
              🌰 숲속 베이커리님, 안녕하세요
            </h1>
            <p className="mt-2 text-sm text-white/90">
              오늘 근처에서 열리는 토리로 행사 <strong className="font-bold">2건</strong>이
              예정되어 있어요.
            </p>
          </div>
          <Link
            href="/store/coupons/new"
            className="inline-flex items-center justify-center gap-1 self-start rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#8B5E3C] shadow-sm transition hover:bg-[#FFF8F0] md:self-auto"
          >
            ✨ 새 쿠폰 만들기
          </Link>
        </div>
      </section>

      {/* Stat cards (4) */}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          주요 지표
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((s) => (
            <article
              key={s.label}
              className="rounded-2xl border border-[#E8C9A0] bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl" aria-hidden>
                  {s.icon}
                </span>
                {s.delta && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${deltaClass(
                      s.deltaTone
                    )}`}
                  >
                    {s.delta}
                  </span>
                )}
              </div>
              <p className="mt-3 text-xs text-[#6B6560]">{s.label}</p>
              <p className="mt-0.5 text-lg font-bold text-[#2D5A3D] md:text-xl">{s.value}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 📊 이번달 쿠폰 사용 요약 (billing 미리보기) */}
      <section
        aria-labelledby="coupon-usage-heading"
        className="rounded-3xl border border-[#E8C9A0] bg-gradient-to-br from-[#FFF8F0] via-white to-[#FAE7D0] p-5 shadow-sm md:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="coupon-usage-heading"
              className="text-base font-bold text-[#2D5A3D] md:text-lg"
            >
              📊 이번달 쿠폰 사용
            </h2>
            <p className="mt-1 text-xs text-[#6B6560]">
              사용된 쿠폰만큼만 수수료가 발생해요 · 매달 10일 정산
            </p>
          </div>
          <Link
            href="/store/billing"
            className="shrink-0 rounded-xl border border-[#C4956A] bg-white px-3 py-2 text-xs font-semibold text-[#8B5E3C] transition hover:bg-[#FFF8F0]"
          >
            정산 상세 →
          </Link>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white/80 p-3 text-center">
            <dt className="text-[11px] text-[#6B6560]">발행</dt>
            <dd className="mt-1 text-lg font-bold text-[#2D5A3D]">42장</dd>
          </div>
          <div className="rounded-2xl bg-white/80 p-3 text-center">
            <dt className="text-[11px] text-[#6B6560]">사용</dt>
            <dd className="mt-1 text-lg font-bold text-[#8B5E3C]">18장</dd>
          </div>
          <div className="rounded-2xl bg-[#E8F0E4] p-3 text-center">
            <dt className="text-[11px] text-[#2D5A3D]">예정 정산</dt>
            <dd className="mt-1 text-lg font-bold text-[#2D5A3D]">₩9,900</dd>
          </div>
        </dl>

        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-[#6B6560]">
            <span>사용률</span>
            <span className="font-semibold text-[#2D5A3D]">43%</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[#F1D9B8]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52]"
              style={{ width: "43%" }}
              aria-hidden
            />
          </div>
        </div>
      </section>

      {/* 7-menu grid */}
      <section aria-labelledby="menu-heading">
        <h2
          id="menu-heading"
          className="mb-3 text-base font-bold text-[#2D5A3D] md:text-lg"
        >
          바로가기
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {menus.map((m) => (
            <Link
              key={m.title}
              href={m.href}
              className={`group block rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                m.accent
                  ? "border-[#C4956A] bg-gradient-to-br from-[#FAE7D0] to-white"
                  : "border-[#E8C9A0] bg-white hover:border-[#C4956A]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden>
                  {m.icon}
                </span>
                <h3 className="text-sm font-bold text-[#2D5A3D] md:text-base">{m.title}</h3>
              </div>
              <p className="mt-2 text-xs text-[#6B6560]">{m.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* 발송 타이밍 안내 */}
      <section
        aria-labelledby="timing-heading"
        className="rounded-3xl border border-[#E8C9A0] bg-white p-5 shadow-sm md:p-6"
      >
        <div className="mb-4 flex items-start gap-3">
          <span className="text-2xl" aria-hidden>
            ⏰
          </span>
          <div>
            <h2
              id="timing-heading"
              className="text-base font-bold text-[#2D5A3D] md:text-lg"
            >
              업종별 쿠폰 발송 타이밍
            </h2>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              토리로가 행사 종료 시점을 기준으로 최적 타이밍에 자동 발송해요.
            </p>
          </div>
        </div>

        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {timings.map((t) => (
            <li
              key={t.category}
              className="flex items-start gap-3 rounded-2xl border border-[#F1D9B8] bg-[#FFF8F0] p-4"
            >
              <span className="text-2xl" aria-hidden>
                {t.icon}
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-[#2D5A3D]">{t.category}</p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#8B5E3C]">
                    {t.timing}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#6B6560]">{t.note}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-4 rounded-xl bg-[#FAE7D0] px-4 py-3 text-xs text-[#8B5E3C]">
          💡 우리 가게 업종에 맞는 타이밍은{" "}
          <Link href="/store/dashboard#settings" className="font-semibold underline">
            설정
          </Link>
          에서 조정할 수 있어요.
        </p>
      </section>
    </div>
  );
}
