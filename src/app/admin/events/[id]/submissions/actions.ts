"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkAndAwardRewards } from "@/lib/rewards";
import { notify } from "@/lib/notifications";

export async function approveSubmissionAction(eventId: string, submissionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const { data: sub } = await supabase
    .from("submissions")
    .select("id, status, participant_id, mission_id")
    .eq("id", submissionId)
    .single();
  if (!sub) throw new Error("제출 없음");
  if (sub.status !== "PENDING" && sub.status !== "RESUBMIT_REQUESTED") return;

  const { data: mission } = await supabase
    .from("missions")
    .select("points")
    .eq("id", sub.mission_id)
    .single();
  if (!mission) throw new Error("미션 없음");

  const { data: participant } = await supabase
    .from("participants")
    .select("total_score")
    .eq("id", sub.participant_id)
    .single();
  if (!participant) throw new Error("참가자 없음");

  const { error: updErr } = await supabase
    .from("submissions")
    .update({
      status: "APPROVED",
      reviewed_at: new Date().toISOString(),
      reviewed_by_user_id: user.id,
      review_method: "MANUAL",
      earned_points: mission.points,
    })
    .eq("id", submissionId);
  if (updErr) throw new Error(updErr.message);

  const newScore = participant.total_score + mission.points;
  await supabase
    .from("participants")
    .update({ total_score: newScore })
    .eq("id", sub.participant_id);

  await checkAndAwardRewards(supabase, eventId, sub.participant_id, sub.mission_id, newScore);

  const { data: pRow } = await supabase
    .from("participants")
    .select("user_id")
    .eq("id", sub.participant_id)
    .single();
  const { data: mRow } = await supabase
    .from("missions")
    .select("title")
    .eq("id", sub.mission_id)
    .single();
  if (pRow && mRow) {
    await notify(
      supabase,
      pRow.user_id,
      "MISSION_APPROVED",
      `🎉 ${mRow.title} 통과!`,
      `+${mission.points}점 획득`
    );
  }

  revalidatePath(`/admin/events/${eventId}/submissions`);
}

export async function rejectSubmissionAction(
  eventId: string,
  submissionId: string,
  reason: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const { error } = await supabase
    .from("submissions")
    .update({
      status: "REJECTED",
      reviewed_at: new Date().toISOString(),
      reviewed_by_user_id: user.id,
      review_method: "MANUAL",
      reject_reason: reason || null,
    })
    .eq("id", submissionId);
  if (error) throw new Error(error.message);

  const { data: subRow } = await supabase
    .from("submissions")
    .select("participant_id, mission_id")
    .eq("id", submissionId)
    .single();
  if (subRow) {
    const [{ data: pRow }, { data: mRow }] = await Promise.all([
      supabase.from("participants").select("user_id").eq("id", subRow.participant_id).single(),
      supabase.from("missions").select("title").eq("id", subRow.mission_id).single(),
    ]);
    if (pRow && mRow) {
      await notify(
        supabase,
        pRow.user_id,
        "MISSION_REJECTED",
        `😢 ${mRow.title} 반려`,
        reason ? `사유: ${reason}` : "다시 시도해보세요"
      );
    }
  }

  revalidatePath(`/admin/events/${eventId}/submissions`);
}
