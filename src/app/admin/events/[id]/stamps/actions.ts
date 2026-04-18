"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminOrManager } from "@/lib/auth-guard";
import type { StampTierConfig, StampSlotType } from "@/lib/supabase/database.types";

// ---------------------------------------------------------------------------
// 1. createStampBoardAction
// ---------------------------------------------------------------------------
export async function createStampBoardAction(eventId: string, formData: FormData) {
  await requireAdminOrManager(eventId);
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const total_slots = Number(formData.get("total_slots") ?? 0);

  if (!name) throw new Error("스탬프보드 이름을 입력해주세요");
  if (total_slots < 3) throw new Error("스테이션은 최소 3개 이상이어야 합니다");

  // Check no existing active board for this event
  const { data: existing } = await supabase
    .from("stamp_boards")
    .select("id")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .maybeSingle();

  if (existing) throw new Error("이미 활성화된 스탬프보드가 있습니다");

  // Default tier config: sprout(3), explorer(5), keeper(total_slots)
  const tier_config: StampTierConfig = {
    sprout: { label: "새싹", emoji: "🌱", goal_count: 3, reward_id: null },
    explorer: { label: "탐험가", emoji: "🧭", goal_count: 5, reward_id: null },
    keeper: { label: "지킴이", emoji: "🏕️", goal_count: total_slots, reward_id: null },
  };

  const { data: board, error } = await supabase
    .from("stamp_boards")
    .insert({
      event_id: eventId,
      name,
      description,
      total_slots,
      tier_config: JSON.parse(JSON.stringify(tier_config)),
    })
    .select("id")
    .single();

  if (error || !board) throw new Error(error?.message ?? "스탬프보드 생성 실패");

  // Bulk insert default stamp slots
  const slots = Array.from({ length: total_slots }, (_, i) => ({
    board_id: board.id,
    name: `스테이션 ${i + 1}`,
    order: i + 1,
    type: "MANUAL" as const,
  }));

  const { error: slotError } = await supabase.from("stamp_slots").insert(slots);
  if (slotError) throw new Error(slotError.message);

  revalidatePath(`/admin/events/${eventId}/stamps`);
}

// ---------------------------------------------------------------------------
// 2. updateStampBoardAction
// ---------------------------------------------------------------------------
export async function updateStampBoardAction(
  eventId: string,
  boardId: string,
  formData: FormData
) {
  await requireAdminOrManager(eventId);
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const tier_sprout = Number(formData.get("tier_sprout") ?? 3);
  const tier_explorer = Number(formData.get("tier_explorer") ?? 5);
  const tier_keeper = Number(formData.get("tier_keeper") ?? 0);

  if (!name) throw new Error("스탬프보드 이름을 입력해주세요");

  // Load current board to get total_slots
  const { data: board } = await supabase
    .from("stamp_boards")
    .select("total_slots, tier_config")
    .eq("id", boardId)
    .single();

  if (!board) throw new Error("스탬프보드를 찾을 수 없습니다");

  // Validate ascending: sprout < explorer < keeper <= total_slots
  if (tier_sprout >= tier_explorer) {
    throw new Error("새싹 목표는 탐험가 목표보다 작아야 합니다");
  }
  if (tier_explorer >= tier_keeper) {
    throw new Error("탐험가 목표는 지킴이 목표보다 작아야 합니다");
  }
  if (tier_keeper > board.total_slots) {
    throw new Error(`지킴이 목표는 총 스테이션 수(${board.total_slots}) 이하여야 합니다`);
  }

  // Merge with existing tier_config to preserve reward_ids
  const existingConfig = (board.tier_config ?? {}) as unknown as StampTierConfig;

  const tier_config: StampTierConfig = {
    sprout: {
      label: "새싹",
      emoji: "🌱",
      goal_count: tier_sprout,
      reward_id: existingConfig.sprout?.reward_id ?? null,
    },
    explorer: {
      label: "탐험가",
      emoji: "🧭",
      goal_count: tier_explorer,
      reward_id: existingConfig.explorer?.reward_id ?? null,
    },
    keeper: {
      label: "지킴이",
      emoji: "🏕️",
      goal_count: tier_keeper,
      reward_id: existingConfig.keeper?.reward_id ?? null,
    },
  };

  // Optional: update reward_ids if provided
  const sproutRewardId = formData.get("sprout_reward_id");
  const explorerRewardId = formData.get("explorer_reward_id");
  const keeperRewardId = formData.get("keeper_reward_id");

  if (sproutRewardId !== null) tier_config.sprout.reward_id = String(sproutRewardId) || null;
  if (explorerRewardId !== null) tier_config.explorer.reward_id = String(explorerRewardId) || null;
  if (keeperRewardId !== null) tier_config.keeper.reward_id = String(keeperRewardId) || null;

  const { error } = await supabase
    .from("stamp_boards")
    .update({
      name,
      description,
      tier_config: JSON.parse(JSON.stringify(tier_config)),
    })
    .eq("id", boardId);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/events/${eventId}/stamps`);
}

// ---------------------------------------------------------------------------
// 3. deleteStampBoardAction
// ---------------------------------------------------------------------------
export async function deleteStampBoardAction(eventId: string, boardId: string) {
  await requireAdminOrManager(eventId);
  const supabase = await createClient();

  // Delete slots first (stamp_records cascade from slots), then board
  const { data: slots } = await supabase
    .from("stamp_slots")
    .select("id")
    .eq("board_id", boardId);

  if (slots && slots.length > 0) {
    const slotIds = slots.map((s) => s.id);
    await supabase.from("stamp_records").delete().in("slot_id", slotIds);
    await supabase.from("stamp_albums").delete().in("slot_id", slotIds);
    await supabase.from("stamp_slots").delete().eq("board_id", boardId);
  }

  const { error } = await supabase.from("stamp_boards").delete().eq("id", boardId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/events/${eventId}/stamps`);
}

