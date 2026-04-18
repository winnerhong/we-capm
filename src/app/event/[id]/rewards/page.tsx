import { notFound, redirect } from "next/navigation";
import { getParticipant } from "@/lib/participant-session";
import { createClient } from "@/lib/supabase/server";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { ClaimQRButton } from "./claim-qr";

export const dynamic = "force-dynamic";

const TYPE_ICON: Record<string, string> = {
  POINT: "🏅", RANK: "🏆", BADGE: "🎖️", LOTTERY: "🎰", INSTANT: "⚡",
};
const TYPE_LABEL: Record<string, string> = {
  POINT: "점수 달성", RANK: "순위 보상", BADGE: "뱃지", LOTTERY: "추첨 당첨", INSTANT: "즉시 보상",
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
      <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-4 pt-4 pb-6 text-white">
        <h1 className="text-xl font-bold">🎁 보상함</h1>
        <div className="mt-3 flex gap-3">
          <div className="flex-1 rounded-xl bg-white/20 p-3 text-center">
            <div className="text-2xl font-bold">{myScore}</div>
            <div className="text-[11px] opacity-80">내 점수</div>
          </div>
          <div className="flex-1 rounded-xl bg-white/20 p-3 text-center">
            <div className="text-2xl font-bold">{earnedClaims.length}</div>
            <div className="text-[11px] opacity-80">수령 대기</div>
          </div>
          <div className="flex-1 rounded-xl bg-white/20 p-3 text-center">
            <div className="text-2xl font-bold">{claimedClaims.length}</div>
            <div className="text-[11px] opacity-80">수령 완료</div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 -mt-2">

        {/* 수령 대기 보상 (강조) */}
        {earnedClaims.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-bold text-green-700">🔔 수령 대기 중</h2>
            <div className="space-y-2">
              {earnedClaims.map((c) => {
                const reward = rewardMap.get(c.reward_id);
                if (!reward) return null;
                return (
                  <div key={c.id} className="rounded-2xl border-2 border-green-300 bg-green-50 p-4 animate-pulse-slow">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-200 text-2xl">
                        {TYPE_ICON[reward.reward_type] ?? "🎁"}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold">{reward.name}</div>
                        {reward.description && <p className="text-xs text-neutral-600">{reward.description}</p>}
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
            <h2 className="mb-2 text-sm font-bold">✅ 수령 완료</h2>
            <div className="space-y-2">
              {claimedClaims.map((c) => {
                const reward = rewardMap.get(c.reward_id);
                if (!reward) return null;
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-2xl border bg-white p-4 opacity-70">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-xl">
                      {TYPE_ICON[reward.reward_type] ?? "🎁"}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{reward.name}</div>
                      <div className="text-[10px] text-neutral-400">
                        {c.claimed_at ? new Date(c.claimed_at).toLocaleString("ko-KR") : ""} 수령
                      </div>
                    </div>
                    <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px]">완료</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 목표 보상 (POINT 진행률) */}
        {pointRewards.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-bold">🎯 목표 보상</h2>
            <div className="space-y-2">
              {pointRewards.map((r) => {
                const cfg = (r.config ?? {}) as { threshold?: number };
                const threshold = cfg.threshold ?? 0;
                const earned = earnedIds.has(r.id);
                const progress = threshold > 0 ? Math.min(100, (myScore / threshold) * 100) : 0;
                return (
                  <div key={r.id} className={`rounded-2xl border p-4 ${earned ? "bg-green-50 border-green-200" : "bg-white"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{earned ? "✅" : "🏅"}</span>
                        <span className="font-semibold">{r.name}</span>
                      </div>
                      <span className={`text-xs font-bold ${earned ? "text-green-600" : "text-violet-600"}`}>
                        {myScore} / {threshold}점
                      </span>
                    </div>
                    {r.description && <p className="text-xs text-neutral-500 mt-1 ml-8">{r.description}</p>}
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-200">
                      <div className={`h-full rounded-full transition-all duration-500 ${earned ? "bg-green-500" : "bg-violet-500"}`}
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
            <h2 className="mb-2 text-sm font-bold">🎁 도전 가능한 보상</h2>
            <div className="grid grid-cols-2 gap-2">
              {otherRewards.map((r) => (
                <div key={r.id} className="rounded-2xl border bg-white p-3 text-center">
                  <div className="text-3xl mb-1">{TYPE_ICON[r.reward_type] ?? "🎁"}</div>
                  <div className="font-semibold text-sm">{r.name}</div>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
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
            <div className="text-4xl mb-3">🎁</div>
            <p className="text-neutral-500">아직 등록된 보상이 없습니다</p>
          </div>
        )}
      </div>
    </main>
  );
}
