// 스탬프북을 여는 동안 — 누른 즉시 이 화면이 뜬다(사용자 2026-10-30 "스탬프 눌러도 변화가 없다").
//   스탬프북은 스탬프북 고르기 → 한 권이면 그 책으로 다시 보내는 길이라 서버가 두 번 일한다. 그동안 빈 화면 대신 이 틀.
import { AcornIcon } from "@/components/acorn-icon";

export default function StampbookLoading() {
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-6" aria-busy="true" aria-label="스탬프북 불러오는 중">
      <div className="flex items-center gap-2 text-[#2D5A3D]">
        <span className="animate-bounce"><AcornIcon size={22} /></span>
        <span className="text-[15px] font-bold">스탬프북 여는 중…</span>
      </div>
      <div className="h-28 animate-pulse rounded-3xl bg-[#E8EFDD]" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-2xl bg-[#EEF3E6]" />
        ))}
      </div>
    </div>
  );
}
