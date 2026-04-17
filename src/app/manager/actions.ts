"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function managerLoginAction(managerId: string, password: string) {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, name, manager_id, manager_password")
    .eq("manager_id", managerId);

  if (!events || events.length === 0) {
    return { ok: false, message: "해당 아이디의 행사를 찾을 수 없습니다" };
  }

  const event = events.find((e) => e.manager_password === password);
  if (!event) {
    return { ok: false, message: "비밀번호가 틀렸습니다" };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    "campnic_manager",
    JSON.stringify({
      eventId: event.id,
      eventName: event.name,
      managerId: event.manager_id,
      loginAt: new Date().toISOString(),
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    }
  );

  return { ok: true, eventId: event.id, eventName: event.name };
}
