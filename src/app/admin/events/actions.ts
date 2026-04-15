"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateJoinCode } from "@/lib/codes";
import type { EventStatus, EventType, ParticipationType } from "@/lib/supabase/database.types";

export async function createEventAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const name = String(formData.get("name") ?? "").trim();
  const type = (formData.get("type") ?? "FAMILY") as EventType;
  const start_at = String(formData.get("start_at") ?? "");
  const end_at = String(formData.get("end_at") ?? "");
  const location = String(formData.get("location") ?? "").trim();
  const participation_type = (formData.get("participation_type") ?? "BOTH") as ParticipationType;

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
      created_by_user_id: user.id,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "생성 실패");

  revalidatePath("/admin/events");
  redirect(`/admin/events/${data.id}`);
}

export async function updateEventStatusAction(eventId: string, status: EventStatus) {
  const supabase = await createClient();
  const { error } = await supabase.from("events").update({ status }).eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/events");
}

export async function deleteEventAction(eventId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/events");
  redirect("/admin/events");
}
