"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminOrManager } from "@/lib/auth-guard";
import { formatKorean } from "@/lib/phone";
import type { StampTierConfig, CongestionStatus } from "@/lib/supabase/database.types";

// ---------------------------------------------------------------------------
// Helper: determine current tier from stamp count + tier config
// ---------------------------------------------------------------------------
function getCurrentTier(
  stampCount: number,
  config: StampTierConfig
): { tier: string; label: string; emoji: string } | null {
  // Check from highest to lowest
  if (stampCount >= config.keeper.goal_count) {
    return { tier: "keeper", label: config.keeper.label, emoji: config.keeper.emoji };
  }
  if (stampCount >= config.explorer.goal_count) {
    return { tier: "explorer", label: config.explorer.label, emoji: config.explorer.emoji };
  }
  if (stampCount >= config.sprout.goal_count) {
    return { tier: "sprout", label: config.sprout.label, emoji: config.sprout.emoji };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helper: check and award tier rewards + send chat message
// ---------------------------------------------------------------------------
async function checkTierAndAwardRewards(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  participantId: string,
  boardId: string,
  stampCount: number,
  participantName: string
) {
  const { data: board } = await supabase
    .from("stamp_boards")
    .select("tier_config")
    .eq("id", boardId)
    .single();

  if (!board) return null;

  const config = board.tier_config as unknown as StampTierConfig;
  const tiers = [
    { key: "sprout", ...config.sprout },
    { key: "explorer", ...config.explorer },
    { key: "keeper", ...config.keeper },
  ] as const;

  let newTier: string | null = null;

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

    newTier = tier.key;
  }

  // If a new tier was reached, send chat message
  if (newTier) {
    const tierInfo = getCurrentTier(stampCount, config);
    if (tierInfo) {
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
          content: `🎉 ${participantName}님이 스탬프 랠리 [${tierInfo.label}${tierInfo.emoji}] 등급을 달성했습니다!`,
        });
      }
    }
  }

  return newTier;
}

// ---------------------------------------------------------------------------
// 1. stampParticipantAction
// ---------------------------------------------------------------------------
interface StampResult {
  ok: boolean;
  message?: string;
  stampCount?: number;
  newTier?: string | null;
  participantName?: string;
}

export async function stampParticipantAction(
  eventId: string,
  slotId: string,
  participantPhone: string
): Promise<StampResult> {
  await requireAdminOrManager(eventId);
  const supabase = await createClient();

  const phone = participantPhone.startsWith("0") ? participantPhone : `0${participantPhone}`;
  const formatted = formatKorean(phone);

  // Find participant by phone in this event
  const { data: participant } = await supabase
    .from("participants")
    .select("id, phone")
    .eq("event_id", eventId)
    .eq("phone", formatted)
    .maybeSingle();

  if (!participant) {
    return { ok: false, message: "해당 번호의 참가자를 찾을 수 없습니다" };
  }

  // Get participant display name from registration
  const { data: reg } = await supabase
    .from("event_registrations")
    .select("name")
    .eq("event_id", eventId)
    .eq("phone", formatted)
    .maybeSingle();

  const participantName = reg ? reg.name.replace(/^\[.+?\]\s*/, "") : formatted;

  // Check slot type is MANUAL
  const { data: slot } = await supabase
    .from("stamp_slots")
    .select("id, board_id, type")
    .eq("id", slotId)
    .single();

  if (!slot) return { ok: false, message: "스테이션을 찾을 수 없습니다" };
  if (slot.type !== "MANUAL") {
    return { ok: false, message: "자동 스테이션은 수동으로 스탬프할 수 없습니다" };
  }

  // Check not already stamped
  const { data: existingRecord } = await supabase
    .from("stamp_records")
    .select("id")
    .eq("slot_id", slotId)
    .eq("participant_id", participant.id)
    .maybeSingle();

  if (existingRecord) {
    return { ok: false, message: "이미 이 스테이션에서 스탬프를 받았습니다" };
  }

  // Insert stamp record
  const { error: insertError } = await supabase.from("stamp_records").insert({
    slot_id: slotId,
    participant_id: participant.id,
  });

  if (insertError) return { ok: false, message: insertError.message };

  // Count total stamps for this participant on this board
  const { data: boardSlots } = await supabase
    .from("stamp_slots")
    .select("id")
    .eq("board_id", slot.board_id);

  const boardSlotIds = (boardSlots ?? []).map((s) => s.id);

  const { count: stampCount } = await supabase
    .from("stamp_records")
    .select("*", { count: "exact", head: true })
    .eq("participant_id", participant.id)
    .in("slot_id", boardSlotIds);

  const totalStamps = stampCount ?? 0;

  // Check tier achievements and award rewards
  const newTier = await checkTierAndAwardRewards(
    supabase,
    eventId,
    participant.id,
    slot.board_id,
    totalStamps,
    participantName
  );

  revalidatePath(`/manager/${eventId}/stamp`);

  return {
    ok: true,
    stampCount: totalStamps,
    newTier,
    participantName,
  };
}

