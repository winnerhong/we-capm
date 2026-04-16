"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { formatKorean } from "@/lib/phone";

interface CheckResult {
  ok: boolean;
  message?: string;
  eventId?: string;
  registrationId?: string;
  name?: string;
}

export async function phoneLoginAction(joinCode: string, phoneDigits: string) {
  const supabase = await createClient();

  const phone = phoneDigits.startsWith("0") ? phoneDigits : `0${phoneDigits}`;
  const formatted = formatKorean(phone);

  const { data } = await supabase.rpc("check_phone_registration", {
    p_join_code: joinCode,
    p_phone: formatted,
  });

  const result = data as unknown as CheckResult;
  if (!result?.ok) {
    return { ok: false, message: result?.message ?? "입장 실패" };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    "campnic_participant",
    JSON.stringify({
      eventId: result.eventId,
      registrationId: result.registrationId,
      phone: formatted,
      name: result.name,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
      path: "/",
    }
  );

  return { ok: true, eventId: result.eventId };
}
