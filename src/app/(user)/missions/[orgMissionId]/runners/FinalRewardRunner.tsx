"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  OrgMissionRow,
  FinalRewardMissionConfig,
} from "@/lib/missions/types";
import { issueFinalRewardAction } from "../../actions";
import { AcornIcon } from "@/components/acorn-icon";

interface Props {
  mission: OrgMissionRow;
  config: FinalRewardMissionConfig;
  packId: string;
  userAcornsInPack: number;
}

export function FinalRewardRunner({
  mission,
  config,
  packId,
  userAcornsInPack,
}: Props) {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const tiers = [...(config.tiers ?? [])].sort(
    (a, b) => a.threshold - b.threshold
  );
  const minThreshold = tiers[0]?.threshold ?? 0;

  // 달성한 최고 tier 계산 (서버 로직과 일치)
  let achievedIdx = -1;
  for (let i = 0; i < tiers.length; i++) {
    if (userAcornsInPack >= tiers[i].threshold) achievedIdx = i;
    else break;
  }
  const achieved = achievedIdx >= 0 ? tiers[achievedIdx] : null;
  const nextTier = achievedIdx < tiers.length - 1 ? tiers[achievedIdx + 1] : null;
  const remaining = nextTier
    ? Math.max(0, nextTier.threshold - userAcornsInPack)
    : 0;

  const canClaim = Boolean(achieved);

  const handleClaim = () => {
    if (!canClaim) {
      setErrorMsg(
        `최저 ${minThreshold} 도토리가 필요해요. (${minThreshold - userAcornsInPack}개 더 모아주세요)`
      );
      return;
    }
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const result = await issueFinalRewardAction(mission.id, packId);
        router.push(`/rewards/${result.redemptionId}`);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setErrorMsg(msg);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Hero card */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FAE7D0] via-[#F5D493] to-[#E8B86D] p-6 text-center shadow-lg">
        <p className="text-6xl" aria-hidden>
          🎁
        </p>
        <p className="mt-3 text-xs font-bold uppercase tracking-widest text-[#6B4423]">
          최종 보상
        </p>
        <h2 className="mt-1 text-xl font-extrabold text-[#6B4423]">
          {mission.title}
        </h2>
        {mission.description && (
          <p className="mt-2 text-sm text-[#6B4423]/80">
            {mission.description}
          </p>
        )}

        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-[#6B4423] shadow-sm">
          <AcornIcon size={18} />
          <span className="tabular-nums">{userAcornsInPack}</span>
          <span>도토리 누적</span>
        </div>
      </section>

      {/* Achieved tier */}
      {achieved && (
        <section className="rounded-3xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
          <p className="text-3xl" aria-hidden>
            🎉
          </p>
          <h3 className="mt-1.5 text-base font-bold text-emerald-800">
            달성한 티어: {achieved.label}
          </h3>
          <p className="mt-1 text-sm text-emerald-700">
            {achieved.reward_desc}
          </p>
          <p className="mt-2 text-[11px] font-semibold text-emerald-700">
            <AcornIcon /> {achieved.threshold}+ 도토리 조건 충족
          </p>
        </section>
      )}

      {/* Tier list */}
      <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-[#2D5A3D]">🏆 티어별 보상</h3>
        <ul className="mt-3 space-y-2">
          {tiers.map((t, i) => {
            const isAchieved = userAcornsInPack >= t.threshold;
            const isTop = i === achievedIdx;
            return (
              <li
                key={`${t.threshold}-${i}`}
                className={`flex items-start gap-3 rounded-2xl border px-3 py-2.5 ${
                  isTop
                    ? "border-emerald-400 bg-emerald-50"
                    : isAchieved
                      ? "border-[#D4E4BC] bg-[#E8F0E4]"
                      : "border-[#E8E0D0] bg-[#FFF8F0]"
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                    isAchieved
                      ? "bg-emerald-500 text-white"
                      : "bg-zinc-200 text-zinc-500"
                  }`}
                >
                  {t.icon || (isAchieved ? "✓" : "🔒")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm font-bold ${
                        isAchieved ? "text-[#2D5A3D]" : "text-[#8B7F75]"
                      }`}
                    >
                      {t.label}
                    </p>
                    {isTop && (
                      <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold text-white">
                        🎉 달성
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-0.5 text-xs ${
                      isAchieved ? "text-[#3D3A36]" : "text-[#8B7F75]"
                    }`}
                  >
                    {t.reward_desc}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#6B6560]">
                    <AcornIcon /> {t.threshold} 도토리
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        {nextTier && (
          <p className="mt-4 rounded-2xl bg-[#FAE7D0]/50 px-3 py-2 text-[11px] font-semibold text-[#6B4423]">
            <AcornIcon className="text-[#6B4423]" /> {remaining}개 더 모으면 <b>{nextTier.label}</b> 달성!
          </p>
        )}
      </section>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
        >
          ⚠️ {errorMsg}
        </div>
      )}

      <button
        type="button"
        onClick={handleClaim}
        disabled={!canClaim || isPending}
        className="min-h-[56px] w-full rounded-2xl bg-gradient-to-r from-[#6B4423] to-[#C4956A] px-4 py-3 text-base font-bold text-white shadow-md transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:from-[#B8B0A5] disabled:to-[#B8B0A5]"
      >
        {isPending
          ? "발급 중..."
          : canClaim
            ? "🎁 보상 교환권 발급받기"
            : `🔒 ${minThreshold} 도토리 이상 필요`}
      </button>

      <p className="text-center text-[11px] text-[#6B6560]">
        교환권은 발급 후 {config.redemption_ttl_hours ?? 24}시간 동안 유효해요
      </p>
    </div>
  );
}
