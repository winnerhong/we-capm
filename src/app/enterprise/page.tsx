import type { Metadata } from "next";
import Link from "next/link";
import { InquiryForm } from "./inquiry-form";
import { AcornIcon } from "@/components/acorn-icon";

export const metadata: Metadata = {
  title: "기업 프로그램",
  description:
    "임직원과 가족이 함께하는 숲 속 ESG 실천 프로그램. 50명부터 500명 이상까지, 토리로가 기업 맞춤형 팀빌딩을 설계합니다.",
};

type PackageCard = {
  key: "BASIC" | "PREMIUM" | "ENTERPRISE";
  medal: string;
  title: string;
  priceLabel: string;
  priceNote: string;
  badge?: string;
  accent: string; // border / bg
  button: string; // button color
  features: string[];
  capacity: string;
};

const PACKAGES: PackageCard[] = [
  {
    key: "BASIC",
    medal: "🥉",
    title: "베이직",
    priceLabel: "1,500만원~",
    priceNote: "소규모 임직원 행사에 적합",
    accent: "border-[#D4E4BC] bg-white",
    button: "bg-[#2D5A3D] hover:bg-[#3A7A52]",
    capacity: "50~100명",
    features: ["2시간 체험 프로그램", "기본 사진 촬영", "기본 성과 리포트", "현장 운영 스태프 2인"],
  },
  {
    key: "PREMIUM",
    medal: "🥈",
    title: "프리미엄",
    priceLabel: "2,500만원~",
    priceNote: "가장 인기 있는 스탠다드",
    badge: "⭐ 인기",
    accent: "border-[#B8860B] bg-gradient-to-b from-[#FFF6D9] to-[#FFF8F0] ring-2 ring-[#B8860B]/30",
    button: "bg-[#B8860B] hover:bg-[#9C7409]",
    capacity: "100~200명",
    features: [
      "3시간 체험 프로그램",
      "오디오가이드 포함",
      "단독맵 제작 (회사 로고)",
      "전문 포토그래퍼 1인",
      "상세 성과 리포트",
    ],
  },
  {
    key: "ENTERPRISE",
    medal: "🥇",
    title: "엔터프라이즈",
    priceLabel: "5,000만원+",
    priceNote: "대규모 ESG 이벤트",
    accent: "border-[#6B4423] bg-gradient-to-b from-[#FFF8F0] to-[#F5E6D3]",
    button: "bg-[#6B4423] hover:bg-[#5A3818]",
    capacity: "200명 이상",
    features: [
      "하루 풀데이 프로그램",
      "ESG 리포트 공식 제공",
      "맞춤 브랜딩 & 굿즈",
      "미디어 촬영팀 포함",
      "전담 PM 배정",
      "탄소중립 인증서",
    ],
  },
];

const CASE_STUDIES: Array<{ emoji: string; title: string; summary: string; metrics: string[] }> = [
  {
    emoji: "🏢",
    title: "A 그룹 - 500명 팀빌딩",
    summary: "임원 워크숍 + 전사 팀빌딩을 하루에 진행. 부서간 장벽을 낮추는 릴레이 미션 설계.",
    metrics: ["참여율 98%", "만족도 4.8/5", "총 도토리 12,400개 수확"],
  },
  {
    emoji: "🏦",
    title: "B 은행 - 임직원 가족 초청",
    summary: "주말 가족동반 이벤트. 자녀와 함께하는 숲 탐험 미션으로 가족친화 기업 이미지 강화.",
    metrics: ["가족 동반 78%", "SNS 공유 1,200건", "지역 상생 보도 3건"],
  },
  {
    emoji: "💊",
    title: "C 제약 - 학부모 대상 ESG",
    summary: "고객(학부모) 초청 ESG 캠페인. 임직원 봉사시간 + 고객 체험을 동시에 달성.",
    metrics: ["신규 고객 420명", "ESG 보고서 수록", "탄소중립 2.1톤 상쇄"],
  },
];

