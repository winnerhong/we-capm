import Link from "next/link";
import { AcornIcon } from "@/components/acorn-icon";

const STAGES = [
  {
    id: 1,
    name: "Stage 1 · 준비 (OFF)",
    emoji: "🌱",
    status: "current" as const,
    desc: "시스템 기반 구축 · 광고주 대기 등록",
    items: ["포털 개설", "대기 리스트", "Stage 로드맵 공개"],
  },
  {
    id: 2,
    name: "Stage 2 · 파일럿 (BETA)",
    emoji: "🌿",
    status: "upcoming" as const,
    desc: "소수 광고주 베타 테스트 · A/B 노출",
    items: ["기관 광고 노출", "성과 리포트", "ESG 임팩트 구매"],
  },
  {
    id: 3,
    name: "Stage 3 · 오픈 (LIVE)",
    emoji: "🌳",
    status: "upcoming" as const,
    desc: "정식 광고 집행 · 4개 노출 영역 전면 개방",
    items: ["가족/기관/업체/토리톡 4면", "자동 입찰", "타겟 세분화"],
  },
  {
    id: 4,
    name: "Stage 4 · 생태계 (SCALE)",
    emoji: "🌲",
    status: "upcoming" as const,
    desc: "광고주 등급 · 정령 커뮤니티 · 외부 제휴",
    items: ["정령 등급(4단계)", "제휴 네트워크", "프리미엄 슬롯"],
  },
];

