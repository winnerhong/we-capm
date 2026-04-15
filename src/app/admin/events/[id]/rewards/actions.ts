"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Json, RewardType } from "@/lib/supabase/database.types";

export async function createRewardAction(eventId: string, formData: FormData) {
  const supabase = await createClient();

  const reward_type = (formData.get("reward_type") ?? "POINT") as RewardType;
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const quantity = quantityRaw ? Number(quantityRaw) : null;

  if (!name) throw new Error("보상 이름을 입력해주세요");

  let config: Json = {};

  if (reward_type === "POINT") {
    const threshold = Number(formData.get("threshold") ?? 0);
    if (threshold <= 0) throw new Error("임계점수는 1 이상이어야 합니다");
    config = { threshold };
  } else if (reward_type === "BADGE") {
    const missionId = String(formData.get("mission_id") ?? "").trim();
    if (!missionId) throw new Error("발동 미션을 선택해주세요");
    config = { missionId };
  } else if (reward_type === "RANK") {
    const rankFrom = Number(formData.get("rank_from") ?? 1);
    const rankTo = Number(formData.get("rank_to") ?? 1);
    config = { rankFrom, rankTo };
  } else if (reward_type === "INSTANT") {
    const missionId = String(formData.get("mission_id") ?? "").trim();
    if (!missionId) throw new Error("발동 미션을 선택해주세요");
    config = { missionId };
  } else if (reward_type === "LOTTERY") {
    const minScore = Number(formData.get("lottery_min_score") ?? 0);
    const winners = Number(formData.get("lottery_winners") ?? 1);
    config = { minScore, winners };
  }

  const { error } = await supabase.from("rewards").insert({
    event_id: eventId,
    name,
    description,
    reward_type,
    config,
    quantity,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/events/${eventId}/rewards`);
  redirect(`/admin/events/${eventId}/rewards`);
}

export async function deleteRewardAction(eventId: string, rewardId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("rewards").delete().eq("id", rewardId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/events/${eventId}/rewards`);
}

export async function drawLotteryAction(eventId: string, rewardId: string) {
  const supabase = await createClient();

  const { data: reward } = await supabase
    .from("rewards")
    .select("id, config, quantity, event_id")
    .eq("id", rewardId)
    .single();
  if (!reward) throw new Error("보상 없음");

  const cfg = (reward.config ?? {}) as { minScore?: number; winners?: number };
  const minScore = cfg.minScore ?? 0;
  const winners = cfg.winners ?? 1;

  const { data: eligible } = await supabase
    .from("participants")
    .select("id")
    .eq("event_id", reward.event_id)
    .gte("total_score", minScore);

  if (!eligible || eligible.length === 0) throw new Error("응모 조건 충족 참가자 없음");

  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  const drawn = shuffled.slice(0, Math.min(winners, shuffled.length));

  for (const p of drawn) {
    await supabase
      .from("reward_claims")
      .insert({ reward_id: rewardId, participant_id: p.id, status: "EARNED" });
  }

  revalidatePath(`/admin/events/${eventId}/rewards`);
}
