"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";

function parseReviewForm(formData: FormData) {
  const rating = Number(formData.get("rating") ?? 0);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error("별점을 1~5점 사이로 선택해주세요");
  }
  const comment = String(formData.get("comment") ?? "").trim() || null;
  const missionHighlight = String(formData.get("mission_highlight") ?? "").trim() || null;
  const improvement = String(formData.get("improvement") ?? "").trim() || null;
  const photoConsent = formData.get("photo_consent") === "on";
  const isPublic = formData.get("is_public") === "on";
  return { rating, comment, missionHighlight, improvement, photoConsent, isPublic };
}

export async function submitReviewAction(eventId: string, formData: FormData) {
  const session = await getParticipant(eventId);
  if (!session?.phone) throw new Error("입장 정보가 없어요. 다시 입장해주세요.");

  const supabase = await createClient();
  const parsed = parseReviewForm(formData);

  const { error } = await supabase.from("event_reviews").insert({
    event_id: eventId,
    participant_phone: session.phone,
    participant_name: session.name ?? null,
    rating: parsed.rating,
    comment: parsed.comment,
    mission_highlight: parsed.missionHighlight,
    improvement: parsed.improvement,
    photo_consent: parsed.photoConsent,
    is_public: parsed.isPublic,
  });

  if (error) {
    // Unique 제약 위반(이미 후기 있음) 시 수정으로 유도
    if (error.code === "23505") {
      throw new Error("이미 후기를 남기셨어요. 기존 후기를 수정해주세요.");
    }
    throw new Error(error.message);
  }

  revalidatePath(`/event/${eventId}/review`);
  redirect(`/event/${eventId}/review?ok=1`);
}

export async function updateReviewAction(eventId: string, formData: FormData) {
  const session = await getParticipant(eventId);
  if (!session?.phone) throw new Error("입장 정보가 없어요. 다시 입장해주세요.");

  const supabase = await createClient();
  const parsed = parseReviewForm(formData);

  const { error } = await supabase
    .from("event_reviews")
    .update({
      rating: parsed.rating,
      comment: parsed.comment,
      mission_highlight: parsed.missionHighlight,
      improvement: parsed.improvement,
      photo_consent: parsed.photoConsent,
      is_public: parsed.isPublic,
    })
    .eq("event_id", eventId)
    .eq("participant_phone", session.phone);

  if (error) throw new Error(error.message);

  revalidatePath(`/event/${eventId}/review`);
  redirect(`/event/${eventId}/review?ok=1`);
}
