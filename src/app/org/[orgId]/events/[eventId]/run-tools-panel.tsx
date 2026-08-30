// ④ 진행 → 운영 도구 모음.
//
// 예전에는 상단 메뉴 "진행 ▾" 안에 검수·돌발 미션·토리톡·선물함·쿠폰·수령 QR 이
// 흩어져 있었다. 행사 당일 쓰는 것들인데 행사 화면과 따로 놀아서, 관리자는
// "이 행사 검수는 어디서 하지" 를 매번 다시 찾았다.
//
// 여기서는 설명을 길게 쓰지 않는다. 무엇을 하는 자리인지 한 줄, 그리고 바로 가는
// 버튼. 실제 화면은 이미 있는 것들을 그대로 연다.

import Link from "next/link";

type Tool = {
  icon: string;
  label: string;
  hint: string;
  href: string;
  /** 행사 당일 손에 들고 쓰는 것 — 위로 올린다. */
  primary?: boolean;
};

export function RunToolsPanel({ orgId }: { orgId: string }) {
  const base = `/org/${orgId}`;
  const tools: Tool[] = [
    {
      icon: "🎁",
      label: "선물함",
      hint: "누가 무엇을 받았는지",
      href: `${base}/gifts`,
      primary: true,
    },
    {
      icon: "📷",
      label: "선물 수령 QR",
      hint: "현장에서 QR 찍어 지급",
      href: `${base}/gifts/redeem`,
      primary: true,
    },
    {
      icon: "🔍",
      label: "미션 검수",
      hint: "올라온 사진 승인·반려",
      href: `${base}/missions/review`,
      primary: true,
    },
    {
      icon: "⚡",
      label: "돌발 미션 방송",
      hint: "지금 이 순간 미션 쏘기",
      href: `${base}/missions/broadcast`,
    },
    {
      icon: "💬",
      label: "토리톡",
      hint: "참가자와 대화",
      href: `${base}/toritalk`,
    },
    {
      icon: "🎟",
      label: "쿠폰 만들기",
      hint: "선물로 줄 쿠폰 정의",
      href: `${base}/gifts/templates`,
    },
    {
      icon: "🎯",
      label: "토리 빙고",
      hint: "사진 빙고판 만들기",
      href: `${base}/bingo`,
    },
    {
      icon: "🧩",
      label: "미션 카탈로그",
      hint: "미션 종류 둘러보기",
      href: `${base}/missions/catalog`,
    },
    {
      icon: "🎙",
      label: "토리FM 방송",
      hint: "사연 고르고 틀기",
      href: `${base}/tori-fm`,
    },
    {
      icon: "📻",
      label: "사연 관리",
      hint: "들어온 사연 목록",
      href: `${base}/missions/radio`,
    },
  ];

  return (
    <div className="space-y-3">
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              className={`flex h-full items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
                t.primary
                  ? "border-[#D4E4BC] hover:border-[#2D5A3D]"
                  : "border-[#E8DDC8] hover:border-[#8B7F75]"
              }`}
            >
              <span className="text-xl" aria-hidden>
                {t.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[#2D5A3D]">
                  {t.label}
                </span>
                <span className="block truncate text-[11px] text-[#8B7F75]">
                  {t.hint}
                </span>
              </span>
              <span aria-hidden className="text-[#D4C8B8]">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
