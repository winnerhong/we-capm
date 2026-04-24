import type { Metadata } from "next";
import Link from "next/link";
import { AcornIcon } from "@/components/acorn-icon";

export const metadata: Metadata = {
  title: "ESG 임팩트 리포트 샘플 · 토리로",
  description:
    "토리로 엔터프라이즈가 제공하는 ESG 공식 리포트 샘플. 실제 기업 고객사에 전달되는 리포트 양식을 확인해보세요.",
};

// 현실적인 모의 데이터
const MOCK_DATA = {
  companyName: "A 은행",
  reportTitle: "2026년 1분기 ESG 임팩트 리포트",
  period: "2026년 1월 ~ 3월",
  totalScore: 87,
  grade: "AA",
  environmental: {
    co2Saved: 1240,
    treesPlanted: 340,
    greenActivitiesHours: 2400,
    yeouidoEq: 1.48,
  },
  social: {
    familiesConnected: 280,
    childrenParticipated: 504,
    schoolsSupported: 12,
    averageRating: 4.7,
  },
  governance: {
    transparencyScore: 92,
    localBusinessesEngaged: 34,
    partnerPrograms: 8,
  },
  envScore: 82,
  socialScore: 88,
  govScore: 91,
  trend: [
    { month: "11월", participants: 45, co2: 22.5 },
    { month: "12월", participants: 120, co2: 60 },
    { month: "1월", participants: 320, co2: 160 },
    { month: "2월", participants: 480, co2: 240 },
    { month: "3월", participants: 720, co2: 360 },
    { month: "4월", participants: 800, co2: 400 },
  ],
  events: [
    { name: "임직원 봄 숲 나들이", date: "2026-02-14", participants: 240, co2: 120 },
    { name: "고객 가족 초청 ESG 캠페인", date: "2026-03-08", participants: 380, co2: 190 },
    { name: "신입사원 팀빌딩 워크숍", date: "2026-03-22", participants: 180, co2: 90 },
  ],
};

