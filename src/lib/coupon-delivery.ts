import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type DBClient = SupabaseClient<Database>;

/**
 * Called when an event ends. Queues coupon deliveries for all event participants.
 * Delivery timing respects each coupon's send_delay_minutes (respected downstream by sender worker).
 * Idempotent: will skip (participant_phone, coupon_id, event_id) rows that already exist.
 */
export async function queueEventEndCoupons(supabase: DBClient, eventId: string) {
  try {
    // 1. Get all participants of this event with a phone number
    const { data: participants } = await supabase
      .from("participants")
      .select("phone")
      .eq("event_id", eventId);

    const phones = (participants ?? [])
      .map((p) => p.phone)
      .filter((p): p is string => typeof p === "string" && p.length > 0);

    if (phones.length === 0) return { delivered: 0, coupons: 0 };

    // 2. Get all active coupons
    const supabaseAny = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: unknown) => Promise<{ data: unknown[] | null; error: unknown }>;
        };
      };
    };
    const { data: couponsRaw } = await supabaseAny
      .from("coupons")
      .select("id")
      .eq("status", "ACTIVE");

    const coupons = (couponsRaw ?? []) as Array<{ id: string }>;
    if (coupons.length === 0) return { delivered: 0, coupons: 0 };

    // 3. Fetch existing deliveries for this event so we can skip duplicates (idempotent)
    const existingAny = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: unknown) => Promise<{ data: unknown[] | null; error: unknown }>;
        };
      };
    };
    const { data: existingRaw } = await existingAny
      .from("coupon_deliveries")
      .select("coupon_id, participant_phone")
      .eq("event_id", eventId);

    const existing = new Set(
      ((existingRaw ?? []) as Array<{ coupon_id: string; participant_phone: string }>).map(
        (r) => `${r.coupon_id}::${r.participant_phone}`
      )
    );

    // 4. Build deliveries for each participant × each active coupon (MVP: skip radius filter)
    const deliveries: Array<{
      coupon_id: string;
      participant_phone: string;
      event_id: string;
    }> = [];
    for (const phone of phones) {
      for (const coupon of coupons) {
        const key = `${coupon.id}::${phone}`;
        if (existing.has(key)) continue;
        deliveries.push({
          coupon_id: coupon.id,
          participant_phone: phone,
          event_id: eventId,
        });
      }
    }

    if (deliveries.length > 0) {
      const insertAny = supabase as unknown as {
        from: (t: string) => { insert: (d: unknown) => Promise<{ error: unknown }> };
      };
      await insertAny.from("coupon_deliveries").insert(deliveries);
    }

    // 5. Post a system message to the group chat room (토리톡 전체 단톡방)
    if (deliveries.length > 0) {
      const { data: groupRoom } = await supabase
        .from("chat_rooms")
        .select("id")
        .eq("event_id", eventId)
        .eq("name", "💬 전체 단톡방")
        .maybeSingle();

      if (groupRoom) {
        const chatInsertAny = supabase as unknown as {
          from: (t: string) => { insert: (d: unknown) => Promise<{ error: unknown }> };
        };
        await chatInsertAny.from("chat_messages").insert({
          room_id: groupRoom.id,
          sender_name: "시스템",
          type: "SYSTEM",
          content: `🎁 오늘의 선물 ${coupons.length}개가 도착했어요! 보상함에서 확인하세요 🌰`,
        });
      }
    }

    return { delivered: deliveries.length, coupons: coupons.length };
  } catch (err) {
    // Never fail the calling transaction (event-end / confirm) because of coupon delivery
    console.error("[coupon-delivery] queueEventEndCoupons failed", err);
    return { delivered: 0, coupons: 0, error: (err as Error)?.message ?? "unknown" };
  }
}

/**
 * Called on event start for coupon categories that deliver DURING the event (e.g., early-arrival bonus).
 * Placeholder for future logic.
 */
export async function queueEventStartCoupons(_supabase: DBClient, _eventId: string) {
  return { delivered: 0 };
}
