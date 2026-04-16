"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { formatKorean } from "@/lib/phone";

export async function phoneLoginAction(joinCode: string, phoneDigits: string) {
  const supabase = await createClient();

  const phone = phoneDigits.startsWith("0") ? phoneDigits : `0${phoneDigits}`;
  const formatted = formatKorean(phone);

  const { data: event } = await supabase
    .from("events")
    .select("id, status")
    .eq("join_code", joinCode)
    .single();

  if (!event) return { ok: false, message: "행사를 찾을 수 없습니다" };

  const { data: registration } = await supabase
    .from("event_registrations")
    .select("id, name, phone, status")
    .eq("event_id", event.id)
    .eq("phone", formatted)
    .maybeSingle();

  if (!registration) {
    return { ok: false, message: "등록되지 않은 번호입니다. 관리자에게 문의해주세요." };
  }

  const cookieStore = await cookies();
  cookieStore.set("campnic_participant", JSON.stringify({
    eventId: event.id,
    registrationId: registration.id,
    phone: formatted,
    name: registration.name,
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 12,
    path: "/",
  });

  if (registration.status !== "ENTERED") {
    await supabase
      .from("event_registrations")
      .update({ status: "ENTERED", entered_at: new Date().toISOString() })
      .eq("id", registration.id);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: existing } = await supabase
      .from("participants")
      .select("id")
      .eq("event_id", event.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      await supabase.from("participants").insert({
        user_id: user.id,
        event_id: event.id,
        participation_type: "INDIVIDUAL",
      });
    }

    await supabase
      .from("profiles")
      .update({ name: registration.name })
      .eq("id", user.id);
  }

  return { ok: true, eventId: event.id };
}
