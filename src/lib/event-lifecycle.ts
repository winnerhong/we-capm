import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { queueEventEndCoupons } from "./coupon-delivery";

type DBClient = SupabaseClient<Database>;

/**
 * Post a review request system message to the event's 전체 단톡방.
 * Stub: just posts the chat message. SMS/Push 등은 추후 확장.
 * Swallows errors — review prompt is nice-to-have, never blocks event end.
 */
export async function postReviewRequest(supabase: DBClient, eventId: string) {
  try {
    const { data: groupRoom } = await supabase
      .from("chat_rooms")
      .select("id")
      .eq("event_id", eventId)
      .eq("name", "💬 전체 단톡방")
      .maybeSingle();

    if (!groupRoom) return;

    await supabase.from("chat_messages").insert({
      room_id: groupRoom.id,
      sender_name: "시스템",
      type: "SYSTEM",
      content: `🌱 행사가 끝났어요! 소중한 후기를 남겨주세요 → /event/${eventId}/review`,
    });
  } catch (err) {
    console.error("[event-lifecycle] postReviewRequest failed", err);
  }
}

export async function checkAndEndEvent(supabase: DBClient, eventId: string) {
  const { data: event } = await supabase
    .from("events")
    .select("id, status, end_at, auto_end")
    .eq("id", eventId)
    .single();

  if (!event || event.status !== "ACTIVE" || !event.auto_end) return;

  if (new Date(event.end_at) <= new Date()) {
    await supabase.from("events").update({ status: "ENDED" }).eq("id", eventId);
    // Auto-deliver coupons on event end (failures are swallowed inside)
    await queueEventEndCoupons(supabase, eventId);
    // Ask participants for reviews (stub: group chat system message)
    await postReviewRequest(supabase, eventId);
  }
}

export async function confirmResults(supabase: DBClient, eventId: string, userId: string) {
  const { data: participants } = await supabase
    .from("participants")
    .select("id, total_score")
    .eq("event_id", eventId)
    .order("total_score", { ascending: false });

  const { data: rankRewards } = await supabase
    .from("rewards")
    .select("id, config, quantity")
    .eq("event_id", eventId)
    .eq("reward_type", "RANK")
    .eq("is_active", true);

  for (const reward of rankRewards ?? []) {
    const cfg = (reward.config ?? {}) as { rankFrom?: number; rankTo?: number };
    const from = (cfg.rankFrom ?? 1) - 1;
    const to = cfg.rankTo ?? 1;

    const winners = (participants ?? []).slice(from, to);
    for (const p of winners) {
      const { data: existing } = await supabase
        .from("reward_claims")
        .select("id")
        .eq("reward_id", reward.id)
        .eq("participant_id", p.id)
        .maybeSingle();
      if (!existing) {
        await supabase.from("reward_claims").insert({
          reward_id: reward.id,
          participant_id: p.id,
          status: "EARNED",
        });
      }
    }
  }

  const { data: pendingSubs } = await supabase
    .from("submissions")
    .select("id, missions!inner(event_id)")
    .eq("missions.event_id", eventId)
    .eq("status", "PENDING");

  for (const sub of pendingSubs ?? []) {
    await supabase
      .from("submissions")
      .update({
        status: "EXPIRED",
        reviewed_at: new Date().toISOString(),
        reviewed_by_user_id: userId,
        review_method: "AUTO",
      })
      .eq("id", sub.id);
  }

  await supabase.from("events").update({ status: "CONFIRMED" }).eq("id", eventId);

  // Also deliver coupons on confirm, in case the event skipped straight past ENDED.
  // Idempotent: duplicates are filtered inside.
  await queueEventEndCoupons(supabase, eventId);
  // Ask for reviews here too (no-op if the group room already has a review prompt
  // — duplicate SYSTEM messages are harmless and rare).
  await postReviewRequest(supabase, eventId);
}
