"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { subscribeAction, type SubscriptionTier } from "./actions";

export type Tier = {
  id: "sprout" | "tree" | "forest";
  emoji: string;
  name: string;
  price: number;
  discount: number;
  isPopular: boolean;
  features: string[];
};

type Props = {
  tier: Tier;
  selected: boolean;
  onSelect: (id: Tier["id"]) => void;
  eventId: string;
};

const TIER_MAP: Record<Tier["id"], SubscriptionTier> = {
  sprout: "SPROUT",
  tree: "TREE",
  forest: "FOREST",
};

/**
 * 구독 플랜 카드
 * - 3단계 tier별 컬러 테마 (sprout: 연두, tree: 포레스트 그린, forest: 골드)
 * - 선택 상태 시각적 강조
 * - hover 애니메이션
 * - 시작하기 클릭 시 subscribeAction 호출 → /event/[id]/subscription 이동
 */
export function SubscribeCard({ tier, selected, onSelect, eventId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const theme = getTierTheme(tier.id);

  const handleStart = () => {
    if (isPending) return;
    const ok = window.confirm(
      `${tier.emoji} ${tier.name}을(를) 시작하시겠어요?\n\n월 ${tier.price.toLocaleString("ko-KR")}원\n\n(결제 연동 전 — 지금은 구독 레코드만 생성됩니다)`,
    );
    if (!ok) return;

    setErrorMsg(null);
    startTransition(async () => {
      try {
        const result = await subscribeAction(eventId, TIER_MAP[tier.id]);
        if (result?.ok) {
          router.push(`/event/${eventId}/subscription`);
          router.refresh();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "구독 요청 실패";
        setErrorMsg(msg);
        window.alert(`구독 실패: ${msg}`);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={() => onSelect(tier.id)}
      aria-pressed={selected}
      aria-label={`${tier.name} 월 ${tier.price.toLocaleString("ko-KR")}원`}
      className={`group relative flex w-full flex-col rounded-3xl bg-white p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-300 ${
        tier.isPopular ? "md:scale-[1.03]" : ""
      } ${
        selected
          ? `border-2 ${theme.borderActive} shadow-lg`
          : `border-2 ${theme.border}`
      }`}
    >
      {/* 상단 뱃지 */}
      {tier.isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#2D5A3D] to-[#4A7C59] px-4 py-1 text-xs font-bold text-white shadow-md">
          ⭐ 인기
        </div>
      )}
      {tier.id === "forest" && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#C4956A] to-[#8B6F47] px-4 py-1 text-xs font-bold text-white shadow-md">
          👑 VIP
        </div>
      )}

      {/* 이모지 + 이름 */}
      <div className="flex items-center gap-2">
        <span className="text-3xl" aria-hidden="true">
          {tier.emoji}
        </span>
        <h3 className={`text-lg font-bold ${theme.text}`}>{tier.name}</h3>
      </div>

      {/* 가격 */}
      <div className="mt-4">
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-extrabold md:text-4xl ${theme.text}`}>
            {tier.price.toLocaleString("ko-KR")}
          </span>
          <span className="text-sm text-[#6B6560]">원 / 월</span>
        </div>
        <div
          className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold ${theme.badgeBg} ${theme.badgeText}`}
        >
          일반 결제 대비 {tier.discount}% 할인
        </div>
      </div>

      {/* 기능 리스트 */}
      <ul className="mt-5 flex-1 space-y-2.5">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-[#3C3731]">
            <span
              className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${theme.checkBg} ${theme.checkText}`}
              aria-hidden="true"
            >
              ✓
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div
        role="button"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          handleStart();
        }}
        aria-disabled={isPending}
        className={`mt-6 w-full rounded-2xl py-3 text-center text-sm font-bold text-white shadow-sm transition-all ${theme.button} ${
          isPending ? "opacity-60" : "hover:shadow-md active:scale-[0.98]"
        }`}
      >
        {isPending ? "처리 중..." : "🌱 시작하기"}
      </div>

      {errorMsg ? (
        <p
          role="alert"
          className="mt-2 text-center text-[11px] font-medium text-red-600"
        >
          {errorMsg}
        </p>
      ) : (
        <p className="mt-2 text-center text-[10px] text-[#6B6560]">
          언제든 해지 가능
        </p>
      )}
    </button>
  );
}

function getTierTheme(id: Tier["id"]) {
  if (id === "sprout") {
    return {
      border: "border-[#D4E4BC]",
      borderActive: "border-[#A8C686]",
      text: "text-[#4A7C59]",
      badgeBg: "bg-[#D4E4BC]",
      badgeText: "text-[#4A7C59]",
      checkBg: "bg-[#A8C686]",
      checkText: "text-white",
      button: "bg-[#A8C686] hover:bg-[#94B574]",
    };
  }
  if (id === "tree") {
    return {
      border: "border-[#2D5A3D]",
      borderActive: "border-[#2D5A3D]",
      text: "text-[#2D5A3D]",
      badgeBg: "bg-[#2D5A3D]",
      badgeText: "text-white",
      checkBg: "bg-[#2D5A3D]",
      checkText: "text-white",
      button: "bg-gradient-to-r from-[#2D5A3D] to-[#4A7C59] hover:from-[#234A30] hover:to-[#3D6A4A]",
    };
  }
  return {
    border: "border-[#E6D3B8]",
    borderActive: "border-[#C4956A]",
    text: "text-[#8B6F47]",
    badgeBg: "bg-gradient-to-r from-[#C4956A] to-[#8B6F47]",
    badgeText: "text-white",
    checkBg: "bg-gradient-to-br from-[#C4956A] to-[#8B6F47]",
    checkText: "text-white",
    button: "bg-gradient-to-r from-[#C4956A] to-[#8B6F47] hover:from-[#B08559] hover:to-[#7A5F3D]",
  };
}
