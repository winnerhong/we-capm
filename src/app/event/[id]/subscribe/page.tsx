"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useState } from "react";
import { SubscribeCard, type Tier } from "./subscribe-card";

const TIERS: Tier[] = [
  {
    id: "sprout",
    emoji: "🌱",
    name: "새싹 플랜",
    price: 59000,
    discount: 27,
    isPopular: false,
    features: [
      "월 2회 다람이 참여 가능",
      "🌰 매월 도토리 500개",
      "기본 사진 무료",
      "일반 대비 27% 할인",
    ],
  },
  {
    id: "tree",
    emoji: "🌳",
    name: "나무 플랜",
    price: 99000,
    discount: 38,
    isPopular: true,
    features: [
      "월 4회 다람이 참여 가능",
      "🌰 매월 도토리 1,200개",
      "기본 사진 + 영상 무료",
      "우선 예약권",
      "가맹점 쿠폰 월 3장",
      "일반 대비 38% 할인",
    ],
  },
  {
    id: "forest",
    emoji: "🏞️",
    name: "숲 플랜 VIP",
    price: 159000,
    discount: 50,
    isPopular: false,
    features: [
      "월 무제한 다람이 참여",
      "🌰 매월 도토리 2,500개",
      "📦 월간 구독 박스 포함",
      "🎁 오늘 사진 1회 무료",
      "모든 행사 우선 예약",
      "전담 매니저 케어",
      "가족 2팀까지 공동 사용",
    ],
  },
];

const COMPARE_ROWS: Array<{ label: string; sprout: string; tree: string; forest: string }> = [
  { label: "월 참여 횟수", sprout: "2회", tree: "4회", forest: "무제한" },
  { label: "도토리 지급", sprout: "500개", tree: "1,200개", forest: "2,500개" },
  { label: "사진/영상", sprout: "사진", tree: "사진+영상", forest: "사진+영상+박스" },
  { label: "우선 예약", sprout: "—", tree: "✓", forest: "✓ (최우선)" },
  { label: "가맹점 쿠폰", sprout: "—", tree: "월 3장", forest: "월 5장" },
  { label: "전담 매니저", sprout: "—", tree: "—", forest: "✓" },
  { label: "가족 공동 사용", sprout: "—", tree: "—", forest: "2팀" },
  { label: "할인율", sprout: "27%", tree: "38%", forest: "50%" },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "구독은 언제든 해지할 수 있나요?",
    a: "네, 언제든지 마이페이지에서 한 번의 클릭으로 해지하실 수 있어요. 해지 시 다음 결제일부터 자동 결제가 중단되며, 이미 결제한 달은 마지막 날까지 모든 혜택을 계속 이용하실 수 있어요.",
  },
  {
    q: "가족 2팀 공동 사용이 뭐예요?",
    a: "🏞️ 숲 플랜은 할머니·할아버지 가족과 이모·삼촌 가족처럼 대가족을 위한 특별 혜택이에요. 두 가족이 도토리와 예약권을 함께 사용할 수 있어서, 따로 구독하는 것보다 훨씬 경제적이에요.",
  },
  {
    q: "도토리는 어떻게 쓰나요?",
    a: "🌰 도토리는 행사 현장에서 간식·기념품으로 바꾸거나, 제휴 가맹점(카페·숙소·체험장)에서 할인에 쓸 수 있어요. 1도토리 = 약 100원 가치예요.",
  },
  {
    q: "환불은 가능한가요?",
    a: "첫 결제 후 7일 이내, 다람이 참여 이력이 없으면 전액 환불해 드려요. 이후에는 남은 기간에 대해 일할 계산으로 환불됩니다. 자세한 규정은 이용약관을 참고해 주세요.",
  },
];

