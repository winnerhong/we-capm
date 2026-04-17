"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

interface EntryResult {
  ok: boolean;
  message?: string;
  needPhone?: boolean;
}

export async function enterChatByNameAction(
  eventId: string,
  name: string,
  phoneLast4?: string
): Promise<EntryResult> {
  const supabase = await createClient();

  const { data } = await supabase.rpc("chat_enter_by_name", {
    p_event_id: eventId,
    p_name: name.trim(),
    p_phone_last4: phoneLast4 || null,
  });

  const result = data as unknown as {
    ok: boolean;
    message?: string;
    needPhone?: boolean;
    name?: string;
    phone?: string;
    registrationId?: string;
  };

  if (!result?.ok) {
    return { ok: false, message: result?.message, needPhone: result?.needPhone };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    "campnic_participant",
    JSON.stringify({
      eventId,
      registrationId: result.registrationId,
      phone: result.phone,
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

  return { ok: true };
}
