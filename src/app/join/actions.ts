"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { formatKorean } from "@/lib/phone";

export async function directPhoneLoginAction(phoneDigits: string) {
  const supabase = await createClient();

  const phone = phoneDigits.startsWith("0") ? phoneDigits : `0${phoneDigits}`;
  const formatted = formatKorean(phone);

  // 모든 ACTIVE 행사에서 이 번호로 등록된 것 찾기
  const { data: regs } = await supabase
    .from("event_registrations")
    .select("id, event_id, name, phone, status")
    .eq("phone", formatted);

  if (!regs || regs.length === 0) {
    // 전화번호 뒷자리로도 시도
    const { data: partialRegs } = await supabase
      .from("event_registrations")
      .select("id, event_id, name, phone, status")
      .like("phone", `%${phoneDigits.slice(-4)}`);

    if (!partialRegs || partialRegs.length === 0) {
      return { ok: false, message: "등록된 번호가 없습니다. 관리자에게 문의해주세요." };
    }

    const reg = partialRegs[0];
    return await enterEvent(supabase, reg);
  }

  const reg = regs[0];
  return await enterEvent(supabase, reg);
}

async function enterEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reg: { id: string; event_id: string; name: string; phone: string; status: string }
) {
  if (reg.status !== "ENTERED") {
    await supabase
      .from("event_registrations")
      .update({ status: "ENTERED", entered_at: new Date().toISOString() })
      .eq("id", reg.id);
  }

  const cookieStore = await cookies();
  cookieStore.set(
    "campnic_participant",
    JSON.stringify({
      eventId: reg.event_id,
      phone: reg.phone,
      name: reg.name,
      registrationId: reg.id,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
      path: "/",
    }
  );

  return { ok: true, eventId: reg.event_id, name: reg.name };
}
