export function PressLogos() {
  const sources = [
    "한국경제",
    "매일경제",
    "조선일보",
    "중앙일보",
    "교육부 인증",
    "ESG 우수 기업",
  ];
  return (
    <div className="py-12 border-y border-[#D4E4BC] bg-[#FFF8F0]">
      <p className="text-center text-xs text-[#6B6560] mb-4">
        이런 곳에서 주목받고 있어요
      </p>
      <div className="flex flex-wrap justify-center items-center gap-6 md:gap-8 px-4">
        {sources.map((s) => (
          <div
            key={s}
            className="text-sm font-bold text-[#8B6F47] opacity-60 hover:opacity-100 transition-opacity"
          >
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
