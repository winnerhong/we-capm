"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Json, TemplateType } from "@/lib/supabase/database.types";

export async function createMissionAction(eventId: string, formData: FormData) {
  const supabase = await createClient();

  const template_type = (formData.get("template_type") ?? "PHOTO") as TemplateType;
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const points = Number(formData.get("points") ?? 0);
  const auto_approve = formData.get("auto_approve") === "on";

  if (!title || !description || points < 0) {
    throw new Error("필수 항목이 비어있거나 점수가 음수입니다");
  }

  let config: Json = {};

  if (template_type === "QUIZ") {
    const question = String(formData.get("quiz_question") ?? "").trim();
    const answer = String(formData.get("quiz_answer") ?? "").trim();
    const quizType = String(formData.get("quiz_type") ?? "SUBJECTIVE");
    if (!question || !answer) throw new Error("퀴즈 질문/정답 필수");
    config = { question, answer, quizType };
  } else if (template_type === "PHOTO") {
    config = {
      minPhotos: Number(formData.get("photo_min") ?? 1),
      maxPhotos: Number(formData.get("photo_max") ?? 3),
    };
  } else if (template_type === "LOCATION") {
    const lat = Number(formData.get("loc_lat") ?? 0);
    const lng = Number(formData.get("loc_lng") ?? 0);
    const radius = Number(formData.get("loc_radius") ?? 50);
    if (!lat || !lng) throw new Error("위도/경도를 입력해주세요");
    config = { lat, lng, radius };
  } else if (template_type === "VIDEO") {
    config = { maxDurationSec: Number(formData.get("video_max_duration") ?? 30) };
  } else if (template_type === "TIMEATTACK") {
    config = { timeLimitSec: Number(formData.get("time_limit") ?? 60) };
  }

  const { data: last } = await supabase
    .from("missions")
    .select("order")
    .eq("event_id", eventId)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (last?.order ?? 0) + 1;

  const { error, data } = await supabase
    .from("missions")
    .insert({
      event_id: eventId,
      title,
      description,
      template_type,
      points,
      auto_approve,
      order: nextOrder,
      config,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "생성 실패");

  revalidatePath(`/admin/events/${eventId}/missions`);
  redirect(`/admin/events/${eventId}/missions`);
}

export async function updateMissionAction(
  eventId: string,
  missionId: string,
  formData: FormData
) {
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const points = Number(formData.get("points") ?? 0);
  const auto_approve = formData.get("auto_approve") === "on";

  if (!title || !description || points < 0) {
    throw new Error("필수 항목이 비어있거나 점수가 음수입니다");
  }

  const { error } = await supabase
    .from("missions")
    .update({ title, description, points, auto_approve })
    .eq("id", missionId);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/events/${eventId}/missions`);
  redirect(`/admin/events/${eventId}/missions`);
}

export async function duplicateMissionAction(eventId: string, missionId: string) {
  const supabase = await createClient();

  const { data: original } = await supabase
    .from("missions")
    .select("*")
    .eq("id", missionId)
    .single();
  if (!original) throw new Error("미션 없음");

  const { data: last } = await supabase
    .from("missions")
    .select("order")
    .eq("event_id", eventId)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("missions").insert({
    event_id: eventId,
    title: `${original.title} (복사)`,
    description: original.description,
    instruction: original.instruction,
    template_type: original.template_type,
    points: original.points,
    order: (last?.order ?? 0) + 1,
    auto_approve: original.auto_approve,
    config: original.config,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/events/${eventId}/missions`);
}

export async function deleteMissionAction(eventId: string, missionId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("missions").delete().eq("id", missionId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/events/${eventId}/missions`);
}

export async function toggleMissionActiveAction(
  eventId: string,
  missionId: string,
  isActive: boolean
) {
  const supabase = await createClient();
  const { error } = await supabase.from("missions").update({ is_active: isActive }).eq("id", missionId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/events/${eventId}/missions`);
}
