"use server";

import { getParticipant } from "@/lib/participant-session";
import { createClient } from "@/lib/supabase/server";

type ReferralRow = { referral_code: string };

type SupabaseShim = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        maybeSingle: () => Promise<{ data: ReferralRow | null }>;
      };
    };
    insert: (d: unknown) => {
      select: (c: string) => {
        single: () => Promise<{ data: ReferralRow | null }>;
      };
    };
  };
};

function genCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function createReferralCodeAction(eventId: string) {
  const p = await getParticipant(eventId);
  if (!p) throw new Error("로그인 필요");

  const supabase = await createClient();
  const shim = supabase as unknown as SupabaseShim;

  // Return existing code if present
  const { data: existing } = await shim
    .from("referrals")
    .select("referral_code")
    .eq("referrer_phone", p.phone)
    .maybeSingle();

  if (existing) return { referral_code: existing.referral_code };

  // Create new (retry up to 3 times on unlikely collision)
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = genCode();
    const { data } = await shim
      .from("referrals")
      .insert({
        referrer_phone: p.phone,
        referrer_name: p.name,
        referrer_event_id: eventId,
        referral_code: code,
        expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      })
      .select("referral_code")
      .single();

    if (data) return { referral_code: data.referral_code };
  }

  throw new Error("초대 코드 생성 실패");
}
