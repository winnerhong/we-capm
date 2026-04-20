"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";

export type SubscriptionTier = "SPROUT" | "TREE" | "FOREST";

const PRICES: Record<SubscriptionTier, number> = {
  SPROUT: 59000,
  TREE: 99000,
  FOREST: 159000,
};

const ACORNS: Record<SubscriptionTier, number> = {
  SPROUT: 500,
  TREE: 1200,
  FOREST: 2500,
};

type AnyFromClient = {
  from: (t: string) => {
    insert: (d: unknown) => {
      select: (cols?: string) => {
        single: () => Promise<{ data: { id: string } | null; error: unknown }>;
      };
    };
    update: (d: unknown) => {
      eq: (col: string, val: unknown) => {
        eq: (col: string, val: unknown) => Promise<{ error: unknown }>;
        select?: (cols?: string) => Promise<{ data: unknown; error: unknown }>;
      };
    };
    select: (cols?: string) => {
      eq: (col: string, val: unknown) => {
        eq: (col: string, val: unknown) => {
          maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
        };
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
        order?: (col: string, opts?: unknown) => {
          limit: (n: number) => {
            maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
          };
        };
      };
    };
  };
};

function anyClient(supabase: unknown): AnyFromClient {
  return supabase as AnyFromClient;
}

/**
 * Start a new subscription. Cancels any existing ACTIVE subscription for this phone first.
 */
export async function subscribeAction(
  eventId: string,
  tier: SubscriptionTier,
): Promise<{ ok: true; subscriptionId?: string }> {
  const p = await getParticipant(eventId);
  if (!p) throw new Error("로그인 필요");

  if (!["SPROUT", "TREE", "FOREST"].includes(tier)) {
    throw new Error("잘못된 플랜");
  }

  const supabase = await createClient();
  const client = anyClient(supabase);

  // Cancel any existing active subscription first
  await client
    .from("subscriptions")
    .update({
      status: "CANCELED",
      canceled_at: new Date().toISOString(),
    })
    .eq("participant_phone", p.phone)
    .eq("status", "ACTIVE");

  // Compute next billing date (~30 days from now)
  const nextBilling = new Date();
  nextBilling.setMonth(nextBilling.getMonth() + 1);

  const { data, error } = await client
    .from("subscriptions")
    .insert({
      participant_phone: p.phone,
      tier,
      monthly_price: PRICES[tier],
      monthly_acorns: ACORNS[tier],
      status: "ACTIVE",
      next_billing_at: nextBilling.toISOString(),
      auto_renew: true,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error("구독 실패");
  }

  // TODO: add participant record check & grant initial acorns (increment total_score)

  revalidatePath(`/event/${eventId}`);
  revalidatePath(`/event/${eventId}/subscription`);
  return { ok: true, subscriptionId: data?.id };
}

/**
 * Cancel a subscription (immediate status=CANCELED, auto_renew=false).
 */
export async function cancelSubscriptionAction(
  eventId: string,
  subId: string,
): Promise<{ ok: true }> {
  const p = await getParticipant(eventId);
  if (!p) throw new Error("로그인 필요");

  const supabase = await createClient();
  const client = anyClient(supabase);

  const { error } = await client
    .from("subscriptions")
    .update({
      status: "CANCELED",
      auto_renew: false,
      canceled_at: new Date().toISOString(),
    })
    .eq("id", subId)
    .eq("participant_phone", p.phone);

  if (error) throw new Error("해지 실패");

  revalidatePath(`/event/${eventId}`);
  revalidatePath(`/event/${eventId}/subscription`);
  return { ok: true };
}

/**
 * Pause a subscription (status=PAUSED).
 */
export async function pauseSubscriptionAction(
  eventId: string,
  subId: string,
): Promise<{ ok: true }> {
  const p = await getParticipant(eventId);
  if (!p) throw new Error("로그인 필요");

  const supabase = await createClient();
  const client = anyClient(supabase);

  const { error } = await client
    .from("subscriptions")
    .update({ status: "PAUSED" })
    .eq("id", subId)
    .eq("participant_phone", p.phone);

  if (error) throw new Error("일시 정지 실패");

  revalidatePath(`/event/${eventId}`);
  revalidatePath(`/event/${eventId}/subscription`);
  return { ok: true };
}

/**
 * Resume a paused subscription (status=ACTIVE).
 */
export async function resumeSubscriptionAction(
  eventId: string,
  subId: string,
): Promise<{ ok: true }> {
  const p = await getParticipant(eventId);
  if (!p) throw new Error("로그인 필요");

  const supabase = await createClient();
  const client = anyClient(supabase);

  const { error } = await client
    .from("subscriptions")
    .update({ status: "ACTIVE" })
    .eq("id", subId)
    .eq("participant_phone", p.phone);

  if (error) throw new Error("재개 실패");

  revalidatePath(`/event/${eventId}`);
  revalidatePath(`/event/${eventId}/subscription`);
  return { ok: true };
}