const ESG_ITEMS: Array<{ emoji: string; title: string; desc: string }> = [
  {
    emoji: "🌱",
    title: "탄소 중립 기여",
    desc: "행사당 평균 1~3톤의 탄소를 상쇄하는 나무 심기 · 숲 보전 연계 프로그램을 제공합니다.",
  },
  {
    emoji: "📊",
    title: "ESG 리포트 자동 생성",
    desc: "참여자 수, 탄소상쇄량, 지역 상생지표를 자동 집계해 공식 보고서 형식으로 제공합니다.",
  },
  {
    emoji: "📸",
    title: "미디어 자료 제공",
    desc: "전문 포토·영상 촬영본을 사내보, 유튜브, IR 자료 등에 자유롭게 활용할 수 있습니다.",
  },
  {
    emoji: "💚",
    title: "사회 공헌 점수 연계",
    desc: "임직원 봉사시간(VMS 연동 가능) 및 지역사회 상생 활동으로 인정받을 수 있습니다.",
  },
];

export default function EnterprisePage() {
  return (
    <div className="min-h-dvh bg-[#FFF8F0] text-[#2C2C2C]">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-[#D4E4BC] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-bold text-[#2D5A3D]">
            <AcornIcon size={20} />
            <span>토리로</span>
            <span className="text-xs font-medium text-[#8B6F47]">for Enterprise</span>
          </Link>
          <a
            href="#inquiry"
            className="rounded-full bg-[#2D5A3D] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#3A7A52]"
          >
            상담 신청
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1F3D2B] via-[#2D5A3D] to-[#4A7C59] text-white">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute left-6 top-10 text-7xl">🌲</div>
          <div className="absolute right-10 top-20 text-6xl">🌳</div>
          <div className="absolute bottom-10 left-1/3 text-6xl">🍂</div>
          <div className="absolute bottom-4 right-1/4 text-5xl"><AcornIcon size={40} /></div>
        </div>
        <div className="relative z-10 mx-auto max-w-4xl px-4 py-16 md:py-24">
          <p className="text-xs font-semibold tracking-[0.4em] text-[#D4E4BC]">
            TORIRO FOR ENTERPRISE
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight md:text-5xl">
            🏢 기업을 위한
            <br />
            특별한 숲길
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[#E8F0E4] md:text-lg">
            임직원과 가족이 함께하는 ESG 실천 프로그램.
            <br />
            50명부터 500명 이상까지, 토리로가 숲 속에서 팀워크를 설계합니다.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#inquiry"
              className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#2D5A3D] shadow-md transition-all hover:translate-y-[-1px] hover:shadow-lg"
            >
              상담 신청하기 →
            </a>
            <a
              href="#packages"
              className="rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
            >
              패키지 살펴보기
            </a>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-3 text-center md:max-w-xl">
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
              <div className="text-2xl font-extrabold">3종</div>
              <div className="mt-1 text-[11px] text-[#D4E4BC]">패키지</div>
            </div>
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
              <div className="text-2xl font-extrabold">500+</div>
              <div className="mt-1 text-[11px] text-[#D4E4BC]">최대 인원</div>
            </div>
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
              <div className="text-2xl font-extrabold">4.8/5</div>
              <div className="mt-1 text-[11px] text-[#D4E4BC]">만족도</div>
            </div>
          </div>
        </div>
      </section>

      {/* Packages */}
      <section id="packages" className="bg-[#FFF8F0] py-14 md:py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold tracking-[0.3em] text-[#8B6F47]">PACKAGES</p>
            <h2 className="mt-2 text-2xl font-extrabold text-[#2D5A3D] md:text-3xl">
              규모에 맞는 3가지 패키지
            </h2>
            <p className="mt-2 text-sm text-[#6B6560]">
              모든 패키지는 기본 구성이며, 맞춤 상담 시 조정 가능합니다.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {PACKAGES.map((pkg) => (
              <div
                key={pkg.key}
                className={`relative flex flex-col rounded-2xl border p-6 shadow-sm transition-all hover:shadow-md ${pkg.accent}`}
              >
                {pkg.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#B8860B] px-3 py-1 text-[11px] font-bold text-white shadow">
                    {pkg.badge}
                  </span>
                )}
                <div className="text-4xl">{pkg.medal}</div>
                <h3 className="mt-2 text-xl font-extrabold text-[#2D5A3D]">{pkg.title}</h3>
                <div className="mt-1 text-[11px] text-[#8B6F47]">{pkg.priceNote}</div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-[#2C2C2C]">{pkg.priceLabel}</span>
                </div>
                <div className="mt-1 text-xs font-medium text-[#6B6560]">
                  권장 인원 {pkg.capacity}
                </div>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {pkg.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[#2C2C2C]">
                      <span className="mt-0.5 text-[#2D5A3D]">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={`#inquiry`}
                  className={`mt-6 inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-colors ${pkg.button}`}
                >
                  {pkg.title} 상담
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Case Studies */}
      <section className="bg-[#E8F0E4]/50 py-14 md:py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold tracking-[0.3em] text-[#8B6F47]">CASE STUDIES</p>
            <h2 className="mt-2 text-2xl font-extrabold text-[#2D5A3D] md:text-3xl">
              실제 기업 사례
            </h2>
            <p className="mt-2 text-sm text-[#6B6560]">
              토리로와 함께 숲길을 걸어간 고객사들의 이야기입니다.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {CASE_STUDIES.map((c) => (
              <article
                key={c.title}
                className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm"
              >
                <div className="flex h-32 items-center justify-center rounded-xl bg-gradient-to-br from-[#E8F0E4] to-[#D4E4BC] text-5xl">
                  📊 <span className="ml-1 text-4xl">{c.emoji}</span>
                </div>
                <h3 className="mt-4 font-extrabold text-[#2D5A3D]">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#6B6560]">{c.summary}</p>
                <ul className="mt-3 space-y-1">
                  {c.metrics.map((m) => (
                    <li
                      key={m}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#2D5A3D]"
                    >
                      <span className="text-[#B8860B]">★</span>
                      {m}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ESG Impact */}
      <section className="bg-[#E8F4FB] py-14 md:py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold tracking-[0.3em] text-[#4A7C59]">ESG IMPACT</p>
            <h2 className="mt-2 text-2xl font-extrabold text-[#2D5A3D] md:text-3xl">
              숲 속에서 만드는 ESG 임팩트
            </h2>
            <p className="mt-2 text-sm text-[#6B6560]">
              재미있는 체험이 곧 회사의 공식 ESG 실적이 됩니다.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            {ESG_ITEMS.map((e) => (
              <div
                key={e.title}
                className="rounded-2xl border border-white bg-white/70 p-5 shadow-sm backdrop-blur"
              >
                <div className="text-4xl">{e.emoji}</div>
                <h3 className="mt-3 text-base font-extrabold text-[#2D5A3D]">{e.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#6B6560]">{e.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <Link
              href="/enterprise/esg-sample"
              className="inline-flex items-center gap-2 rounded-xl bg-[#2D5A3D] px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:translate-y-[-1px] hover:bg-[#3A7A52] hover:shadow-lg"
            >
              📄 ESG 리포트 샘플 자세히 보기 →
            </Link>
            <p className="text-[11px] text-[#6B6560]">
              실제 B2B 고객사에 전달되는 공식 리포트 양식을 확인해보세요
            </p>
          </div>
        </div>
      </section>

      {/* Inquiry Form */}
      <section className="bg-[#FFF8F0] py-14 md:py-20">
        <div className="mx-auto max-w-3xl px-4">
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold tracking-[0.3em] text-[#8B6F47]">INQUIRY</p>
            <h2 className="mt-2 text-2xl font-extrabold text-[#2D5A3D] md:text-3xl">
              상담 신청하기
            </h2>
            <p className="mt-2 text-sm text-[#6B6560]">
              아래 정보를 남겨주시면, 영업일 기준 1~2일 내 담당 PM이 연락드립니다.
            </p>
          </div>
          <InquiryForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#D4E4BC] bg-white py-8">
        <div className="mx-auto max-w-5xl px-4 text-center text-xs text-[#8B6F47]">
          <p className="flex items-center justify-center gap-1 font-bold text-[#2D5A3D]">
            <AcornIcon />
            <span>토리로</span>
          </p>
          <p className="mt-2">기업 ESG 팀빌딩 · 가족 참여 이벤트 · 맞춤형 숲길 프로그램</p>
          <p className="mt-2">문의: enterprise@toriro.kr</p>
        </div>
      </footer>
    </div>
  );
}
