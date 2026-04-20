"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { formatKorean } from "@/lib/phone";

type ReferralRow = {
  id: string;
  referrer_phone: string;
  referrer_name: string | null;
  referrer_event_id: string | null;
  referral_code: string;
  invitee_phone: string | null;
  status: "PENDING" | "JOINED" | "COMPLETED" | "EXPIRED";
  expires_at: string | null;
};

type SupabaseShim = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        maybeSingle: () => Promise<{ data: ReferralRow | null }>;
      };
    };
    update: (d: unknown) => {
      eq: (k: string, v: string) => Promise<{ error: unknown }>;
    };
  };
};

export async function acceptInviteAction(code: string, rawPhone: string, name: string) {
  const supabase = await createClient();
  const shim = supabase as unknown as SupabaseShim;

  // 1. Look up referral by code
  const { data: referral } = await shim
    .from("referrals")
    .select("id, referrer_phone, referrer_name, referrer_event_id, referral_code, invitee_phone, status, expires_at")
    .eq("referral_code", code)
    .maybeSingle();

  if (!referral) {
    return { ok: false, message: "유효하지 않은 초대 코드입니다." };
  }

  if (referral.status === "EXPIRED") {
    return { ok: false, message: "만료된 초대 링크입니다." };
  }

  if (referral.expires_at && new Date(referral.expires_at) < new Date()) {
    return { ok: false, message: "만료된 초대 링크입니다." };
  }

  const eventId = referral.referrer_event_id;
  if (!eventId) {
    return { ok: false, message: "초대자의 행사 정보를 찾을 수 없습니다." };
  }

  // 2. Normalize phone
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length < 10) {
    return { ok: false, message: "올바른 전화번호를 입력해주세요." };
  }
  const normalized = digits.startsWith("0") ? digits : `0${digits}`;
  const formatted = formatKorean(normalized);
  const cleanName = name.trim();
  if (!cleanName) {
    return { ok: false, message: "이름을 입력해주세요." };
  }

  // Prevent self-referral
  if (formatted === referral.referrer_phone) {
    return { ok: false, message: "본인은 초대할 수 없습니다." };
  }

  // 3. Create participant if not exists
  const { data: existingP } = await supabase
    .from("participants")
    .select("id")
    .eq("event_id", eventId)
    .eq("phone", formatted)
    .maybeSingle();

  let participantId = existingP?.id;
  if (!participantId) {
    const { data: newP } = await supabase
      .from("participants")
      .insert({ event_id: eventId, phone: formatted, participation_type: "INDIVIDUAL" })
      .select("id")
      .single();
    participantId = newP?.id;
  }

  // 3b. Ensure event_registration exists (so they can pass directPhoneLoginAction later)
  const { data: existingReg } = await supabase
    .from("event_registrations")
    .select("id")
    .eq("event_id", eventId)
    .eq("phone", formatted)
    .maybeSingle();

  let registrationId = existingReg?.id;
  if (!registrationId) {
    const { data: newReg } = await supabase
      .from("event_registrations")
      .insert({
        event_id: eventId,
        phone: formatted,
        name: cleanName,
        status: "ENTERED",
        entered_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    registrationId = newReg?.id;
  }

  // 4. Update referral → JOINED (only if still PENDING)
  if (referral.status === "PENDING") {
    await shim
      .from("referrals")
      .update({
        invitee_phone: formatted,
        invitee_name: cleanName,
        invitee_joined_at: new Date().toISOString(),
        invitee_event_id: eventId,
        status: "JOINED",
      })
      .eq("id", referral.id);
  }

  // 5. Set cookie
  const cookieStore = await cookies();
  cookieStore.set(
    "campnic_participant",
    JSON.stringify({
      eventId,
      phone: formatted,
      name: cleanName,
      registrationId,
      participantId,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
      path: "/",
    }
  );

  return { ok: true, eventId, referrerName: referral.referrer_name ?? null };
}
