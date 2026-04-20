import Link from "next/link";

const STATS = [
  { label: "총 노출", value: "0", unit: "회", icon: "👀", accent: "from-[#FFF8F0] to-[#F5E6D3]", text: "#6B4423" },
  { label: "총 클릭", value: "0", unit: "회", icon: "👆", accent: "from-[#FFF8F0] to-[#F5E6D3]", text: "#6B4423" },
  { label: "전환률", value: "0.0", unit: "%", icon: "📈", accent: "from-[#FFF8F0] to-[#F5E6D3]", text: "#6B4423" },
  { label: "집행 예산", value: "0", unit: "원", icon: "💰", accent: "from-[#FFF8F0] to-[#F5E6D3]", text: "#6B4423" },
];

const MENU = [
  { href: "/ads-portal/campaigns", icon: "📣", title: "캠페인 관리", sub: "목록 · 수정 · 중지" },
  { href: "/ads-portal/campaigns/new", icon: "✨", title: "새 캠페인", sub: "6단계 마법사" },
  { href: "/ads-portal/analytics", icon: "📊", title: "성과 분석", sub: "A/B 테스트" },
  { href: "/ads-portal/targeting", icon: "🎯", title: "타겟 설정", sub: "연령 · 지역 · 관심사" },
  { href: "/ads-portal/creatives", icon: "🎨", title: "광고 소재", sub: "이미지 · 카피 라이브러리" },
  { href: "/ads-portal/billing", icon: "💳", title: "결제·청구", sub: "충전 · 세금계산서" },
  { href: "/ads-portal/esg", icon: "🌱", title: "ESG 임팩트 구매", sub: "나무심기 · 쓰레기줍기" },
  { href: "/ads-portal/support", icon: "💬", title: "관리자 문의", sub: "1:1 상담" },
];