export default function SubscribePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const eventId = params?.id ?? "";

  const [selected, setSelected] = useState<Tier["id"]>("tree");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <main className="min-h-dvh bg-[#FFF8F0] pb-24">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 border-b border-[#E6D3B8]/60 bg-[#FFF8F0]/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="뒤로 가기"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#2D5A3D] transition-colors hover:bg-[#D4E4BC]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <span aria-hidden="true">←</span>
          </button>
          <h1 className="text-sm font-bold text-[#2D5A3D]">🌳 나만의 숲길 구독</h1>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 pt-6">
        {/* Hero */}
        <section className="text-center">
          <h2 className="text-2xl font-extrabold text-[#2D5A3D] md:text-4xl">
            🌳 나만의 숲길 구독
          </h2>
          <p className="mt-2 text-sm text-[#6B6560] md:text-base">
            매달 새로운 숲길을 만나보세요
          </p>
          <p className="mt-1 text-xs text-[#8B6F47] md:text-sm">
            한 달에 한 번, 우리 가족만의 특별한 이야기를 ✨
          </p>
        </section>

        {/* Tier cards */}
        <section
          aria-label="구독 플랜 선택"
          className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3 md:items-stretch"
        >
          {TIERS.map((tier) => (
            <SubscribeCard
              key={tier.id}
              tier={tier}
              selected={selected === tier.id}
              onSelect={setSelected}
              eventId={eventId}
            />
          ))}
        </section>

        {/* 혜택 비교 표 */}
        <section aria-labelledby="compare-title" className="mt-14">
          <h3
            id="compare-title"
            className="text-center text-xl font-bold text-[#2D5A3D] md:text-2xl"
          >
            🌿 구독 혜택 한눈에 비교
          </h3>
          <p className="mt-1 text-center text-xs text-[#6B6560]">
            어떤 플랜이 우리 가족에게 맞을까요?
          </p>

          <div className="mt-6 overflow-hidden rounded-3xl border border-[#E6D3B8] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="bg-[#FFF8F0] text-[#2D5A3D]">
                    <th scope="col" className="px-4 py-3 text-left font-semibold">
                      혜택
                    </th>
                    <th scope="col" className="px-4 py-3 text-center font-semibold">
                      🌱 새싹
                    </th>
                    <th scope="col" className="bg-[#2D5A3D]/10 px-4 py-3 text-center font-bold text-[#2D5A3D]">
                      🌳 나무
                    </th>
                    <th scope="col" className="px-4 py-3 text-center font-semibold">
                      🏞️ 숲
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row, i) => (
                    <tr
                      key={row.label}
                      className={i % 2 === 0 ? "bg-white" : "bg-[#FFF8F0]/50"}
                    >
                      <th
                        scope="row"
                        className="px-4 py-3 text-left font-medium text-[#3C3731]"
                      >
                        {row.label}
                      </th>
                      <td className="px-4 py-3 text-center text-[#6B6560]">
                        {row.sprout}
                      </td>
                      <td className="bg-[#2D5A3D]/5 px-4 py-3 text-center font-semibold text-[#2D5A3D]">
                        {row.tree}
                      </td>
                      <td className="px-4 py-3 text-center text-[#8B6F47]">
                        {row.forest}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-title" className="mt-14">
          <h3
            id="faq-title"
            className="text-center text-xl font-bold text-[#2D5A3D] md:text-2xl"
          >
            🙋 자주 묻는 질문
          </h3>
          <p className="mt-1 text-center text-xs text-[#6B6560]">
            궁금한 점이 있으시면 편하게 물어봐 주세요
          </p>

          <div className="mx-auto mt-6 max-w-2xl space-y-3">
            {FAQS.map((f, idx) => {
              const open = openFaq === idx;
              return (
                <div
                  key={f.q}
                  className="overflow-hidden rounded-2xl border border-[#E6D3B8] bg-white"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : idx)}
                    aria-expanded={open}
                    aria-controls={`faq-panel-${idx}`}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-[#FFF8F0] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                  >
                    <span className="text-sm font-semibold text-[#2D5A3D]">
                      Q. {f.q}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`text-[#8B6F47] transition-transform ${open ? "rotate-180" : ""}`}
                    >
                      ▼
                    </span>
                  </button>
                  {open && (
                    <div
                      id={`faq-panel-${idx}`}
                      className="border-t border-[#E6D3B8]/60 bg-[#FFF8F0]/40 px-5 py-4 text-sm leading-relaxed text-[#3C3731]"
                    >
                      {f.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 먼저 체험하기 CTA */}
        <section className="mt-14">
          <div className="mx-auto max-w-2xl rounded-3xl bg-gradient-to-br from-[#D4E4BC] via-[#FFF8F0] to-[#E6D3B8] p-6 text-center shadow-sm md:p-8">
            <div className="text-3xl" aria-hidden="true">
              🐿️
            </div>
            <h3 className="mt-2 text-lg font-bold text-[#2D5A3D] md:text-xl">
              구독이 망설여지나요?
            </h3>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              먼저 한 번, 가볍게 숲길을 걸어보세요. 우리 가족에게 맞는지 확인하고 구독해도 늦지 않아요.
            </p>
            <Link
              href={eventId ? `/event/${eventId}` : "/"}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-300"
            >
              🌿 먼저 체험하기 <span aria-hidden="true">→</span>
            </Link>
            <p className="mt-3 text-[10px] text-[#6B6560]">
              단건 결제로 바로 시작할 수 있어요
            </p>
          </div>
        </section>

        {/* 하단 여백 문구 */}
        <p className="mt-10 text-center text-[10px] text-[#8B6F47]">
          · 본 페이지의 가격은 예정 안내이며, 실제 결제는 추후 오픈됩니다 ·
        </p>
      </div>
    </main>
  );
}
