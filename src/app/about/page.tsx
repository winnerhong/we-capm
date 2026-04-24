import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { AcornIcon } from "@/components/acorn-icon";

export const metadata: Metadata = {
  title: "회사 소개 · 토리로",
  description:
    "작은 도토리 하나가 숲으로 가는 길을 만들었습니다. 토리로의 미션, 비전, 가치, 그리고 우리가 걸어온 길을 소개합니다.",
};

const VALUES: { emoji: string; title: string; desc: string }[] = [
  {
    emoji: "🌱",
    title: "작은 걸음을 믿는다",
    desc: "한 번의 숲길, 한 명의 아이, 한 가족의 미소. 커다란 변화는 작은 순간의 총합이라고 믿습니다.",
  },
  {
    emoji: "🤝",
    title: "연결을 만든다",
    desc: "가족 안의 연결, 이웃과의 연결, 자연과의 연결. 토리로는 사람이 관계를 쌓는 플랫폼입니다.",
  },
  {
    emoji: "🌲",
    title: "지역과 함께 자란다",
    desc: "수수료가 아니라 지역 경제로 돌아가는 구조를 설계합니다. 우리는 지역 없이 자라지 않습니다.",
  },
  {
    emoji: "✨",
    title: "쉬움에 집착한다",
    desc: "복잡한 줄 세우기 없이, 3분 안에 오늘의 숲길을 떠날 수 있도록. 쉬움이 곧 품질입니다.",
  },
];

const MILESTONES: {
  date: string;
  emoji: React.ReactNode;
  title: string;
  desc: string;
}[] = [
    {
      date: "2025.02",
      emoji: <AcornIcon size={18} />,
      title: "팀 결성",
      desc: "창업자 홍보광 포함 3인이 도토리 하나를 들고 시작했습니다.",
    },
    {
      date: "2025.05",
      emoji: "🗺️",
      title: "첫 숲길 오픈",
      desc: "경기 양평에서 12가족과 함께 첫 체험을 진행했습니다.",
    },
    {
      date: "2025.09",
      emoji: "🤝",
      title: "파트너 50곳 돌파",
      desc: "전국 숲지기 50곳이 토리로에 합류했습니다.",
    },
    {
      date: "2025.12",
      emoji: "🏢",
      title: "첫 B2B 계약",
      desc: "IT 대기업 임직원 250명과 ESG 프로그램을 함께 진행했습니다.",
    },
    {
      date: "2026.03",
      emoji: "🌸",
      title: "봄 시즌 42개 코스",
      desc: "신규 7개 코스 포함 전국 42개 숲길이 동시 오픈했습니다.",
    },
    {
      date: "2026.04",
      emoji: "📱",
      title: "앱 v2.0 공개",
      desc: "오프라인 모드와 가족 채팅방을 포함한 대규모 업데이트.",
    },
  ];

