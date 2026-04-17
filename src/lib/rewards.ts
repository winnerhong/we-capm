import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { notify } from "@/lib/notifications";

type DBClient = SupabaseClient<Database>;

/**
 * Check and award POINT/BADGE/INSTANT rewards triggered by a submission approval.
 * Should be called after participant.total_score is updated.
 */
export async function checkAndAwardRewards(
  supabase: DBClient,
  eventId: string,
  participantId: string,
  approvedMissionId: string,
  newTotalScore: number
) {
  const { data: rewards } = await supabase
    .from("rewards")
    .select("id, reward_type, config, quantity, is_active")
    .eq("event_id", eventId)
    .eq("is_active", true);

  if (!rewards || rewards.length === 0) return;

  for (const reward of rewards) {
    const config = (reward.config ?? {}) as {
      threshold?: number;
      missionId?: string;
    };

    let shouldAward = false;

    if (reward.reward_type === "POINT") {
      if (config.threshold && newTotalScore >= config.threshold) shouldAward = true;
    } else if (reward.reward_type === "BADGE") {
      if (config.missionId === approvedMissionId) shouldAward = true;
    } else if (reward.reward_type === "INSTANT") {
      if (config.missionId === approvedMissionId) shouldAward = true;
    }

    if (!shouldAward) continue;

    const { data: existing } = await supabase
      .from("reward_claims")
      .select("id")
      .eq("reward_id", reward.id)
      .eq("participant_id", participantId)
      .maybeSingle();
    if (existing) continue;

    if (reward.quantity !== null && reward.quantity !== undefined) {
      const { count } = await supabase
        .from("reward_claims")
        .select("*", { count: "exact", head: true })
        .eq("reward_id", reward.id);
      if (count !== null && count >= reward.quantity) continue;
    }

    await supabase.from("reward_claims").insert({
      reward_id: reward.id,
      participant_id: participantId,
      status: "EARNED",
    });

    const { data: participantRow } = await supabase
      .from("participants")
      .select("user_id")
      .eq("id", participantId)
      .single();
    const { data: rewardRow } = await supabase
      .from("rewards")
      .select("name")
      .eq("id", reward.id)
      .single();
    if (participantRow && rewardRow) {
      await notify(
        supabase,
        participantRow.user_id ?? "",
        "REWARD_EARNED",
        "🎁 보상 획득",
        `${rewardRow.name}을(를) 획득했어요!`
      );
    }
  }
}
