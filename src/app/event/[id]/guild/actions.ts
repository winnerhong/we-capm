"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";
import type { Guild, GuildMember } from "./types";

type AnySupabase = ReturnType<typeof createClient> extends Promise<infer T> ? T : never;

function tbl(supabase: AnySupabase, name: string) {
  // Escape hatch: DB types may not include the new tables yet
  return (supabase as unknown as { from: (t: string) => any }).from(name);
}

export async function createGuildAction(eventId: string, formData: FormData) {
  const p = await getParticipant(eventId);
  if (!p) throw new Error("입장 정보 없음");

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const icon = String(formData.get("icon") ?? "🏡").trim() || "🏡";
  const maxMembersRaw = Number(formData.get("max_members") ?? 10);
  const max_members = Number.isFinite(maxMembersRaw) && maxMembersRaw > 0 ? Math.min(50, Math.floor(maxMembersRaw)) : 10;
  const is_public = formData.get("is_public") === "on" || formData.get("is_public") === "true";

  if (!name) throw new Error("패밀리 이름을 입력해주세요");

  const supabase = await createClient();

  // Already in a guild?
  const { data: existing } = await tbl(supabase, "guild_members")
    .select("id")
    .eq("participant_phone", p.phone)
    .maybeSingle();
  if (existing) throw new Error("이미 다른 패밀리에 속해있습니다");

  const { data: guild, error } = await tbl(supabase, "guilds")
    .insert({
      event_id: eventId,
      name,
      description,
      icon,
      leader_phone: p.phone,
      max_members,
      total_acorns: 0,
      is_public,
    })
    .select("id")
    .single();

  if (error || !guild) throw new Error(error?.message ?? "패밀리 생성 실패");

  const { error: memberErr } = await tbl(supabase, "guild_members").insert({
    guild_id: (guild as { id: string }).id,
    participant_phone: p.phone,
    participant_name: p.name,
    role: "LEADER",
  });
  if (memberErr) throw new Error(memberErr.message);

  revalidatePath(`/event/${eventId}/guild`);
  redirect(`/event/${eventId}/guild`);
}

export async function joinGuildAction(eventId: string, guildId: string) {
  const p = await getParticipant(eventId);
  if (!p) throw new Error("입장 정보 없음");

  const supabase = await createClient();

  // Already in a guild?
  const { data: existing } = await tbl(supabase, "guild_members")
    .select("id")
    .eq("participant_phone", p.phone)
    .maybeSingle();
  if (existing) throw new Error("이미 다른 패밀리에 속해있습니다");

  // Guild exists + capacity
  const { data: guild } = await tbl(supabase, "guilds")
    .select("id, max_members, event_id")
    .eq("id", guildId)
    .maybeSingle();
  if (!guild) throw new Error("패밀리를 찾을 수 없습니다");
  if ((guild as Guild).event_id !== eventId) throw new Error("다른 이벤트의 패밀리입니다");

  const { count } = await tbl(supabase, "guild_members")
    .select("id", { count: "exact", head: true })
    .eq("guild_id", guildId);
  if (typeof count === "number" && count >= (guild as Guild).max_members) {
    throw new Error("패밀리 정원이 가득 찼어요");
  }

  const { error } = await tbl(supabase, "guild_members").insert({
    guild_id: guildId,
    participant_phone: p.phone,
    participant_name: p.name,
    role: "MEMBER",
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/event/${eventId}/guild`);
}

export async function leaveGuildAction(eventId: string, guildId: string) {
  const p = await getParticipant(eventId);
  if (!p) throw new Error("입장 정보 없음");

  const supabase = await createClient();

  const { data: member } = await tbl(supabase, "guild_members")
    .select("id, role")
    .eq("guild_id", guildId)
    .eq("participant_phone", p.phone)
    .maybeSingle();
  if (!member) return;

  // Leader leaving: dissolve the guild (delete members + guild)
  if ((member as GuildMember).role === "LEADER") {
    await tbl(supabase, "guild_members").delete().eq("guild_id", guildId);
    await tbl(supabase, "guilds").delete().eq("id", guildId);
  } else {
    await tbl(supabase, "guild_members").delete().eq("id", (member as GuildMember).id);
  }

  revalidatePath(`/event/${eventId}/guild`);
}