const TIERS = [
  { name: "새싹", emoji: "🌱", range: "0 ~ 50만원", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  { name: "탐험가", emoji: "🌿", range: "50 ~ 300만원", color: "bg-lime-50 border-lime-200 text-lime-700" },
  { name: "나무", emoji: "🌳", range: "300 ~ 1,000만원", color: "bg-green-50 border-green-300 text-green-800" },
  { name: "숲", emoji: "🌲", range: "1,000만원+", color: "bg-teal-50 border-teal-300 text-teal-800" },
];

const SLOTS = [
  {
    icon: "👨‍👩‍👧",
    name: "가족 앱",
    desc: "참여자 홈 · 미션 하단",
    reach: "일 2만+ 가족",
    tone: "from-rose-50 to-white border-rose-200 text-rose-800",
  },
  {
    icon: "🏢",
    name: "기관 포털",
    desc: "기관 대시보드 우측 배너",
    reach: "300+ 기관 운영진",
    tone: "from-sky-50 to-white border-sky-200 text-sky-800",
  },
  {
    icon: "🏪",
    name: "업체(숲지기) 앱",
    desc: "파트너 앱 메인",
    reach: "500+ 파트너",
    tone: "from-amber-50 to-white border-amber-200 text-amber-800",
  },
  {
    icon: "💬",
    name: "토리톡",
    desc: "채팅 상단 네이티브 슬롯",
    reach: "전 사용자 진입점",
    tone: "from-violet-50 to-white border-violet-200 text-violet-800",
  },
];

export default function AdsPortalDashboardPage() {
  return (
    <div className="space-y-6">
      {/* 헤더 — 도토리 그라디언트 */}
      <section className="rounded-2xl bg-gradient-to-br from-[#C4956A] via-[#B0845A] to-[#8B6F47] p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -right-6 -top-6 text-[140px] opacity-10 select-none" aria-hidden>🧚</div>
        <div className="absolute bottom-2 right-20 text-4xl opacity-20 select-none" aria-hidden>🌰</div>
        <div className="relative z-10">
          <p className="text-[11px] tracking-[0.4em] opacity-80 font-light">ADVERTISER</p>
          <h1 className="mt-1 text-2xl font-extrabold flex items-center gap-2">
            <span aria-hidden>🧚</span>
            <span>오늘의 캠페인</span>
          </h1>
          <p className="mt-2 text-sm opacity-95">
            숲속 정령의 하루를 시작해보세요. 현재는 Stage 1 프리뷰 모드입니다.
          </p>
        </div>
      </section>

      {/* 4 통계 카드 */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STATS.map((s) => (
          <div
            key={s.label}
            className={`rounded-2xl border border-[#E5D3B8] bg-gradient-to-br ${s.accent} p-4 relative overflow-hidden`}
          >
            <div className="absolute top-2 right-2 text-2xl opacity-30 select-none" aria-hidden>
              {s.icon}
            </div>
            <p className="text-[11px] font-semibold" style={{ color: "#8B6F47" }}>
              {s.label}
            </p>
            <p className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-extrabold" style={{ color: s.text }}>
                {s.value}
              </span>
              <span className="text-xs font-medium text-[#8B6F47]">{s.unit}</span>
            </p>
            <p className="mt-1 text-[10px] text-[#8B6F47]">Stage 2 오픈 후 집계</p>
          </div>
        ))}
      </section>

      {/* 8-메뉴 그리드 */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-bold text-[#6B4423] flex items-center gap-1.5">
            <span aria-hidden>🧰</span>
            <span>정령의 도구</span>
          </h2>
          <span className="text-[10px] text-[#8B6F47] font-medium">8개 메뉴</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {MENU.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group rounded-2xl border border-[#E5D3B8] bg-white p-4 flex flex-col items-center gap-1.5 hover:border-[#C4956A] hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <span className="text-3xl transition-transform group-hover:scale-110" aria-hidden>
                {m.icon}
              </span>
              <span className="text-sm font-semibold text-[#6B4423] text-center leading-tight">
                {m.title}
              </span>
              <span className="text-[10px] text-[#8B6F47] text-center">{m.sub}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 등급 시스템 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-gradient-to-br from-[#F5F9EF] to-white p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[#2D5A3D] flex items-center gap-1.5">
            <span aria-hidden>🏅</span>
            <span>정령 등급 시스템</span>
          </h2>
          <span className="text-[10px] text-[#6B6560] font-medium">누적 집행액 기준</span>
        </div>
        <ol className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {TIERS.map((t, i) => (
            <li
              key={t.name}
              className={`relative rounded-xl border ${t.color} p-3 text-center`}
            >
              <div className="text-3xl" aria-hidden>{t.emoji}</div>
              <div className="mt-1 text-sm font-bold">{t.name}</div>
              <div className="mt-0.5 text-[10px] opacity-80">{t.range}</div>
              {i < TIERS.length - 1 && (
                <span
                  className="hidden md:block absolute top-1/2 -right-1 -translate-y-1/2 text-[#8B6F47]"
                  aria-hidden
                >
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[11px] text-[#6B6560] text-center">
          상위 등급은 노출 가중치·전용 슬롯·ESG 매칭 혜택을 받습니다
        </p>
      </section>

      {/* 광고 노출 영역 4개 */}
      <section className="rounded-2xl border border-[#E5D3B8] bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[#6B4423] flex items-center gap-1.5">
            <span aria-hidden>📍</span>
            <span>광고 노출 영역</span>
          </h2>
          <span className="text-[10px] text-[#8B6F47] font-medium">4면 전면 개방은 Stage 3</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {SLOTS.map((s) => (
            <div
              key={s.name}
              className={`rounded-xl border bg-gradient-to-br ${s.tone} p-4 flex items-start gap-3`}
            >
              <span className="text-3xl flex-shrink-0" aria-hidden>{s.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold">{s.name}</h3>
                <p className="mt-0.5 text-xs opacity-80">{s.desc}</p>
                <p className="mt-1.5 text-[10px] font-semibold opacity-70">📊 {s.reach}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stage 1 알림 (하단 재확인) */}
      <section
        role="status"
        aria-live="polite"
        className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-center gap-3"
      >
        <span className="text-xl flex-shrink-0" aria-hidden>⏳</span>
        <p className="text-xs text-amber-900 leading-relaxed">
          <span className="font-bold">Stage 1 (OFF)</span> — 이 화면은 프리뷰입니다. 실제 집행과
          집계는 파일럿(Stage 2) 오픈 이후부터 제공됩니다.
        </p>
      </section>
    </div>
  );
}
