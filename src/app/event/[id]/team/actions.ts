"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateTeamCode } from "@/lib/codes";
import { createTeamChatRoom } from "@/app/admin/events/[id]/chat/actions";
import { getParticipant } from "@/lib/participant-session";

export async function createTeamAction(eventId: string, formData: FormData) {
  const supabase = await createClient();
  const session = await getParticipant(eventId);
  if (!session) throw new Error("입장 정보 없음");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("팀명을 입력해주세요");

  const { data: participant } = await supabase
    .from("participants").select("id, team_id")
    .eq("event_id", eventId).eq("phone", session.phone).single();
  if (!participant) throw new Error("참가자가 아닙니다");
  if (participant.team_id) throw new Error("이미 팀에 속해있습니다");

  const { data: team, error } = await supabase.from("teams").insert({
    event_id: eventId, name, team_code: generateTeamCode(), leader_id: participant.id,
  }).select("id").single();
  if (error || !team) throw new Error(error?.message ?? "생성 실패");

  await supabase.from("participants").update({ team_id: team.id, participation_type: "TEAM" }).eq("id", participant.id);
  await createTeamChatRoom(eventId, team.id, name);
  revalidatePath(`/event/${eventId}/team`);
}

export async function joinTeamAction(eventId: string, formData: FormData) {
  const supabase = await createClient();
  const session = await getParticipant(eventId);
  if (!session) throw new Error("입장 정보 없음");

  const teamCode = String(formData.get("team_code") ?? "").trim().toUpperCase();
  if (!teamCode) throw new Error("팀 코드를 입력해주세요");

  const { data: participant } = await supabase
    .from("participants").select("id, team_id")
    .eq("event_id", eventId).eq("phone", session.phone).single();
  if (!participant) throw new Error("참가자가 아닙니다");
  if (participant.team_id) throw new Error("이미 팀에 속해있습니다");

  const { data: team } = await supabase
    .from("teams").select("id, event_id")
    .eq("team_code", teamCode).eq("event_id", eventId).maybeSingle();
  if (!team) throw new Error("해당 팀을 찾을 수 없습니다");

  await supabase.from("participants").update({ team_id: team.id, participation_type: "TEAM" }).eq("id", participant.id);
  revalidatePath(`/event/${eventId}/team`);
}

export async function leaveTeamAction(eventId: string) {
  const supabase = await createClient();
  const session = await getParticipant(eventId);
  if (!session) return;

  const { data: participant } = await supabase
    .from("participants").select("id, team_id")
    .eq("event_id", eventId).eq("phone", session.phone).single();
  if (!participant?.team_id) return;

  await supabase.from("participants").update({ team_id: null, participation_type: "INDIVIDUAL" }).eq("id", participant.id);
  revalidatePath(`/event/${eventId}/team`);
}
