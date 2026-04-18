import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteRewardAction, drawLotteryAction } from "./actions";
import { RealtimeRefresh } from "@/components/realtime-refresh";

export const dynamic = "force-dynamic";

const TYPE_ICON: Record<string, string> = {
  POINT: "🏅", RANK: "🏆", BADGE: "🎖️", LOTTERY: "🎰", INSTANT: "⚡",
};
const TYPE_LABEL: Record<string, string> = {
  POINT: "점수 누적", RANK: "순위", BADGE: "뱃지", LOTTERY: "추첨", INSTANT: "즉시",
};

export default async function RewardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, name, status").eq("id", id).single();
  if (!event) notFound();

  const { data: rewards } = await supabase
    .from("rewards")
    .select("id, name, description, reward_type, config, quantity, is_active")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  // 보상별 claim 현황
  const rewardIds = (rewards ?? []).map((r) => r.id);
  const { data: allClaims } = rewardIds.length
    ? await supabase.from("reward_claims").select("id, reward_id, status").in("reward_id", rewardIds)
    : { data: [] };

  const statsByReward = new Map<string, { earned: number; claimed: number }>();
  for (const c of allClaims ?? []) {
    const st = statsByReward.get(c.reward_id) ?? { earned: 0, claimed: 0 };
    if (c.status === "EARNED") st.earned++;
    if (c.status === "CLAIMED") st.claimed++;
    statsByReward.set(c.reward_id, st);
  }

  const totalEarned = (allClaims ?? []).filter((c) => c.status === "EARNED").length;
  const totalClaimed = (allClaims ?? []).filter((c) => c.status === "CLAIMED").length;

  return (
    <div className="space-y-4">
      <RealtimeRefresh table="reward_claims" />

      <div className="flex items-center justify-between">
        <div>
          <Link href={`/admin/events/${id}`} className="text-sm hover:underline">← {event.name}</Link>
          <h1 className="text-2xl font-bold">🎁 보상 관리</h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/events/${id}/claim`}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50">🎫 수령처리</Link>
          <Link href={`/admin/events/${id}/rewards/new`}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">+ 새 보상</Link>
        </div>
      </div>

      {/* 현황 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-violet-50 border border-violet-200 p-4 text-center">
          <div className="text-2xl font-bold text-violet-700">{(rewards ?? []).length}</div>
          <div className="text-xs text-violet-600">총 보상</div>
        </div>
        <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4 text-center">
          <div className="text-2xl font-bold text-yellow-700">{totalEarned}</div>
          <div className="text-xs text-yellow-600">미수령</div>
        </div>
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{totalClaimed}</div>
          <div className="text-xs text-green-600">수령 완료</div>
        </div>
      </div>

      {/* 보상 목록 */}
      {rewards && rewards.length > 0 ? (
        <div className="space-y-3">
          {rewards.map((r) => {
            const st = statsByReward.get(r.id) ?? { earned: 0, claimed: 0 };
            const config = (r.config ?? {}) as Record<string, number>;
            const total = st.earned + st.claimed;
            const claimRate = total > 0 ? Math.round((st.claimed / total) * 100) : 0;

            return (
              <div key={r.id} className="rounded-2xl border bg-white p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-xl">
                      {TYPE_ICON[r.reward_type] ?? "🎁"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{r.name}</span>
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px]">
                          {TYPE_LABEL[r.reward_type]}
                        </span>
                      </div>
                      {r.description && <p className="text-xs text-neutral-500 mt-0.5">{r.description}</p>}
                      <p className="text-xs text-neutral-400 mt-1">
                        {r.reward_type === "POINT" && `${config.threshold}점 이상`}
                        {r.reward_type === "RANK" && `${config.rankFrom}~${config.rankTo}등`}
                        {r.reward_type === "LOTTERY" && `최소 ${config.minScore}점 · ${config.winners}명 추첨`}
                        {r.reward_type === "BADGE" && `미션 완료 시`}
                        {r.reward_type === "INSTANT" && `미션 승인 즉시`}
                        {r.quantity ? ` · 한정 ${r.quantity}개` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {r.reward_type === "LOTTERY" && (
                      <form action={async () => { "use server"; await drawLotteryAction(id, r.id); }}>
                        <button className="rounded-lg border border-orange-300 bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100">
                          🎲 추첨
                        </button>
                      </form>
                    )}
                    <form action={async () => { "use server"; await deleteRewardAction(id, r.id); }}>
                      <button className="rounded-lg border border-red-200 px-2 py-1.5 text-xs text-red-500 hover:bg-red-50">삭제</button>
                    </form>
                  </div>
                </div>

                {/* 수령 현황 바 */}
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-2 overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${claimRate}%` }} />
                  </div>
                  <span className="text-[11px] text-neutral-500 whitespace-nowrap">
                    {st.claimed}/{total}명 수령 ({claimRate}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-12 text-center">
          <div className="text-4xl mb-3">🎁</div>
          <p className="text-neutral-500">아직 보상이 없습니다</p>
          <Link href={`/admin/events/${id}/rewards/new`}
            className="mt-3 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
            첫 보상 만들기
          </Link>
        </div>
      )}
    </div>
  );
}
