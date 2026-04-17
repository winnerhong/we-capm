"use server";

import { createClient } from "@/lib/supabase/server";
import { formatKorean } from "@/lib/phone";

interface ClaimResult {
  ok: boolean;
  message?: string;
  participantName?: string;
  claims?: { rewardName: string; claimId: string; status: string }[];
}

export async function claimRewardAction(
  eventId: string,
  phoneDigits: string,
  action: "search" | "claim"
): Promise<ClaimResult> {
  const supabase = await createClient();

  const phone = phoneDigits.startsWith("0") ? phoneDigits : `0${phoneDigits}`;
  const formatted = formatKorean(phone);

  const { data: reg } = await supabase
    .from("event_registrations")
    .select("id, name")
    .eq("event_id", eventId)
    .eq("phone", formatted)
    .maybeSingle();

  if (!reg) return { ok: false, message: "해당 번호의 참가자를 찾을 수 없습니다" };

  const { data: participant } = await supabase
    .from("participants")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (!participant) return { ok: false, message: "참가자가 행사에 입장하지 않았습니다" };

  const { data: claimsData } = await supabase
    .from("reward_claims")
    .select("id, status, reward_id")
    .eq("participant_id", participant.id);

  const rewardIds = (claimsData ?? []).map((c) => c.reward_id);
  const { data: rewards } = rewardIds.length
    ? await supabase.from("rewards").select("id, name").in("id", rewardIds)
    : { data: [] };
  const rewardMap = new Map((rewards ?? []).map((r) => [r.id, r]));

  if (action === "search") {
    return {
      ok: true,
      participantName: reg.name,
      claims: (claimsData ?? []).map((c) => ({
        rewardName: rewardMap.get(c.reward_id)?.name ?? "?",
        claimId: c.id,
        status: c.status,
      })),
    };
  }

  const earnedClaim = (claimsData ?? []).find((c) => c.status === "EARNED");
  if (!earnedClaim) return { ok: false, message: "수령 가능한 보상이 없습니다" };


  const { error } = await supabase
    .from("reward_claims")
    .update({
      status: "CLAIMED",
      claimed_at: new Date().toISOString(),
      claimed_by_user_id: null,
    })
    .eq("id", earnedClaim.id);

  if (error) return { ok: false, message: error.message };
  return { ok: true, participantName: reg.name };
}
