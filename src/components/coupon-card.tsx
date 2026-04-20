"use client";

export function CouponCard() {
  return (
    <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#C4956A] to-[#8B6F47] text-white text-xl">
        🎁
      </div>
      <div className="flex-1">
        <p className="text-xs text-[#C4956A] font-bold">오늘의 선물</p>
        <p className="text-sm font-semibold text-[#2C2C2C] mt-0.5">미션을 완료하면 주변 상점 쿠폰이 열려요</p>
      </div>
      <span className="text-[10px] rounded-full bg-[#FFF8F0] border border-[#D4E4BC] px-2 py-1 text-[#6B6560]">곧</span>
    </div>
  );
}
