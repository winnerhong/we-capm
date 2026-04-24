import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { getParticipant } from "@/lib/participant-session";
import { createClient } from "@/lib/supabase/server";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { ClaimQRButton } from "./claim-qr";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

const TYPE_ICON: Record<string, ReactNode> = {
  POINT: <AcornIcon />, RANK: "🏆", BADGE: "🎖️", LOTTERY: "🎰", INSTANT: "🍃",
};
const TYPE_LABEL: Record<string, string> = {
  POINT: "도토리 모으기", RANK: "숲의 영광", BADGE: "기념 뱃지", LOTTERY: "추첨 당첨", INSTANT: "즉시 선물",
};

export default async function EventRewardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const p = await getParticipant(id);
  if (!p) redirect("/join");

  const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
  if (!event) notFound();

  const { data: participant } = await supabase
    .from("participants")
    .select("id, total_score")
    .eq("event_id", id)
    .eq("phone", p.phone)
    .maybeSingle();
  if (!participant) redirect(`/event/${id}`);

  // 내 보상 claims
  const { data: claims } = await supabase
    .from("reward_claims")
    .select("id, reward_id, status, earned_at, claimed_at")
    .eq("participant_id", participant.id)
    .order("earned_at", { ascending: false });

  const rewardIds = (claims ?? []).map((c) => c.reward_id);
  const { data: claimedRewards } = rewardIds.length
    ? await supabase.from("rewards").select("id, name, description, reward_type, image_url").in("id", rewardIds)
    : { data: [] };
  const rewardMap = new Map((claimedRewards ?? []).map((r) => [r.id, r]));

  // 전체 보상 목록
  const { data: allRewards } = await supabase
    .from("rewards")
    .select("id, name, description, reward_type, config, image_url")
    .eq("event_id", id)
    .eq("is_active", true);

  const earnedIds = new Set(rewardIds);
  const pointRewards = (allRewards ?? []).filter((r) => r.reward_type === "POINT");
  const otherRewards = (allRewards ?? []).filter((r) => r.reward_type !== "POINT" && !earnedIds.has(r.id));
  const myScore = participant.total_score ?? 0;

  const earnedClaims = (claims ?? []).filter((c) => c.status === "EARNED");
  const claimedClaims = (claims ?? []).filter((c) => c.status === "CLAIMED");

  return (
    <main className="min-h-dvh bg-neutral-50 pb-24">
      <RealtimeRefresh table="reward_claims" />

      {/* 헤더 */}
      <div className="bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] px-4 pt-4 pb-6 text-white shadow-lg">
        <h1 className="text-xl font-bold">🎁 숲의 선물함</h1>
        <p className="mt-1 text-xs opacity-90">도토리를 모아 특별한 선물을 만나보세요</p>
        <div className="mt-3 flex gap-3">
          <div className="flex-1 rounded-xl bg-white/20 p-3 text-center">
            <div className="text-2xl font-bold">{myScore}<span className="ml-0.5 text-xs"><AcornIcon size={12} /></span></div>
            <div className="text-[11px] opacity-80">내 도토리</div>
          </div>
          <div className="flex-1 rounded-xl bg-white/20 p-3 text-center">
            <div className="text-2xl font-bold">{earnedClaims.length}</div>
            <div className="text-[11px] opacity-80">받을 선물</div>
          </div>
          <div className="flex-1 rounded-xl bg-white/20 p-3 text-center">
            <div className="text-2xl font-bold">{claimedClaims.length}</div>
            <div className="text-[11px] opacity-80">받은 선물</div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 -mt-2">

        {/* 수령 대기 보상 (강조) */}
        {earnedClaims.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-bold text-[#2D5A3D]">🔔 받을 준비가 된 선물</h2>
            <div className="space-y-2">
              {earnedClaims.map((c) => {
                const reward = rewardMap.get(c.reward_id);
                if (!reward) return null;
                return (
                  <div key={c.id} className="rounded-2xl border-2 border-[#A8C686] bg-[#D4E4BC] p-4 animate-pulse-slow">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl">
                        {TYPE_ICON[reward.reward_type] ?? "🎁"}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-[#2D5A3D]">{reward.name}</div>
                        {reward.description && <p className="text-xs text-[#6B6560]">{reward.description}</p>}
                        <ClaimQRButton claimId={c.id} rewardName={reward.name} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 수령 완료 보상 */}
        {claimedClaims.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-bold text-[#2D5A3D]">🐾 받은 선물</h2>
            <div className="space-y-2">
              {claimedClaims.map((c) => {
                const reward = rewardMap.get(c.reward_id);
                if (!reward) return null;
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-2xl border bg-white p-4 opacity-70">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F0E4] text-xl">
                      {TYPE_ICON[reward.reward_type] ?? "🎁"}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{reward.name}</div>
                      <div className="text-[10px] text-[#6B6560]">
                        {c.claimed_at ? new Date(c.claimed_at).toLocaleString("ko-KR") : ""} 받음
                      </div>
                    </div>
                    <span className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] text-[#2D5A3D]">완료</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 목표 보상 (POINT 진행률) */}
        {pointRewards.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-bold text-[#2D5A3D]"><AcornIcon /> 도토리 모으기</h2>
            <div className="space-y-2">
              {pointRewards.map((r) => {
                const cfg = (r.config ?? {}) as { threshold?: number };
                const threshold = cfg.threshold ?? 0;
                const earned = earnedIds.has(r.id);
                const progress = threshold > 0 ? Math.min(100, (myScore / threshold) * 100) : 0;
                return (
                  <div key={r.id} className={`rounded-2xl border p-4 ${earned ? "bg-[#D4E4BC] border-[#A8C686]" : "bg-white"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{earned ? "🌳" : "🌱"}</span>
                        <span className="font-semibold">{r.name}</span>
                      </div>
                      <span className={`text-xs font-bold ${earned ? "text-[#2D5A3D]" : "text-violet-600"}`}>
                        <AcornIcon /> {myScore} / {threshold}
                      </span>
                    </div>
                    {r.description && <p className="text-xs text-[#6B6560] mt-1 ml-8">{r.description}</p>}
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#E8F0E4]">
                      <div className={`h-full rounded-full transition-all duration-500 ${earned ? "bg-[#4A7C59]" : "bg-violet-500"}`}
                        style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 도전 가능한 보상 */}
        {otherRewards.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-bold text-[#2D5A3D]">🌿 만나볼 선물</h2>
            <div className="grid grid-cols-2 gap-2">
              {otherRewards.map((r) => (
                <div key={r.id} className="rounded-2xl border bg-white p-3 text-center">
                  <div className="text-3xl mb-1">{TYPE_ICON[r.reward_type] ?? "🎁"}</div>
                  <div className="font-semibold text-sm">{r.name}</div>
                  <span className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] text-[#2D5A3D]">
                    {TYPE_LABEL[r.reward_type] ?? r.reward_type}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 보상 없음 */}
        {(allRewards ?? []).length === 0 && (
          <div className="rounded-2xl border bg-white p-12 text-center">
            <div className="text-4xl mb-3">🌱</div>
            <p className="text-[#6B6560]">곧 새로운 선물이 준비돼요</p>
          </div>
        )}
      </div>
    </main>
  );
}
