// 서버 컴포넌트 — 홈 화면의 돌발 미션 알림 카드.
// 현재 LIVE 돌발이 하나도 없으면 null 반환 (카드 숨김).

import Link from "next/link";
import { loadLiveBroadcastsForOrg } from "@/lib/missions/queries";
import { Countdown } from "../missions/[orgMissionId]/runners/Countdown";

interface Props {
  orgId: string;
}

export async function BroadcastCard({ orgId }: Props) {
  const live = await loadLiveBroadcastsForOrg(orgId);
  if (live.length === 0) return null;

  const top = live[0];
  const extraCount = live.length - 1;

  return (
    <Link
      href="/broadcasts"
      aria-label="돌발 미션 참여하기"
      className="block overflow-hidden rounded-3xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 via-amber-50 to-rose-50 p-5 shadow-lg transition hover:shadow-xl active:scale-[0.995]"
    >
      <div className="flex items-center gap-2">
        <span className="relative inline-flex h-2.5 w-2.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
        </span>
        <p className="text-[11px] font-bold uppercase tracking-widest text-rose-700">
          ⚡ 돌발 미션 도착!
        </p>
        <span className="ml-auto">
          <Countdown expiresAt={top.expires_at} urgentSec={30} />
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-sm font-bold leading-relaxed text-rose-900">
        {top.prompt_snapshot}
      </p>

      <div className="mt-3 flex items-center justify-between">
        {extraCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold text-rose-800">
            +{extraCount}개 더
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold text-rose-800">
            1개 활성
          </span>
        )}
        <span className="text-xs font-bold text-rose-700">지금 참여 →</span>
      </div>
    </Link>
  );
}
