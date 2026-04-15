import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteRewardAction, drawLotteryAction } from "./actions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  POINT: "🏅 점수 누적",
  RANK: "🏆 순위",
  BADGE: "🎖️ 뱃지",
  LOTTERY: "🎲 추첨",
  INSTANT: "⚡ 즉시",
};

export default async function RewardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
  if (!event) notFound();

  const { data: rewards } = await supabase
    .from("rewards")
    .select("id, name, description, reward_type, config, quantity")
    .eq("event_id", id);

  const rewardIds = (rewards ?? []).map((r) => r.id);
  const { data: claims } = rewardIds.length
    ? await supabase
        .from("reward_claims")
        .select("id, reward_id, status")
        .in("reward_id", rewardIds)
    : { data: [] };

  const claimCountByReward = new Map<string, number>();
  for (const c of claims ?? []) {
    claimCountByReward.set(c.reward_id, (claimCountByReward.get(c.reward_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/admin/events/${id}`} className="text-sm hover:underline">
            ← {event.name}
          </Link>
          <h1 className="text-2xl font-bold">보상 관리</h1>
        </div>
        <Link
          href={`/admin/events/${id}/rewards/new`}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          + 새 보상
        </Link>
      </div>

      {rewards && rewards.length > 0 ? (
        <ul className="space-y-2">
          {rewards.map((r) => {
            const claimed = claimCountByReward.get(r.id) ?? 0;
            const config = (r.config ?? {}) as Record<string, number>;
            return (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-lg border bg-white p-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
                      {TYPE_LABEL[r.reward_type] ?? r.reward_type}
                    </span>
                    <span className="font-semibold">{r.name}</span>
                  </div>
                  {r.description && <p className="text-sm">{r.description}</p>}
                  <p className="mt-1 text-xs">
                    {r.reward_type === "POINT" && `${config.threshold}점 이상 도달 시`}
                    {r.reward_type === "RANK" && `${config.rankFrom}~${config.rankTo}등`}
                    {r.reward_type === "LOTTERY" && `최소 ${config.minScore}점 · ${config.winners}명 추첨`}
                    {r.reward_type === "BADGE" && `특정 미션 완료 시`}
                    {r.reward_type === "INSTANT" && `특정 미션 승인 즉시`}
                    {" · "}
                    {claimed}
                    {r.quantity ? `/${r.quantity}` : ""} 수령
                  </p>
                </div>
                <div className="flex gap-2">
                  {r.reward_type === "LOTTERY" && (
                    <form
                      action={async () => {
                        "use server";
                        await drawLotteryAction(id, r.id);
                      }}
                    >
                      <button className="rounded border px-2 py-1 text-xs hover:bg-neutral-50">
                        추첨 실행
                      </button>
                    </form>
                  )}
                  <form
                    action={async () => {
                      "use server";
                      await deleteRewardAction(id, r.id);
                    }}
                  >
                    <button className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                      삭제
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-lg border bg-white p-12 text-center">
          아직 보상이 없습니다.{" "}
          <Link href={`/admin/events/${id}/rewards/new`} className="text-violet-600 hover:underline">
            첫 보상 만들기 →
          </Link>
        </div>
      )}
    </div>
  );
}
