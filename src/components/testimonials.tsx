const TESTIMONIALS = [
  {
    name: "김○○ 어머니",
    event: "해바라기반 봄 소풍",
    quote:
      "아이가 '나무 안아주기' 미션을 제일 좋아했어요. 평소 스마트폰만 보던 아이가 자연에 빠진 게 신기했답니다.",
    rating: 5,
  },
  {
    name: "박○○ 선생님",
    event: "장미반 가을 체험",
    quote:
      "운영이 정말 편해요. 학부모 응대부터 도장까지 토리로가 다 해줘서 교사들이 아이들과 시간을 보낼 수 있었습니다.",
    rating: 5,
  },
  {
    name: "이○○ 가족",
    event: "가평 캠프닉",
    quote:
      "수료증까지 받으니 아이가 뿌듯해하네요. 추억 앨범이 자동으로 만들어져서 나중에 보기 너무 좋아요.",
    rating: 5,
  },
  {
    name: "코스모스반 학부모",
    event: "여름 숲속 탐험",
    quote:
      "도토리를 모으며 미션을 수행하는 게임 같아서 지루할 틈이 없었어요. 한 번 더 참여하고 싶어요!",
    rating: 5,
  },
  {
    name: "최○○ 어머니",
    event: "봄맞이 가족 캠프",
    quote:
      "토리 AI가 친근하게 말을 걸어줘서 아이가 재밌어했어요. 작은 디테일이지만 감동적이었습니다.",
    rating: 4,
  },
  {
    name: "정○○ 기관 담당자",
    event: "5월 어린이날 특별 행사",
    quote:
      "50명이 한꺼번에 입장했는데 QR 스캔으로 정말 빠르게 처리됐어요. 현장 운영이 이렇게 부드러울 수 있다니!",
    rating: 5,
  },
];

function StarRow({ rating }: { rating: number }) {
  return (
    <div
      className="flex gap-0.5"
      aria-label={`5점 만점에 ${rating}점`}
      role="img"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`text-sm ${
            i < rating ? "text-[#E8A33D]" : "text-[#E8E0D0]"
          }`}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <section
      aria-label="이용 후기"
      className="bg-[#FFF8F0] py-14 md:py-20"
    >
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-8 text-center md:mb-12">
          <p className="text-xs font-semibold tracking-[0.3em] text-[#8B6F47]">
            TESTIMONIALS
          </p>
          <h2 className="mt-2 text-2xl font-extrabold text-[#2D5A3D] md:text-3xl">
            숲에서 만난 가족들의 이야기
          </h2>
          <p className="mt-2 text-sm text-[#6B6560]">
            토리로와 함께한 진짜 후기를 만나보세요
          </p>
        </div>

        <ul
          className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5"
          role="list"
        >
          {TESTIMONIALS.map((t, i) => (
            <li
              key={i}
              className="group relative rounded-2xl border border-[#D4E4BC] bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div
                className="absolute -top-3 left-5 select-none font-serif text-5xl leading-none text-[#D4E4BC] transition-colors group-hover:text-[#A8C99C]"
                aria-hidden="true"
              >
                &ldquo;
              </div>
              <StarRow rating={t.rating} />
              <blockquote className="mt-3 font-serif text-sm italic leading-relaxed text-[#2C2C2C] md:text-[15px]">
                {t.quote}
              </blockquote>
              <figcaption className="mt-4 border-t border-[#E8F0E4] pt-3">
                <p className="text-sm font-bold text-[#2D5A3D]">{t.name}</p>
                <p className="mt-0.5 text-xs text-[#8B6F47]">{t.event}</p>
              </figcaption>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
