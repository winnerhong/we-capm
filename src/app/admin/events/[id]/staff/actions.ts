"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addStaffAction(eventId: string, formData: FormData) {
  const supabase = await createClient();
  const phoneRaw = String(formData.get("phone") ?? "").replace(/\D/g, "");
  if (phoneRaw.length < 10) throw new Error("올바른 전화번호를 입력해주세요");

  const phone = phoneRaw.startsWith("82") ? phoneRaw : `82${phoneRaw.slice(1)}`;

  const { data: users } = await supabase.rpc("find_user_by_phone", { p_phone: phone });
  const userId = (users as unknown as { id: string } | null)?.id;
  if (!userId) throw new Error("해당 번호로 가입된 사용자가 없습니다. 먼저 로그인해야 합니다.");

  await supabase.from("profiles").update({ role: "STAFF" }).eq("id", userId);

  const { error } = await supabase.from("event_staff").insert({ event_id: eventId, user_id: userId });
  if (error) {
    if (error.message.includes("duplicate")) throw new Error("이미 배정된 스태프입니다");
    throw new Error(error.message);
  }

  revalidatePath(`/admin/events/${eventId}/staff`);
}

export async function removeStaffAction(eventId: string, staffId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("event_staff").delete().eq("id", staffId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/events/${eventId}/staff`);
}
