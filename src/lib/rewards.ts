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

    // 보상 이름 가져오기
    const { data: rewardRow } = await supabase
      .from("rewards")
      .select("name")
      .eq("id", reward.id)
      .single();

    // 알림
    const { data: participantRow } = await supabase
      .from("participants")
      .select("user_id, phone")
      .eq("id", participantId)
      .single();
    if (participantRow && rewardRow) {
      await notify(
        supabase,
        participantRow.user_id ?? "",
        "REWARD_EARNED",
        "🎁 보상 획득",
        `${rewardRow.name}을(를) 획득했어요!`
      );

      // 윙크톡 전체 단톡방에 축하 메시지
      const { data: groupRoom } = await supabase
        .from("chat_rooms")
        .select("id")
        .eq("event_id", eventId)
        .eq("name", "💬 전체 단톡방")
        .maybeSingle();

      if (groupRoom) {
        // 참가자 이름 가져오기
        let displayName = participantRow.phone ?? "참가자";
        if (participantRow.phone) {
          const { data: reg } = await supabase
            .from("event_registrations")
            .select("name")
            .eq("phone", participantRow.phone)
            .maybeSingle();
          if (reg) displayName = reg.name.replace(/^\[.+?\]\s*/, "");
        }

        await supabase.from("chat_messages").insert({
          room_id: groupRoom.id,
          sender_name: "시스템",
          type: "SYSTEM",
          content: `🎉 ${displayName}님이 [${rewardRow.name}] 보상을 획득했습니다!`,
        });
      }
    }
  }
}