export default function ESGSamplePage() {
  const m = MOCK_DATA;
  const maxParticipants = Math.max(...m.trend.map((t) => t.participants), 1);

  return (
    <div className="min-h-dvh bg-[#FFF8F0] text-[#2C2C2C]">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-[#D4E4BC] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/enterprise" className="flex items-center gap-2 font-bold text-[#2D5A3D]">
            <AcornIcon size={20} />
            <span>토리로</span>
            <span className="text-xs font-medium text-[#8B6F47]">for Enterprise</span>
          </Link>
          <Link
            href="/enterprise#inquiry"
            className="rounded-full bg-[#2D5A3D] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#3A7A52]"
          >
            상담 신청
          </Link>
        </div>
      </header>

      {/* Sample Notice */}
      <div className="bg-amber-50 border-b border-amber-200 py-2">
        <div className="mx-auto max-w-4xl px-4 text-center text-xs text-amber-800">
          💡 본 페이지는 <strong>샘플 리포트</strong>입니다 — 실제 기업 고객사에는 맞춤형 리포트가 제공됩니다.
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        {/* 리포트 헤더 */}
        <section className="rounded-2xl bg-gradient-to-br from-[#1F3D2B] via-[#2D5A3D] to-[#4A7C59] p-8 text-white shadow-lg relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-20">
            <div className="absolute right-6 top-4 text-7xl">🌿</div>
            <div className="absolute right-20 bottom-4 text-5xl">🍃</div>
          </div>
          <div className="relative z-10">
            <div className="inline-block rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[10px] font-bold tracking-widest">
              TORIRO ESG REPORT
            </div>
            <h1 className="mt-3 text-3xl font-extrabold md:text-4xl">{m.companyName}</h1>
            <p className="mt-1 text-lg opacity-95">{m.reportTitle}</p>
            <p className="mt-2 text-xs opacity-75">리포트 기간 · {m.period}</p>
          </div>
        </section>

        {/* 총 점수 */}
        <section className="rounded-2xl border-2 border-amber-400 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold tracking-widest text-[#6B6560]">
                TOTAL ESG SCORE
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-6xl font-extrabold text-[#2D5A3D]">{m.totalScore}</span>
                <span className="text-xl font-bold text-[#6B6560]">/100</span>
              </div>
              <p className="mt-1 text-xs text-[#6B6560]">국제 ESG 평가 기준 가중 평균</p>
            </div>
            <div className="rounded-2xl border-2 border-amber-400 bg-amber-100 px-6 py-4 text-center shadow">
              <div className="text-5xl font-extrabold text-amber-700">{m.grade}</div>
              <div className="mt-1 text-[10px] font-bold text-amber-700 tracking-widest">GRADE</div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <ScoreBar label="Environmental" emoji="🌳" value={m.envScore} color="bg-green-500" />
            <ScoreBar label="Social" emoji="🤝" value={m.socialScore} color="bg-sky-500" />
            <ScoreBar label="Governance" emoji="⚖️" value={m.govScore} color="bg-amber-500" />
          </div>
        </section>

        {/* Executive Summary */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-6">
          <h2 className="font-extrabold text-[#2D5A3D]">📋 Executive Summary</h2>
          <p className="mt-3 text-sm leading-relaxed text-[#2C2C2C]">
            {m.companyName}는 2026년 1분기 동안 토리로 플랫폼을 통해 총 <strong>3건의 ESG 이벤트</strong>를
            진행했으며, 임직원과 고객 가족 <strong>280가구·1,244명</strong>이 참여했습니다.
            이를 통해 <strong>1,240kg의 CO2 절감 효과</strong>(여의도 공원 1.48개 면적)를 달성했으며,
            참가자 만족도는 <strong>4.7/5</strong>로 업계 평균을 상회했습니다.
            리뷰 공개율 92%, 지역 상공인 34곳 연계로 거버넌스 점수 91점을 기록했습니다.
          </p>
        </section>

        {/* Environmental */}
        <section className="rounded-2xl border border-green-200 bg-green-50/50 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-green-800 flex items-center gap-2 text-lg">
              <span>🌳</span>
              <span>환경 (Environmental)</span>
            </h2>
            <span className="text-sm font-bold text-green-700">{m.envScore}/100</span>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-white border border-green-200 p-4">
              <div className="text-[10px] font-bold uppercase text-green-700">CO2 절감량</div>
              <div className="mt-2 text-3xl font-extrabold text-green-900">
                {m.environmental.co2Saved.toLocaleString("ko-KR")}
                <span className="text-sm font-semibold"> kg</span>
              </div>
              <div className="mt-1 text-[11px] text-green-700">실내 활동 대비 숲 체험</div>
            </div>
            <div className="rounded-xl bg-white border border-green-200 p-4">
              <div className="text-[10px] font-bold uppercase text-green-700">가상 나무</div>
              <div className="mt-2 text-3xl font-extrabold text-green-900">
                {m.environmental.treesPlanted.toLocaleString("ko-KR")}
                <span className="text-sm font-semibold"> 그루</span>
              </div>
              <div className="mt-1 text-[11px] text-green-700">도토리 기반 환산</div>
            </div>
            <div className="rounded-xl bg-white border border-green-200 p-4">
              <div className="text-[10px] font-bold uppercase text-green-700">친환경 활동</div>
              <div className="mt-2 text-3xl font-extrabold text-green-900">
                {m.environmental.greenActivitiesHours.toLocaleString("ko-KR")}
                <span className="text-sm font-semibold"> 시간</span>
              </div>
              <div className="mt-1 text-[11px] text-green-700">누적 참여 시간</div>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-gradient-to-r from-green-100 to-lime-100 border border-green-300 p-4">
            <div className="text-xs font-bold text-green-800">🌍 이퀄리턴 효과</div>
            <p className="mt-1 text-sm text-green-900">
              여의도 공원 <strong>{m.environmental.yeouidoEq}개 면적</strong>에 해당하는 녹지 조성 효과
            </p>
          </div>
        </section>

        {/* Social */}
        <section className="rounded-2xl border border-sky-200 bg-sky-50/50 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-sky-800 flex items-center gap-2 text-lg">
              <span>🤝</span>
              <span>사회 (Social)</span>
            </h2>
            <span className="text-sm font-bold text-sky-700">{m.socialScore}/100</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-white border border-sky-200 p-4">
              <div className="text-[10px] font-bold uppercase text-sky-700">연결 가족</div>
              <div className="mt-2 text-2xl font-extrabold text-sky-900">
                {m.social.familiesConnected.toLocaleString("ko-KR")}
              </div>
            </div>
            <div className="rounded-xl bg-white border border-sky-200 p-4">
              <div className="text-[10px] font-bold uppercase text-sky-700">어린이 참여</div>
              <div className="mt-2 text-2xl font-extrabold text-sky-900">
                {m.social.childrenParticipated.toLocaleString("ko-KR")}
              </div>
            </div>
            <div className="rounded-xl bg-white border border-sky-200 p-4">
              <div className="text-[10px] font-bold uppercase text-sky-700">협력 학교</div>
              <div className="mt-2 text-2xl font-extrabold text-sky-900">
                {m.social.schoolsSupported.toLocaleString("ko-KR")}
              </div>
            </div>
            <div className="rounded-xl bg-white border border-sky-200 p-4">
              <div className="text-[10px] font-bold uppercase text-sky-700">만족도</div>
              <div className="mt-2 text-2xl font-extrabold text-sky-900">
                {m.social.averageRating.toFixed(1)}
                <span className="text-xs font-semibold"> / 5</span>
              </div>
            </div>
          </div>
        </section>

        {/* Governance */}
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-amber-800 flex items-center gap-2 text-lg">
              <span>⚖️</span>
              <span>거버넌스 (Governance)</span>
            </h2>
            <span className="text-sm font-bold text-amber-700">{m.govScore}/100</span>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-white border border-amber-200 p-4">
              <div className="text-[10px] font-bold uppercase text-amber-700">투명성</div>
              <div className="mt-2 text-2xl font-extrabold text-amber-900">
                {m.governance.transparencyScore}<span className="text-xs">/100</span>
              </div>
              <div className="mt-1 text-[11px] text-amber-700">리뷰 공개율 기반</div>
            </div>
            <div className="rounded-xl bg-white border border-amber-200 p-4">
              <div className="text-[10px] font-bold uppercase text-amber-700">지역 상공인</div>
              <div className="mt-2 text-2xl font-extrabold text-amber-900">
                {m.governance.localBusinessesEngaged.toLocaleString("ko-KR")}
              </div>
              <div className="mt-1 text-[11px] text-amber-700">제휴 쿠폰 파트너</div>
            </div>
            <div className="rounded-xl bg-white border border-amber-200 p-4">
              <div className="text-[10px] font-bold uppercase text-amber-700">파트너 프로그램</div>
              <div className="mt-2 text-2xl font-extrabold text-amber-900">
                {m.governance.partnerPrograms.toLocaleString("ko-KR")}
              </div>
              <div className="mt-1 text-[11px] text-amber-700">협력 운영 프로그램</div>
            </div>
          </div>
        </section>

        {/* 월별 트렌드 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-6">
          <h2 className="font-extrabold text-[#2D5A3D] flex items-center gap-2">
            <span>📊</span>
            <span>월별 임팩트 트렌드</span>
          </h2>
          <p className="mt-1 text-xs text-[#6B6560]">최근 6개월 누적 참여자 및 CO2 절감량</p>
          <div className="mt-5 flex items-end justify-between gap-2 h-48">
            {m.trend.map((t) => {
              const heightPct = (t.participants / maxParticipants) * 100;
              return (
                <div key={t.month} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="text-[10px] font-semibold text-[#2D5A3D]">{t.participants}</div>
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-[#2D5A3D] to-[#4A7C59]"
                    style={{ height: `${Math.max(4, heightPct)}%` }}
                    aria-label={`${t.month} 참가자 ${t.participants}명`}
                  />
                  <div className="text-[10px] text-[#6B6560]">{t.month}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 주요 행사 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-6">
          <h2 className="font-extrabold text-[#2D5A3D]">🌲 주요 행사 실적</h2>
          <div className="mt-4 divide-y divide-[#E8F0E4]">
            {m.events.map((e) => (
              <div key={e.name} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-[#2C2C2C]">{e.name}</div>
                  <div className="text-xs text-[#6B6560]">{e.date}</div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-bold text-[#2D5A3D]">참가 {e.participants}명</div>
                  <div className="text-green-700 font-semibold">CO2 {e.co2}kg 절감</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-8 text-center text-white shadow-lg">
          <h2 className="text-2xl font-extrabold">우리 회사도 이런 리포트를 받고 싶다면?</h2>
          <p className="mt-2 text-sm opacity-90">
            토리로 엔터프라이즈 패키지를 이용하시면 맞춤형 ESG 공식 리포트가 제공됩니다.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/enterprise#inquiry"
              className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#2D5A3D] shadow-md hover:translate-y-[-1px] transition-all"
            >
              상담 신청하기 →
            </Link>
            <Link
              href="/enterprise#packages"
              className="rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
            >
              패키지 보기
            </Link>
          </div>
        </section>

        <p className="text-center text-[10px] text-[#8B6F47] py-4">
          🌲 본 리포트는 토리로 플랫폼 데이터 기반 샘플입니다 · toriro.kr
        </p>
      </main>
    </div>
  );
}

function ScoreBar({
  label,
  emoji,
  value,
  color,
}: {
  label: string;
  emoji: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-semibold mb-1">
        <span className="text-[#2C2C2C]">
          {emoji} {label}
        </span>
        <span className="text-[#2D5A3D]">{value}/100</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-neutral-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${value}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} 점수 ${value}점`}
        />
      </div>
    </div>
  );
}
