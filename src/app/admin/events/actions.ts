"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateJoinCode } from "@/lib/codes";
import type { EventStatus, EventType, ParticipationType } from "@/lib/supabase/database.types";
import { confirmResults } from "@/lib/event-lifecycle";
import { getAllSchools } from "@/lib/school-db";
import { requireAdmin, requireAdminOrManager } from "@/lib/auth-guard";

export async function createEventAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const type = (formData.get("type") ?? "FAMILY") as EventType;
  const start_at = String(formData.get("start_at") ?? "");
  const end_at = String(formData.get("end_at") ?? "");
  const location = String(formData.get("location") ?? "").trim();
  const participation_type = (formData.get("participation_type") ?? "BOTH") as ParticipationType;
  let manager_id = String(formData.get("manager_id") ?? "").trim() || null;
  let manager_password = String(formData.get("manager_password") ?? "").trim() || null;

  const schoolId = String(formData.get("school_id") ?? "").trim();
  if (schoolId) {
    const schools = await getAllSchools();
    const school = schools.find((s) => String(s.id) === schoolId);
    if (school) {
      if (!manager_id) manager_id = school.username;
      if (!manager_password) manager_password = school.password;
    }
  }

  if (!name || !start_at || !end_at || !location) {
    throw new Error("필수 항목이 비어있습니다");
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      name,
      type,
      start_at: new Date(start_at).toISOString(),
      end_at: new Date(end_at).toISOString(),
      location,
      participation_type,
      join_code: generateJoinCode(),
      manager_id,
      manager_password,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "생성 실패");

  // 단톡방 자동 생성
  await supabase.from("chat_rooms").insert({
    event_id: data.id,
    type: "GROUP",
    name: name,
  });

  revalidatePath("/admin/events");
  redirect(`/admin/events/${data.id}`);
}

export async function updateEventAction(eventId: string, formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const type = (formData.get("type") ?? "FAMILY") as EventType;
  const start_at = String(formData.get("start_at") ?? "");
  const end_at = String(formData.get("end_at") ?? "");
  const location = String(formData.get("location") ?? "").trim();
  const participation_type = (formData.get("participation_type") ?? "BOTH") as ParticipationType;
  const max_team_size = Number(formData.get("max_team_size") ?? 6);
  const show_leaderboard = formData.get("show_leaderboard") === "on";
  const show_other_scores = formData.get("show_other_scores") === "on";

  if (!name || !start_at || !end_at || !location) {
    throw new Error("필수 항목이 비어있습니다");
  }

  const { error } = await supabase
    .from("events")
    .update({
      name,
      type,
      start_at: new Date(start_at).toISOString(),
      end_at: new Date(end_at).toISOString(),
      location,
      participation_type,
      max_team_size,
      show_leaderboard,
      show_other_scores,
    })
    .eq("id", eventId);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/edit`);
  redirect(`/admin/events/${eventId}`);
}

export async function updateEventStatusAction(eventId: string, status: EventStatus) {
  await requireAdminOrManager(eventId);
  const supabase = await createClient();

  if (status === "CONFIRMED") {
    await confirmResults(supabase, eventId, "admin");
  } else {
    const { error } = await supabase.from("events").update({ status }).eq("id", eventId);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/events");
}

export async function duplicateEventAction(sourceEventId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { data: source } = await supabase.from("events").select("*").eq("id", sourceEventId).single();
  if (!source) throw new Error("원본 행사 없음");

  const { data: newEvent, error: evErr } = await supabase
    .from("events")
    .insert({
      name: `${source.name} (복사)`,
      description: source.description,
      type: source.type,
      start_at: source.start_at,
      end_at: source.end_at,
      location: source.location,
      location_lat: source.location_lat,
      location_lng: source.location_lng,
      join_code: generateJoinCode(),
      participation_type: source.participation_type,
      max_team_size: source.max_team_size,
      max_team_count: source.max_team_count,
      show_leaderboard: source.show_leaderboard,
      show_other_scores: source.show_other_scores,
      mission_reveal_mode: source.mission_reveal_mode,
      result_publish_mode: source.result_publish_mode,
      auto_end: source.auto_end,
      created_by_user_id: null,
    })
    .select("id")
    .single();
  if (evErr || !newEvent) throw new Error(evErr?.message ?? "복사 실패");

  const { data: missions } = await supabase
    .from("missions")
    .select("title, description, instruction, template_type, points, \"order\", auto_approve, config")
    .eq("event_id", sourceEventId);
  if (missions && missions.length > 0) {
    await supabase.from("missions").insert(
      missions.map((m) => ({ ...m, event_id: newEvent.id }))
    );
  }

  const { data: rewards } = await supabase
    .from("rewards")
    .select("name, description, image_url, reward_type, config, quantity, applies_to")
    .eq("event_id", sourceEventId);
  if (rewards && rewards.length > 0) {
    await supabase.from("rewards").insert(
      rewards.map((r) => ({ ...r, event_id: newEvent.id }))
    );
  }

  revalidatePath("/admin/events");
  redirect(`/admin/events/${newEvent.id}`);
}

export async function deleteEventAction(eventId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/events");
  redirect("/admin/events");
}