export default function AdsPortalLandingPage() {
  return (
    <div className="space-y-6">
      {/* 히어로 */}
      <section className="rounded-2xl bg-gradient-to-br from-[#C4956A] via-[#B0845A] to-[#8B6F47] p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -top-4 -right-4 text-[120px] opacity-10 select-none" aria-hidden>
          🧚
        </div>
        <div className="relative z-10">
          <p className="text-[11px] tracking-[0.4em] opacity-80 font-light">TORIRO ADS</p>
          <h1 className="mt-1 text-2xl font-extrabold flex items-center gap-2">
            <span aria-hidden>🧚</span>
            <span>숲속 정령 포털</span>
          </h1>
          <p className="mt-2 text-sm opacity-95">
            토리로 플랫폼에 광고를 집행하세요. 숲의 가족·기관·업체에게 이야기를 전합니다.
          </p>
        </div>
      </section>

      {/* Stage 1 알림 */}
      <section
        role="status"
        aria-live="polite"
        className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3"
      >
        <span className="text-2xl flex-shrink-0" aria-hidden>⚠️</span>
        <div className="flex-1">
          <p className="text-sm font-bold text-amber-900">
            현재 광고 시스템은 <span className="underline">Stage 1 (OFF)</span> 상태입니다
          </p>
          <p className="mt-1 text-xs text-amber-800 leading-relaxed">
            광고 집행은 아직 개시되지 않았습니다. 대기 등록을 해주시면 Stage 2 파일럿 오픈 시 가장
            먼저 안내드립니다. 궁금한 점은 관리자 문의로 연락주세요.
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 로그인 폼 */}
        <section className="rounded-2xl border border-[#E5D3B8] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[#6B4423] flex items-center gap-2">
            <span aria-hidden>🔑</span>
            <span>정령 로그인</span>
          </h2>
          <p className="mt-1 text-xs text-[#8B6F47]">
            승인된 광고주 계정으로 로그인하세요
          </p>

          <form className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="ads-email"
                className="block text-xs font-semibold text-[#6B4423] mb-1"
              >
                이메일
              </label>
              <input
                id="ads-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="advertiser@example.com"
                className="w-full rounded-lg border border-[#E5D3B8] bg-[#FFF8F0] px-3 py-2.5 text-sm focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
                disabled
              />
            </div>
            <div>
              <label
                htmlFor="ads-password"
                className="block text-xs font-semibold text-[#6B4423] mb-1"
              >
                비밀번호
              </label>
              <input
                id="ads-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-[#E5D3B8] bg-[#FFF8F0] px-3 py-2.5 text-sm focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
                disabled
              />
            </div>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="w-full rounded-lg bg-[#C4956A] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#B0845A] disabled:cursor-not-allowed disabled:opacity-50"
            >
              로그인 (준비 중)
            </button>
            <p className="text-[11px] text-[#8B6F47] text-center">
              Stage 2부터 로그인이 활성화됩니다
            </p>
          </form>
        </section>

        {/* 대기 등록 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-gradient-to-br from-[#F5F9EF] to-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[#2D5A3D] flex items-center gap-2">
            <span aria-hidden>🌱</span>
            <span>광고주 등록 대기</span>
          </h2>
          <p className="mt-1 text-xs text-[#6B6560]">
            Stage 2 파일럿 오픈 알림을 가장 먼저 받으세요
          </p>

          <form className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="wait-company"
                className="block text-xs font-semibold text-[#2D5A3D] mb-1"
              >
                회사 · 브랜드명
              </label>
              <input
                id="wait-company"
                name="company"
                type="text"
                autoComplete="organization"
                placeholder="(주)토리로 · 도토리마켓"
                className="w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
                disabled
              />
            </div>
            <div>
              <label
                htmlFor="wait-phone"
                className="block text-xs font-semibold text-[#2D5A3D] mb-1"
              >
                담당자 연락처
              </label>
              <input
                id="wait-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="010-1234-5678"
                pattern="[0-9\-]*"
                className="w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
                disabled
              />
            </div>
            <div>
              <label
                htmlFor="wait-category"
                className="block text-xs font-semibold text-[#2D5A3D] mb-1"
              >
                광고 분야
              </label>
              <select
                id="wait-category"
                name="category"
                disabled
                className="w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
                defaultValue=""
              >
                <option value="" disabled>선택해주세요</option>
                <option>캠핑 · 아웃도어</option>
                <option>육아 · 교육</option>
                <option>식음료</option>
                <option>ESG · 친환경</option>
                <option>기타</option>
              </select>
            </div>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="w-full rounded-lg bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#234a30] disabled:cursor-not-allowed disabled:opacity-50"
            >
              대기 등록 (준비 중)
            </button>
          </form>
        </section>
      </div>

      {/* Stage 로드맵 */}
      <section className="rounded-2xl border border-[#E5D3B8] bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#6B4423] flex items-center gap-2">
            <span aria-hidden>🗺️</span>
            <span>Stage 로드맵</span>
          </h2>
          <span className="text-[10px] text-[#8B6F47] font-medium">PART 8 기준</span>
        </div>
        <ol className="grid gap-3 md:grid-cols-2">
          {STAGES.map((stage) => {
            const isCurrent = stage.status === "current";
            return (
              <li
                key={stage.id}
                className={`relative rounded-xl border p-4 transition-all ${
                  isCurrent
                    ? "border-[#C4956A] bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] shadow-md"
                    : "border-[#E5D3B8] bg-white hover:shadow-sm"
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-2 right-3 rounded-full bg-[#C4956A] px-2 py-0.5 text-[10px] font-bold text-white">
                    현재 단계
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <span className="text-3xl flex-shrink-0" aria-hidden>{stage.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-[#6B4423]">{stage.name}</h3>
                    <p className="mt-1 text-xs text-[#8B6F47]">{stage.desc}</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {stage.items.map((it) => (
                        <li
                          key={it}
                          className="rounded-full bg-[#F5E6D3] px-2 py-0.5 text-[10px] font-medium text-[#8B6F47]"
                        >
                          {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* 하단 CTA */}
      <section className="rounded-2xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] p-5 text-white text-center">
        <p className="text-sm font-semibold">
          <AcornIcon /> 미리 둘러보시려면 대시보드 프리뷰로 이동하세요
        </p>
        <Link
          href="/ads-portal/dashboard"
          className="mt-3 inline-block rounded-lg bg-white px-5 py-2 text-sm font-bold text-[#2D5A3D] hover:bg-[#FFF8F0]"
        >
          대시보드 미리보기 →
        </Link>
      </section>
    </div>
  );
}
