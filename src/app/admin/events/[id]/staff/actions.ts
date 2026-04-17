"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatKorean } from "@/lib/phone";

export async function addStaffAction(eventId: string, formData: FormData) {
  const supabase = await createClient();
  const phoneRaw = String(formData.get("phone") ?? "").replace(/\D/g, "");
  if (phoneRaw.length < 10) throw new Error("올바른 전화번호를 입력해주세요");

  const phone = phoneRaw.startsWith("0") ? phoneRaw : `0${phoneRaw}`;
  const formatted = formatKorean(phone);

  // event_registrations에 스태프로 등록
  const { error } = await supabase.from("event_registrations").upsert({
    event_id: eventId,
    phone: formatted,
    name: `스태프 (${formatted})`,
    status: "REGISTERED",
  }, { onConflict: "event_id,phone" });

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/events/${eventId}/staff`);
}

export async function removeStaffAction(eventId: string, registrationId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("event_registrations").delete().eq("id", registrationId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/events/${eventId}/staff`);
}
