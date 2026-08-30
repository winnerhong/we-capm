// 아직 못 여는 화면 — 왜 못 쓰는지 말하고 돌아갈 길을 준다.
//
// 예전엔 각 페이지가 `redirect(ctx.href())` 로 행사홈에 **말없이** 되돌렸다.
// 하단 탭이 행사 상태에 따라 사라지던 때는 그래도 됐다(잠긴 탭은 애초에 안 보였으니까).
// 이제 탭 다섯 칸은 늘 그대로라, 종료된 행사에서 라디오를 누르면 튕기기만 하고
// 이유를 아무도 말해 주지 않는다 — 참가자에겐 그냥 고장이다.
//
// 되돌리지 않고 이 화면을 그린다. "여기 있는데 지금은 못 쓴다" 가 정확한 사실이다.

import Link from "next/link";

export function EventLocked({
  icon,
  title,
  notice,
  homeHref,
}: {
  /** 그 기능의 아이콘 — 어느 화면에 들어왔는지 알아볼 수 있게. */
  icon: React.ReactNode;
  title: string;
  /** 왜 못 쓰는지. resolveEventAccess 의 notice 를 그대로 쓰면 문구가 한 곳에서 관리된다. */
  notice: string;
  homeHref: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-[#E8E4DE] bg-[#FAF8F5] px-6 py-14 text-center">
      <span className="text-4xl leading-none opacity-40" aria-hidden>
        {icon}
      </span>
      <h1 className="mt-3 text-base font-bold text-[#6B6560]">{title}</h1>
      <p className="mt-1.5 max-w-[260px] text-xs leading-relaxed text-[#8B7F75]">
        {notice}
      </p>
      <Link
        href={homeHref}
        className="mt-5 rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
      >
        행사홈으로
      </Link>
    </div>
  );
}
