"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  await supabase
    .from("participants")
    .update({ total_score: participant.total_score + mission.points })
    .eq("id", sub.participant_id);

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

  revalidatePath(`/admin/events/${eventId}/submissions`);
}
