"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkAndAwardRewards } from "@/lib/rewards";

export async function submitQuizAction(eventId: string, missionId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const answer = String(formData.get("answer") ?? "").trim();
  if (!answer) throw new Error("답변을 입력해주세요");

  const { data: mission } = await supabase
    .from("missions")
    .select("id, points, config, auto_approve, event_id")
    .eq("id", missionId)
    .single();
  if (!mission) throw new Error("미션을 찾을 수 없습니다");

  const { data: participant } = await supabase
    .from("participants")
    .select("id, total_score")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .single();
  if (!participant) throw new Error("참가 정보 없음");

  const cfg = (mission.config ?? {}) as { answer?: string };
  const correctAnswer = (cfg.answer ?? "").trim().toLowerCase();
  const userAnswer = answer.toLowerCase();
  const isCorrect = userAnswer === correctAnswer;

  const shouldAutoApprove = mission.auto_approve || isCorrect;

  const { error: subError } = await supabase.from("submissions").insert({
    mission_id: missionId,
    participant_id: participant.id,
    text_content: answer,
    status: shouldAutoApprove ? (isCorrect ? "AUTO_APPROVED" : "APPROVED") : "PENDING",
    review_method: shouldAutoApprove ? "AUTO" : null,
    reviewed_at: shouldAutoApprove ? new Date().toISOString() : null,
    earned_points: shouldAutoApprove && isCorrect ? mission.points : shouldAutoApprove ? mission.points : null,
  });
  if (subError) throw new Error(subError.message);

  if (shouldAutoApprove && isCorrect) {
    const newScore = participant.total_score + mission.points;
    await supabase
      .from("participants")
      .update({ total_score: newScore })
      .eq("id", participant.id);
    await checkAndAwardRewards(supabase, eventId, participant.id, missionId, newScore);
  }

  revalidatePath(`/event/${eventId}/missions`);
  revalidatePath(`/event/${eventId}`);
  redirect(`/event/${eventId}/missions?result=${isCorrect ? "correct" : shouldAutoApprove ? "submitted" : "pending"}`);
}

export async function submitPhotoAction(
  eventId: string,
  missionId: string,
  photoUrls: string[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  if (!photoUrls.length) throw new Error("사진을 업로드해주세요");

  const { data: mission } = await supabase
    .from("missions")
    .select("id, points, auto_approve")
    .eq("id", missionId)
    .single();
  if (!mission) throw new Error("미션을 찾을 수 없습니다");

  const { data: participant } = await supabase
    .from("participants")
    .select("id, total_score")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .single();
  if (!participant) throw new Error("참가 정보 없음");

  const auto = mission.auto_approve;

  const { error: subError } = await supabase.from("submissions").insert({
    mission_id: missionId,
    participant_id: participant.id,
    photo_urls: photoUrls,
    status: auto ? "AUTO_APPROVED" : "PENDING",
    review_method: auto ? "AUTO" : null,
    reviewed_at: auto ? new Date().toISOString() : null,
    earned_points: auto ? mission.points : null,
  });
  if (subError) throw new Error(subError.message);

  if (auto) {
    const newScore = participant.total_score + mission.points;
    await supabase
      .from("participants")
      .update({ total_score: newScore })
      .eq("id", participant.id);
    await checkAndAwardRewards(supabase, eventId, participant.id, missionId, newScore);
  }

  revalidatePath(`/event/${eventId}/missions`);
  revalidatePath(`/event/${eventId}`);
}
