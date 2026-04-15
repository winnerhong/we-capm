"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateTeamCode } from "@/lib/codes";

export async function createTeamAction(eventId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("팀명을 입력해주세요");

  const { data: participant } = await supabase
    .from("participants")
    .select("id, team_id")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .single();
  if (!participant) throw new Error("참가자가 아닙니다");
  if (participant.team_id) throw new Error("이미 팀에 속해있습니다");

  const teamCode = generateTeamCode();

  const { data: team, error } = await supabase
    .from("teams")
    .insert({
      event_id: eventId,
      name,
      team_code: teamCode,
      leader_id: user.id,
    })
    .select("id")
    .single();
  if (error || !team) throw new Error(error?.message ?? "생성 실패");

  await supabase
    .from("participants")
    .update({ team_id: team.id, participation_type: "TEAM" })
    .eq("id", participant.id);

  revalidatePath(`/event/${eventId}/team`);
}

export async function joinTeamAction(eventId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const teamCode = String(formData.get("team_code") ?? "").trim().toUpperCase();
  if (!teamCode) throw new Error("팀 코드를 입력해주세요");

  const { data: participant } = await supabase
    .from("participants")
    .select("id, team_id")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .single();
  if (!participant) throw new Error("참가자가 아닙니다");
  if (participant.team_id) throw new Error("이미 팀에 속해있습니다");

  const { data: team } = await supabase
    .from("teams")
    .select("id, event_id")
    .eq("team_code", teamCode)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!team) throw new Error("해당 팀을 찾을 수 없습니다");

  const { data: event } = await supabase
    .from("events")
    .select("max_team_size")
    .eq("id", eventId)
    .single();

  const { count } = await supabase
    .from("participants")
    .select("*", { count: "exact", head: true })
    .eq("team_id", team.id);

  if (event && count !== null && count >= event.max_team_size) {
    throw new Error(`팀 정원(${event.max_team_size}명)이 가득 찼습니다`);
  }

  await supabase
    .from("participants")
    .update({ team_id: team.id, participation_type: "TEAM" })
    .eq("id", participant.id);

  revalidatePath(`/event/${eventId}/team`);
}

export async function leaveTeamAction(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const { data: participant } = await supabase
    .from("participants")
    .select("id, team_id")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .single();
  if (!participant?.team_id) return;

  await supabase
    .from("participants")
    .update({ team_id: null, participation_type: "INDIVIDUAL" })
    .eq("id", participant.id);

  revalidatePath(`/event/${eventId}/team`);
}
