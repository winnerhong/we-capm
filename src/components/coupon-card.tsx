import Link from "next/link";

interface CouponCardProps {
  eventId?: string;
  giftCount?: number;
}

export function CouponCard({ eventId, giftCount }: CouponCardProps) {
  const hasGifts = typeof giftCount === "number" && giftCount > 0;

  const inner = (
    <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex items-center gap-3 transition-all hover:shadow-md">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#C4956A] to-[#8B6F47] text-white text-xl">
        🎁
      </div>
      <div className="flex-1">
        <p className="text-xs text-[#C4956A] font-bold">오늘의 선물</p>
        <p className="text-sm font-semibold text-[#2C2C2C] mt-0.5">
          {hasGifts
            ? `숲길을 걸은 당신에게 ${giftCount}개의 선물이 도착했어요`
            : "미션을 완료하면 주변 상점 쿠폰이 열려요"}
        </p>
      </div>
      {hasGifts ? (
        <span className="text-[10px] rounded-full bg-[#C4956A] px-2 py-1 text-white font-bold">
          {giftCount}개
        </span>
      ) : (
        <span className="text-[10px] rounded-full bg-[#FFF8F0] border border-[#D4E4BC] px-2 py-1 text-[#6B6560]">
          곧
        </span>
      )}
    </div>
  );

  if (eventId) {
    return (
      <Link href={`/event/${eventId}/gifts`} className="block">
        {inner}
      </Link>
    );
  }

  return inner;
}