const MEDIA: { source: string; quote: string }[] = [
  {
    source: "한겨레 · 2026.03",
    quote: "'가족이 걷는다'는 단순한 문장에 진심을 담은 스타트업.",
  },
  {
    source: "조선일보 · 2026.02",
    quote: "ESG가 리포트에서 일상으로 내려오는 순간.",
  },
  {
    source: "MBC 뉴스 · 2026.01",
    quote: "지역 소상공인들의 얼굴에 먼저 웃음이 번졌다.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-dvh bg-[#FFF8F0] text-[#2C2C2C]">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-[#D4E4BC] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-[#2D5A3D]"
          >
            <AcornIcon size={20} />
            <span>토리로</span>
          </Link>
          <nav className="flex items-center gap-1 text-xs font-semibold">
            <Link
              href="/blog"
              className="rounded-full px-3 py-1.5 text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              블로그
            </Link>
            <Link
              href="/faq"
              className="rounded-full px-3 py-1.5 text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              FAQ
            </Link>
            <Link
              href="/partner"
              className="rounded-full bg-[#2D5A3D] px-3 py-1.5 text-white hover:bg-[#234a30]"
            >
              숲지기
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1F3D2B] via-[#2D5A3D] to-[#4A7C59] text-white">
        <div className="pointer-events-none absolute inset-0 opacity-15">
          <div className="absolute left-8 top-8 text-7xl">🌲</div>
          <div className="absolute right-12 top-16 text-6xl">🌳</div>
          <div className="absolute bottom-10 left-1/3 text-6xl"><AcornIcon size={60} /></div>
        </div>
        <div className="relative z-10 mx-auto max-w-4xl px-4 py-16 text-center md:py-24">
          <p className="text-xs font-semibold tracking-[0.4em] text-[#D4E4BC]">
            ABOUT TORIRO
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-snug md:text-5xl">
            작은 도토리 하나가
            <br />
            숲으로 가는 길을 만들었습니다
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-[#E8F0E4] md:text-lg">
            토리로는 가족 · 기관 · 숲지기 · 기업을 연결해
            <br className="hidden sm:inline" />
            숲에서 일어나는 작은 기적을 만듭니다.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-5xl space-y-20 px-4 py-14 md:py-20">
        {/* Mission / Vision */}
        <section aria-labelledby="mission-heading">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-[0.3em] text-[#8B6F47]">
              MISSION & VISION
            </p>
            <h2
              id="mission-heading"
              className="mt-2 text-2xl font-extrabold text-[#2D5A3D] md:text-3xl"
            >
              우리가 만들고 싶은 세상
            </h2>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
            <article className="rounded-3xl border border-[#D4E4BC] bg-white p-7 shadow-sm">
              <p className="text-3xl" aria-hidden>
                🎯
              </p>
              <h3 className="mt-3 text-lg font-extrabold text-[#2D5A3D]">
                미션
              </h3>
              <p className="mt-3 text-[15px] leading-[1.9] text-[#2C2C2C]">
                가족이 함께 걷는 숲길을, 누구나 오늘 떠날 수 있게.
                <br />
                지역의 숲지기가 자긍심을 갖고 운영할 수 있게.
              </p>
            </article>
            <article className="rounded-3xl border border-[#D4E4BC] bg-white p-7 shadow-sm">
              <p className="text-3xl" aria-hidden>
                🌄
              </p>
              <h3 className="mt-3 text-lg font-extrabold text-[#2D5A3D]">
                비전
              </h3>
              <p className="mt-3 text-[15px] leading-[1.9] text-[#2C2C2C]">
                2030년까지 전국 500개 숲길, 100만 가족이
                <br />
                토리로에서 매주 새로운 숲을 만나는 것.
              </p>
            </article>
          </div>
        </section>

        {/* Values */}
        <section aria-labelledby="values-heading">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-[0.3em] text-[#8B6F47]">
              VALUES
            </p>
            <h2
              id="values-heading"
              className="mt-2 text-2xl font-extrabold text-[#2D5A3D] md:text-3xl"
            >
              우리가 믿는 네 가지
            </h2>
          </div>
          <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {VALUES.map((v) => (
              <li
                key={v.title}
                className="rounded-2xl border border-[#D4E4BC] bg-white p-6 shadow-sm"
              >
                <p className="text-3xl" aria-hidden>
                  {v.emoji}
                </p>
                <h3 className="mt-3 text-base font-extrabold text-[#2D5A3D]">
                  {v.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#6B6560]">
                  {v.desc}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Team */}
        <section aria-labelledby="team-heading" className="text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-[#8B6F47]">
            TEAM
          </p>
          <h2
            id="team-heading"
            className="mt-2 text-2xl font-extrabold text-[#2D5A3D] md:text-3xl"
          >
            숲을 걷는 사람들
          </h2>
          <div className="mt-8 rounded-3xl border border-[#D4E4BC] bg-white p-8 shadow-sm md:p-12">
            <div className="flex flex-wrap justify-center gap-6 text-center">
              {[
                { emoji: "🌲", name: "홍보광", role: "창업자 · CEO" },
                { emoji: "🗺️", name: "지역 매니저", role: "전국 8인" },
                { emoji: "🎨", name: "디자인 · 프로덕트", role: "4인" },
                { emoji: "🔧", name: "엔지니어링", role: "5인" },
                { emoji: "🏕️", name: "현장 운영", role: "파트타임 32인" },
              ].map((m) => (
                <div key={m.name} className="w-28">
                  <div
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F0E4] text-3xl"
                    aria-hidden
                  >
                    {m.emoji}
                  </div>
                  <p className="mt-2 text-sm font-bold text-[#2D5A3D]">
                    {m.name}
                  </p>
                  <p className="text-[11px] text-[#8B6F47]">{m.role}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-[#6B6560]">
              함께 일하고 싶은 분은{" "}
              <a
                href="mailto:careers@toriro.kr"
                className="font-semibold text-[#2D5A3D] underline underline-offset-2"
              >
                careers@toriro.kr
              </a>
              로 연락 주세요.
            </p>
          </div>
        </section>

        {/* Milestones */}
        <section aria-labelledby="milestones-heading">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-[0.3em] text-[#8B6F47]">
              MILESTONES
            </p>
            <h2
              id="milestones-heading"
              className="mt-2 text-2xl font-extrabold text-[#2D5A3D] md:text-3xl"
            >
              우리가 걸어온 길
            </h2>
          </div>

          <ol className="relative mt-10 space-y-6 border-l-2 border-[#D4E4BC] pl-6 md:pl-8">
            {MILESTONES.map((m) => (
              <li key={m.date} className="relative">
                <span
                  className="absolute -left-[33px] flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#D4E4BC] bg-white text-lg shadow-sm md:-left-[41px]"
                  aria-hidden
                >
                  {m.emoji}
                </span>
                <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold tracking-wider text-[#8B6F47]">
                    {m.date}
                  </p>
                  <h3 className="mt-1 text-base font-extrabold text-[#2D5A3D]">
                    {m.title}
                  </h3>
                  <p className="mt-1 text-sm text-[#6B6560]">{m.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Media */}
        <section aria-labelledby="media-heading">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-[0.3em] text-[#8B6F47]">
              PRESS
            </p>
            <h2
              id="media-heading"
              className="mt-2 text-2xl font-extrabold text-[#2D5A3D] md:text-3xl"
            >
              토리로에 관해 언급된 이야기
            </h2>
          </div>
          <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {MEDIA.map((m) => (
              <li
                key={m.source}
                className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm"
              >
                <p className="text-xs font-bold text-[#8B6F47]">{m.source}</p>
                <p className="mt-3 text-sm leading-relaxed text-[#2C2C2C]">
                  “{m.quote}”
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-center text-xs text-[#8B6F47]">
            언론 문의: press@toriro.kr
          </p>
        </section>

        {/* Contact */}
        <section aria-labelledby="contact-heading">
          <div className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] to-[#FFF8F0] p-8 text-center shadow-sm md:p-12">
            <p className="text-[#2D5A3D]">
              <AcornIcon size={36} />
            </p>
            <h2
              id="contact-heading"
              className="mt-3 text-2xl font-extrabold text-[#2D5A3D] md:text-3xl"
            >
              함께 숲을 걸어요
            </h2>
            <p className="mt-2 text-sm text-[#6B6560]">
              어떤 이야기도 환영합니다. 편하게 연락 주세요.
            </p>
            <dl className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-3 text-left text-sm md:grid-cols-3">
              <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
                <dt className="text-xs font-bold text-[#8B6F47]">일반</dt>
                <dd className="mt-1 font-semibold text-[#2D5A3D]">
                  hello@toriro.kr
                </dd>
              </div>
              <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
                <dt className="text-xs font-bold text-[#8B6F47]">기업</dt>
                <dd className="mt-1 font-semibold text-[#2D5A3D]">
                  biz@toriro.kr
                </dd>
              </div>
              <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
                <dt className="text-xs font-bold text-[#8B6F47]">숲지기</dt>
                <dd className="mt-1 font-semibold text-[#2D5A3D]">
                  partner@toriro.kr
                </dd>
              </div>
            </dl>
            <p className="mt-6 text-xs text-[#8B6F47]">
              서울특별시 성동구 성수동 1가 숲속로 25 · 고객센터 1544-0000
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
