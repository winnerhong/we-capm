import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StampTierConfig } from "@/lib/supabase/database.types";

type DBClient = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Called from phone-login-action.ts after participant enters
// ---------------------------------------------------------------------------
export async function tryAutoStampEntry(
  supabase: DBClient,
  eventId: string,
  participantId: string
) {
  // Find active board for this event
  const { data: board } = await supabase
    .from("stamp_boards")
    .select("id")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .maybeSingle();

  if (!board) return;

  // Find AUTO_ENTRY slot
  const { data: slot } = await supabase
    .from("stamp_slots")
    .select("id")
    .eq("board_id", board.id)
    .eq("type", "AUTO_ENTRY")
    .maybeSingle();

  if (!slot) return;

  // Check not already stamped
  const { data: existing } = await supabase
    .from("stamp_records")
    .select("id")
    .eq("slot_id", slot.id)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (existing) return;

  // Insert stamp record
  await supabase.from("stamp_records").insert({
    slot_id: slot.id,
    participant_id: participantId,
  });

  await checkAndAwardTier(supabase, eventId, participantId, board.id);
}

// ---------------------------------------------------------------------------
// Called from rewards.ts / submission approval after mission approval
// ---------------------------------------------------------------------------
export async function tryAutoStampMission(
  supabase: DBClient,
  eventId: string,
  participantId: string,
  missionId: string
) {
  // Find active board for this event
  const { data: board } = await supabase
    .from("stamp_boards")
    .select("id")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .maybeSingle();

  if (!board) return;

  // Find AUTO_MISSION slot linked to this mission
  const { data: slot } = await supabase
    .from("stamp_slots")
    .select("id")
    .eq("board_id", board.id)
    .eq("type", "AUTO_MISSION")
    .eq("mission_id", missionId)
    .maybeSingle();

  if (!slot) return;

  // Check not already stamped
  const { data: existing } = await supabase
    .from("stamp_records")
    .select("id")
    .eq("slot_id", slot.id)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (existing) return;

  // Insert stamp record
  await supabase.from("stamp_records").insert({
    slot_id: slot.id,
    participant_id: participantId,
  });

  await checkAndAwardTier(supabase, eventId, participantId, board.id);
}

// ---------------------------------------------------------------------------
// Shared tier check: count stamps, load config, award rewards, send message
// ---------------------------------------------------------------------------
async function checkAndAwardTier(
  supabase: DBClient,
  eventId: string,
  participantId: string,
  boardId: string
) {
  // Get board with tier config
  const { data: board } = await supabase
    .from("stamp_boards")
    .select("tier_config")
    .eq("id", boardId)
    .single();

  if (!board) return;

  const config = board.tier_config as unknown as StampTierConfig;

  // Get all slots for this board
  const { data: slots } = await supabase
    .from("stamp_slots")
    .select("id")
    .eq("board_id", boardId);

  if (!slots || slots.length === 0) return;

  const slotIds = slots.map((s) => s.id);

  // Count stamps
  const { count } = await supabase
    .from("stamp_records")
    .select("*", { count: "exact", head: true })
    .eq("participant_id", participantId)
    .in("slot_id", slotIds);

  const stampCount = count ?? 0;

  // Get participant name for chat message
  const { data: participant } = await supabase
    .from("participants")
    .select("phone")
    .eq("id", participantId)
    .single();

  let displayName = "참가자";
  if (participant?.phone) {
    const { data: reg } = await supabase
      .from("event_registrations")
      .select("name")
      .eq("event_id", eventId)
      .eq("phone", participant.phone)
      .maybeSingle();
    if (reg) displayName = reg.name.replace(/^\[.+?\]\s*/, "");
  }

  // Check each tier
  const tiers = [
    { key: "sprout", ...config.sprout },
    { key: "explorer", ...config.explorer },
    { key: "keeper", ...config.keeper },
  ] as const;

  for (const tier of tiers) {
    if (stampCount < tier.goal_count) continue;
    if (!tier.reward_id) continue;

    // Check if reward already claimed
    const { data: existing } = await supabase
      .from("reward_claims")
      .select("id")
      .eq("reward_id", tier.reward_id)
      .eq("participant_id", participantId)
      .maybeSingle();

    if (existing) continue;

    // Award reward
    await supabase.from("reward_claims").insert({
      reward_id: tier.reward_id,
      participant_id: participantId,
      status: "EARNED",
    });

    // Send chat message to group room
    const { data: groupRoom } = await supabase
      .from("chat_rooms")
      .select("id")
      .eq("event_id", eventId)
      .eq("name", "\uD83D\uDCAC 전체 단톡방")
      .maybeSingle();

    if (groupRoom) {
      await supabase.from("chat_messages").insert({
        room_id: groupRoom.id,
        sender_name: "시스템",
        type: "SYSTEM",
        content: `🎉 ${displayName}님이 스탬프 랠리 [${tier.label}${tier.emoji}] 등급을 달성했습니다!`,
      });
    }
  }
}
