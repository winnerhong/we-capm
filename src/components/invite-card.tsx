import Link from "next/link";

export function InviteCard({ eventId }: { eventId: string }) {
  return (
    <Link
      href={`/event/${eventId}/invite`}
      className="block rounded-2xl border-2 border-dashed border-[#C4956A]/60 bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] p-4 transition-colors hover:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A] focus:ring-offset-2"
      aria-label="친구 초대하기 페이지로 이동"
    >
      <div className="flex items-center gap-3">
        <div className="text-3xl" aria-hidden>
          🎁
        </div>
        <div className="flex-1">
          <p className="font-bold text-[#2D5A3D]">친구 초대하고 🌰 20개 받기</p>
          <p className="text-xs text-[#6B6560] mt-0.5">둘 다 도토리 20개씩!</p>
        </div>
        <span className="text-[#C4956A]" aria-hidden>
          →
        </span>
      </div>
    </Link>
  );
}
