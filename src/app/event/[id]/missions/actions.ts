"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkAndAwardRewards } from "@/lib/rewards";
import { haversineMeters } from "@/lib/geo";

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

export async function submitLocationAction(
  eventId: string,
  missionId: string,
  lat: number,
  lng: number,
  accuracy: number
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const { data: mission } = await supabase
    .from("missions")
    .select("id, points, config, event_id")
    .eq("id", missionId)
    .single();
  if (!mission) throw new Error("미션 없음");

  const cfg = (mission.config ?? {}) as { lat?: number; lng?: number; radius?: number };
  if (!cfg.lat || !cfg.lng) throw new Error("미션 좌표 설정 오류");

  const distance = haversineMeters(lat, lng, cfg.lat, cfg.lng);
  const radius = cfg.radius ?? 50;

  if (distance > radius) {
    return {
      ok: false,
      distance: Math.round(distance),
      radius,
      message: `${Math.round(distance - radius)}미터 더 가까이 가주세요`,
    };
  }

  const { data: participant } = await supabase
    .from("participants")
    .select("id, total_score")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .single();
  if (!participant) throw new Error("참가자 아님");

  const { error } = await supabase.from("submissions").insert({
    mission_id: missionId,
    participant_id: participant.id,
    location_lat: lat,
    location_lng: lng,
    location_accuracy: accuracy,
    status: "AUTO_APPROVED",
    review_method: "AUTO",
    reviewed_at: new Date().toISOString(),
    earned_points: mission.points,
  });
  if (error) throw new Error(error.message);

  const newScore = participant.total_score + mission.points;
  await supabase.from("participants").update({ total_score: newScore }).eq("id", participant.id);
  await checkAndAwardRewards(supabase, eventId, participant.id, missionId, newScore);

  revalidatePath(`/event/${eventId}/missions`);
  revalidatePath(`/event/${eventId}`);
  return { ok: true, distance: Math.round(distance), radius };
}

export async function submitTimeattackAction(
  eventId: string,
  missionId: string,
  elapsedSec: number,
  evidence: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const { data: mission } = await supabase
    .from("missions")
    .select("id, points, config")
    .eq("id", missionId)
    .single();
  if (!mission) throw new Error("미션 없음");

  const cfg = (mission.config ?? {}) as { timeLimitSec?: number };
  const limit = cfg.timeLimitSec ?? 60;

  if (elapsedSec > limit) {
    return { ok: false, message: "시간 초과" };
  }

  const { data: participant } = await supabase
    .from("participants")
    .select("id, total_score")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .single();
  if (!participant) throw new Error("참가자 아님");

  const now = new Date();
  const startedAt = new Date(now.getTime() - elapsedSec * 1000);

  const { error } = await supabase.from("submissions").insert({
    mission_id: missionId,
    participant_id: participant.id,
    text_content: evidence || `${elapsedSec}초 완료`,
    started_at: startedAt.toISOString(),
    status: "PENDING",
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/event/${eventId}/missions`);
  return { ok: true };
}

export async function submitPhotoAction(
  eventId: string,
  missionId: string,
  photoUrls: string[],
  photoHashes: string[] = []
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  if (!photoUrls.length) throw new Error("사진을 업로드해주세요");

  if (photoHashes.length > 0) {
    const { data: existing } = await supabase
      .from("submissions")
      .select("photo_hashes, missions!inner(event_id)")
      .eq("missions.event_id", eventId)
      .not("photo_hashes", "eq", "{}");

    const allExistingHashes = new Set(
      (existing ?? []).flatMap((s: { photo_hashes: string[] }) => s.photo_hashes ?? [])
    );
    const duplicate = photoHashes.find((h) => allExistingHashes.has(h));
    if (duplicate) {
      return { ok: false, message: "동일한 사진이 이미 제출되어 있습니다" };
    }
  }

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
    photo_hashes: photoHashes,
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
  return { ok: true };
}
