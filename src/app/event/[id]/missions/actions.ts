"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkAndAwardRewards } from "@/lib/rewards";
import { haversineMeters } from "@/lib/geo";
import { getParticipant } from "@/lib/participant-session";

async function getParticipantDb(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string) {
  const session = await getParticipant(eventId);
  if (!session?.phone) throw new Error("입장 정보 없음. 다시 입장해주세요.");
  const { data } = await supabase
    .from("participants")
    .select("id, total_score")
    .eq("event_id", eventId)
    .eq("phone", session.phone)
    .single();
  if (!data) throw new Error("참가 정보 없음");
  return data;
}

export async function submitQuizAction(eventId: string, missionId: string, formData: FormData) {
  const supabase = await createClient();
  const participant = await getParticipantDb(supabase, eventId);

  const answer = String(formData.get("answer") ?? "").trim();
  if (!answer) throw new Error("답변을 입력해주세요");

  const { data: mission } = await supabase.from("missions").select("id, points, config, auto_approve").eq("id", missionId).single();
  if (!mission) throw new Error("미션을 찾을 수 없습니다");

  const cfg = (mission.config ?? {}) as { answer?: string };
  const isCorrect = answer.toLowerCase() === (cfg.answer ?? "").trim().toLowerCase();
  const shouldAutoApprove = mission.auto_approve || isCorrect;

  await supabase.from("submissions").insert({
    mission_id: missionId, participant_id: participant.id, text_content: answer,
    status: shouldAutoApprove ? (isCorrect ? "AUTO_APPROVED" : "APPROVED") : "PENDING",
    review_method: shouldAutoApprove ? "AUTO" : null,
    reviewed_at: shouldAutoApprove ? new Date().toISOString() : null,
    earned_points: shouldAutoApprove ? mission.points : null,
  });

  if (shouldAutoApprove && isCorrect) {
    const newScore = participant.total_score + mission.points;
    await supabase.from("participants").update({ total_score: newScore }).eq("id", participant.id);
    await checkAndAwardRewards(supabase, eventId, participant.id, missionId, newScore);
  }

  revalidatePath(`/event/${eventId}/missions`);
  redirect(`/event/${eventId}/missions?result=${isCorrect ? "correct" : shouldAutoApprove ? "submitted" : "pending"}`);
}

export async function submitLocationAction(eventId: string, missionId: string, lat: number, lng: number, accuracy: number) {
  const supabase = await createClient();
  const { data: mission } = await supabase.from("missions").select("id, points, config").eq("id", missionId).single();
  if (!mission) throw new Error("미션 없음");

  const cfg = (mission.config ?? {}) as { lat?: number; lng?: number; radius?: number };
  if (!cfg.lat || !cfg.lng) throw new Error("미션 좌표 설정 오류");
  if (accuracy < 5) return { ok: false, distance: 0, radius: 0, message: "GPS 정확도가 비정상입니다" };

  const distance = haversineMeters(lat, lng, cfg.lat, cfg.lng);
  const radius = cfg.radius ?? 50;
  if (distance > radius) return { ok: false, distance: Math.round(distance), radius, message: `${Math.round(distance - radius)}미터 더 가까이 가주세요` };

  const participant = await getParticipantDb(supabase, eventId);

  await supabase.from("submissions").insert({
    mission_id: missionId, participant_id: participant.id,
    location_lat: lat, location_lng: lng, location_accuracy: accuracy,
    status: "AUTO_APPROVED", review_method: "AUTO", reviewed_at: new Date().toISOString(), earned_points: mission.points,
  });

  const newScore = participant.total_score + mission.points;
  await supabase.from("participants").update({ total_score: newScore }).eq("id", participant.id);
  await checkAndAwardRewards(supabase, eventId, participant.id, missionId, newScore);

  revalidatePath(`/event/${eventId}/missions`);
  return { ok: true, distance: Math.round(distance), radius };
}

export async function submitVideoAction(eventId: string, missionId: string, videoPath: string) {
  const supabase = await createClient();
  const participant = await getParticipantDb(supabase, eventId);
  const { data: mission } = await supabase.from("missions").select("id, points, auto_approve").eq("id", missionId).single();
  if (!mission) throw new Error("미션 없음");

  const auto = mission.auto_approve;
  await supabase.from("submissions").insert({
    mission_id: missionId, participant_id: participant.id, video_url: videoPath,
    status: auto ? "AUTO_APPROVED" : "PENDING", review_method: auto ? "AUTO" : null,
    reviewed_at: auto ? new Date().toISOString() : null, earned_points: auto ? mission.points : null,
  });

  if (auto) {
    const newScore = participant.total_score + mission.points;
    await supabase.from("participants").update({ total_score: newScore }).eq("id", participant.id);
    await checkAndAwardRewards(supabase, eventId, participant.id, missionId, newScore);
  }
  revalidatePath(`/event/${eventId}/missions`);
  return { ok: true };
}

export async function submitTimeattackAction(eventId: string, missionId: string, elapsedSec: number, evidence: string) {
  const supabase = await createClient();
  const { data: mission } = await supabase.from("missions").select("id, points, config").eq("id", missionId).single();
  if (!mission) throw new Error("미션 없음");

  const limit = ((mission.config ?? {}) as { timeLimitSec?: number }).timeLimitSec ?? 60;
  if (elapsedSec > limit) return { ok: false, message: "시간 초과" };

  const participant = await getParticipantDb(supabase, eventId);
  const startedAt = new Date(Date.now() - elapsedSec * 1000);

  await supabase.from("submissions").insert({
    mission_id: missionId, participant_id: participant.id,
    text_content: evidence || `${elapsedSec}초 완료`, started_at: startedAt.toISOString(), status: "PENDING",
  });
  revalidatePath(`/event/${eventId}/missions`);
  return { ok: true };
}

export async function submitPhotoAction(eventId: string, missionId: string, photoUrls: string[], photoHashes: string[] = []) {
  const supabase = await createClient();
  if (!photoUrls.length) throw new Error("사진을 업로드해주세요");

  if (photoHashes.length > 0) {
    const { data: existing } = await supabase.from("submissions").select("photo_hashes").not("photo_hashes", "eq", "{}");
    const allHashes = new Set((existing ?? []).flatMap((s: { photo_hashes: string[] }) => s.photo_hashes ?? []));
    if (photoHashes.find((h) => allHashes.has(h))) return { ok: false, message: "동일한 사진이 이미 제출되어 있습니다" };
  }

  const participant = await getParticipantDb(supabase, eventId);
  const { data: mission } = await supabase.from("missions").select("id, points, auto_approve").eq("id", missionId).single();
  if (!mission) throw new Error("미션 없음");

  const auto = mission.auto_approve;
  await supabase.from("submissions").insert({
    mission_id: missionId, participant_id: participant.id, photo_urls: photoUrls, photo_hashes: photoHashes,
    status: auto ? "AUTO_APPROVED" : "PENDING", review_method: auto ? "AUTO" : null,
    reviewed_at: auto ? new Date().toISOString() : null, earned_points: auto ? mission.points : null,
  });

  if (auto) {
    const newScore = participant.total_score + mission.points;
    await supabase.from("participants").update({ total_score: newScore }).eq("id", participant.id);
    await checkAndAwardRewards(supabase, eventId, participant.id, missionId, newScore);
  }
  revalidatePath(`/event/${eventId}/missions`);
  return { ok: true };
}
