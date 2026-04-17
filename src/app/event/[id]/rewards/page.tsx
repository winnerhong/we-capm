import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getParticipant, getParticipantDb } from "@/lib/participant-session";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TYPE_COLOR: Record<string, string> = {
  POINT: "bg-blue-100 text-blue-800",
  RANK: "bg-yellow-100 text-yellow-800",
  BADGE: "bg-violet-100 text-violet-800",
  LOTTERY: "bg-orange-100 text-orange-800",
  INSTANT: "bg-green-100 text-green-800",
};

const TYPE_LABEL: Record<string, string> = {
  POINT: "점수 달성",
  RANK: "순위",
  BADGE: "뱃지",
  LOTTERY: "추첨 당첨",
  INSTANT: "즉시 보상",
};

export default async function EventRewardsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // redirect removed(`/login?next=/event/${id}/rewards`);

  const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
  if (!event) notFound();

  const { data: participant } = await supabase
    .from("participants")
    .select("id, total_score")
    .eq("event_id", id)
    .eq("phone", (await getParticipant(id))?.phone ?? "")
    .maybeSingle();
  if (!participant) redirect(`/event/${id}`);

  const { data: claims } = await supabase
    .from("reward_claims")
    .select("id, reward_id, status, earned_at, claimed_at")
    .eq("participant_id", participant.id)
    .order("earned_at", { ascending: false });

  const rewardIds = (claims ?? []).map((c) => c.reward_id);
  const { data: rewards } = rewardIds.length
    ? await supabase
        .from("rewards")
        .select("id, name, description, reward_type, image_url")
        .in("id", rewardIds)
    : { data: [] };
  const rewardMap = new Map((rewards ?? []).map((r) => [r.id, r]));

  const { data: allRewards } = await supabase
    .from("rewards")
    .select("id, name, reward_type, config")
    .eq("event_id", id)
    .eq("is_active", true);

  const pointRewards = (allRewards ?? []).filter((r) => r.reward_type === "POINT");
  const earnedIds = new Set((claims ?? []).map((c) => c.reward_id));

  return (
    <main className="min-h-dvh bg-neutral-50 p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <Link href={`/event/${id}`} className="text-sm hover:underline">
          ← {event.name}
        </Link>
        <h1 className="text-2xl font-bold">보상함</h1>

        <div className="rounded-lg bg-violet-600 p-4 text-white">
          <div className="text-xs opacity-80">내 점수</div>
          <div className="text-2xl font-bold">{participant.total_score}점</div>
        </div>

        <section>
          <h2 className="mb-2 text-sm font-semibold">획득한 보상</h2>
          {claims && claims.length > 0 ? (
            <ul className="space-y-2">
              {claims.map((c) => {
                const reward = rewardMap.get(c.reward_id);
                if (!reward) return null;
                return (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border bg-white p-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            TYPE_COLOR[reward.reward_type] ?? ""
                          }`}
                        >
                          {TYPE_LABEL[reward.reward_type] ?? reward.reward_type}
                        </span>
                        <span className="font-semibold">{reward.name}</span>
                      </div>
                      {reward.description && <p className="text-sm">{reward.description}</p>}
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        c.status === "CLAIMED"
                          ? "bg-neutral-200"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {c.status === "CLAIMED" ? "수령 완료" : "획득"}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-lg border bg-white p-8 text-center text-sm">
              아직 획득한 보상이 없습니다
            </div>
          )}
        </section>

        {pointRewards.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">목표 보상</h2>
            <ul className="space-y-2">
              {pointRewards.map((r) => {
                const cfg = (r.config ?? {}) as { threshold?: number };
                const threshold = cfg.threshold ?? 0;
                const earned = earnedIds.has(r.id);
                const progress = Math.min(100, (participant.total_score / threshold) * 100);
                return (
                  <li key={r.id} className="rounded-lg border bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{r.name}</span>
                      <span className="text-xs">
                        {participant.total_score} / {threshold}점
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded bg-neutral-200">
                      <div
                        className={`h-full transition-all ${
                          earned ? "bg-green-500" : "bg-violet-500"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