// ---------------------------------------------------------------------------
// 2. searchParticipantStampsAction
// ---------------------------------------------------------------------------
interface ParticipantStampInfo {
  ok: boolean;
  message?: string;
  participant?: {
    name: string;
    phone: string;
    stampCount: number;
    currentTier: { tier: string; label: string; emoji: string } | null;
    slots: {
      slotId: string;
      slotName: string;
      slotIcon: string | null;
      stamped: boolean;
      stampedAt: string | null;
    }[];
  };
}

export async function searchParticipantStampsAction(
  eventId: string,
  phone: string
): Promise<ParticipantStampInfo> {
  await requireAdminOrManager(eventId);
  const supabase = await createClient();

  const normalizedPhone = phone.startsWith("0") ? phone : `0${phone}`;
  const formatted = formatKorean(normalizedPhone);

  // Find participant
  const { data: participant } = await supabase
    .from("participants")
    .select("id, phone")
    .eq("event_id", eventId)
    .eq("phone", formatted)
    .maybeSingle();

  if (!participant) {
    return { ok: false, message: "해당 번호의 참가자를 찾을 수 없습니다" };
  }

  // Get display name
  const { data: reg } = await supabase
    .from("event_registrations")
    .select("name")
    .eq("event_id", eventId)
    .eq("phone", formatted)
    .maybeSingle();

  const participantName = reg ? reg.name.replace(/^\[.+?\]\s*/, "") : formatted;

  // Get active board for this event
  const { data: board } = await supabase
    .from("stamp_boards")
    .select("id, tier_config")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .maybeSingle();

  if (!board) {
    return { ok: false, message: "활성화된 스탬프보드가 없습니다" };
  }

  // Get all slots for this board
  const { data: slots } = await supabase
    .from("stamp_slots")
    .select("id, name, icon, order")
    .eq("board_id", board.id)
    .order("order", { ascending: true });

  if (!slots || slots.length === 0) {
    return { ok: false, message: "스테이션이 없습니다" };
  }

  // Get all stamp records for this participant on these slots
  const slotIds = slots.map((s) => s.id);
  const { data: records } = await supabase
    .from("stamp_records")
    .select("slot_id, stamped_at")
    .eq("participant_id", participant.id)
    .in("slot_id", slotIds);

  const recordMap = new Map((records ?? []).map((r) => [r.slot_id, r.stamped_at]));

  const stampCount = recordMap.size;
  const config = board.tier_config as unknown as StampTierConfig;
  const currentTier = getCurrentTier(stampCount, config);

  return {
    ok: true,
    participant: {
      name: participantName,
      phone: formatted,
      stampCount,
      currentTier,
      slots: slots.map((s) => ({
        slotId: s.id,
        slotName: s.name,
        slotIcon: s.icon,
        stamped: recordMap.has(s.id),
        stampedAt: recordMap.get(s.id) ?? null,
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// 3. updateCongestionAction
// ---------------------------------------------------------------------------
export async function updateCongestionAction(
  eventId: string,
  slotId: string,
  status: CongestionStatus
) {
  await requireAdminOrManager(eventId);
  const supabase = await createClient();

  const validStatuses: CongestionStatus[] = ["GREEN", "YELLOW", "RED"];
  if (!validStatuses.includes(status)) {
    throw new Error("유효하지 않은 혼잡도 상태입니다");
  }

  const { error } = await supabase
    .from("stamp_slots")
    .update({ congestion_status: status })
    .eq("id", slotId);

  if (error) throw new Error(error.message);

  revalidatePath(`/manager/${eventId}/stamp`);
}