// ---------------------------------------------------------------------------
// 4. addStampSlotAction
// ---------------------------------------------------------------------------
export async function addStampSlotAction(
  eventId: string,
  boardId: string,
  formData: FormData
) {
  await requireAdminOrManager(eventId);
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const icon = String(formData.get("icon") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const location_hint = String(formData.get("location_hint") ?? "").trim() || null;
  const type = (String(formData.get("type") ?? "MANUAL") as StampSlotType);
  const mission_id = String(formData.get("mission_id") ?? "").trim() || null;
  const staff_name = String(formData.get("staff_name") ?? "").trim() || null;

  if (!name) throw new Error("스테이션 이름을 입력해주세요");

  // Check slot count doesn't exceed total_slots
  const { data: board } = await supabase
    .from("stamp_boards")
    .select("total_slots")
    .eq("id", boardId)
    .single();

  if (!board) throw new Error("스탬프보드를 찾을 수 없습니다");

  const { count } = await supabase
    .from("stamp_slots")
    .select("*", { count: "exact", head: true })
    .eq("board_id", boardId);

  if (count !== null && count >= board.total_slots) {
    throw new Error(`스테이션 수가 최대(${board.total_slots})에 도달했습니다`);
  }

  // If type=AUTO_ENTRY, check no other AUTO_ENTRY exists
  if (type === "AUTO_ENTRY") {
    const { data: existing } = await supabase
      .from("stamp_slots")
      .select("id")
      .eq("board_id", boardId)
      .eq("type", "AUTO_ENTRY")
      .maybeSingle();

    if (existing) throw new Error("자동입장 스테이션은 하나만 등록할 수 있습니다");
  }

  // Get max order
  const { data: last } = await supabase
    .from("stamp_slots")
    .select("order")
    .eq("board_id", boardId)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (last?.order ?? 0) + 1;

  const { error } = await supabase.from("stamp_slots").insert({
    board_id: boardId,
    name,
    icon,
    description,
    location_hint,
    type,
    mission_id,
    staff_name,
    order: nextOrder,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/events/${eventId}/stamps`);
}

// ---------------------------------------------------------------------------
// 5. updateSlotAction
// ---------------------------------------------------------------------------
export async function updateSlotAction(
  eventId: string,
  slotId: string,
  formData: FormData
) {
  await requireAdminOrManager(eventId);
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const icon = String(formData.get("icon") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const location_hint = String(formData.get("location_hint") ?? "").trim() || null;
  const type = String(formData.get("type") ?? "MANUAL") as StampSlotType;
  const mission_id = String(formData.get("mission_id") ?? "").trim() || null;
  const staff_name = String(formData.get("staff_name") ?? "").trim() || null;

  if (!name) throw new Error("스테이션 이름을 입력해주세요");

  const { error } = await supabase
    .from("stamp_slots")
    .update({ name, icon, description, location_hint, type, mission_id, staff_name })
    .eq("id", slotId);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/events/${eventId}/stamps`);
}

// ---------------------------------------------------------------------------
// 6. deleteSlotAction
// ---------------------------------------------------------------------------
export async function deleteSlotAction(eventId: string, slotId: string) {
  await requireAdminOrManager(eventId);
  const supabase = await createClient();

  // Clean up records and albums for this slot first
  await supabase.from("stamp_records").delete().eq("slot_id", slotId);
  await supabase.from("stamp_albums").delete().eq("slot_id", slotId);

  const { error } = await supabase.from("stamp_slots").delete().eq("id", slotId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/events/${eventId}/stamps`);
}
