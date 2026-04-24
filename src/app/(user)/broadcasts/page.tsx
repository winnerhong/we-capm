// 돌발 미션 인박스 — LIVE broadcasts for user's org.

import Link from "next/link";
import { requireAppUser } from "@/lib/user-auth-guard";
import {
  loadLiveBroadcastsForOrg,
  loadOrgMissionById,
} from "@/lib/missions/queries";
import type { OrgMissionRow } from "@/lib/missions/types";
import { Countdown } from "../missions/[orgMissionId]/runners/Countdown";
import { BroadcastRefresher } from "./BroadcastRefresher";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

export default async function BroadcastsInboxPage() {
  const user = await requireAppUser();
  const live = await loadLiveBroadcastsForOrg(user.orgId);

  // 각 broadcast 의 org_mission 로드 (title 필요)
  const missionIds = Array.from(new Set(live.map((b) => b.org_mission_id)));
  const missions = await Promise.all(
    missionIds.map((id) => loadOrgMissionById(id))
  );
  const missionMap = new Map<string, OrgMissionRow>();
  for (const m of missions) {
    if (m) missionMap.set(m.id, m);
  }

  return (
    <div className="space-y-4">
      <BroadcastRefresher orgId={user.orgId} />

      {/* Header */}
      <section className="overflow-hidden rounded-3xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 via-amber-50 to-rose-50 p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-2.5 w-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
          </span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-rose-700">
            ⚡ 돌발 미션
          </p>
        </div>
        <h1 className="mt-2 text-xl font-bold text-rose-900">돌발 미션함</h1>
        <p className="mt-1 text-xs text-rose-900/70">
          지금 참여 가능한 돌발 미션을 한눈에!
        </p>
      </section>

      {live.length === 0 ? (
        <section className="rounded-3xl border-2 border-dashed border-[#D4E4BC] bg-white/70 p-8 text-center shadow-sm">
          <p className="text-5xl" aria-hidden>
            🌿
          </p>
          <p className="mt-2 text-base font-bold text-[#2D5A3D]">
            현재 돌발 미션이 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            운영자가 발동하면 알림이 와요. 숲길을 즐기며 기다려 주세요!
          </p>
          <Link
            href="/home"
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-[#2D5A3D] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#3A7A52]"
          >
            🏠 홈으로
          </Link>
        </section>
      ) : (
        <ul className="space-y-3">
          {live.map((b) => {
            const mission = missionMap.get(b.org_mission_id);
            if (!mission) return null;
            const href = `/missions/${mission.id}`;
            return (
              <li key={b.id}>
                <Link
                  href={href}
                  className="block overflow-hidden rounded-3xl border-2 border-rose-200 bg-white p-5 shadow-sm transition hover:shadow-md active:scale-[0.995]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                      ⚡ LIVE
                    </p>
                    <Countdown expiresAt={b.expires_at} urgentSec={30} />
                  </div>
                  <h2 className="mt-2 text-base font-bold text-rose-900">
                    {mission.title}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-rose-900/80">
                    {b.prompt_snapshot}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                      <AcornIcon className="text-amber-700" /> +{mission.acorns}
                    </span>
                    <span className="text-xs font-bold text-rose-700">
                      지금 참여 →
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
