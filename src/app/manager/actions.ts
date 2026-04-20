"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { findSchoolByUsername } from "@/lib/school-db";
import { logAccess, getRequestMeta } from "@/lib/audit-log";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function managerLoginAction(managerId: string, password: string) {
  const supabase = await createClient();
  const hdrs = await headers();
  const meta = getRequestMeta(hdrs);

  // 1. campnic events에서 manager_id로 찾기
  const { data: events } = await supabase
    .from("events")
    .select("id, name, manager_id, manager_password")
    .eq("manager_id", managerId);

  const event = events?.find((e) => e.manager_password === password);

  if (event) {
    await setManagerCookie(event.id, event.name, event.manager_id ?? managerId);
    await logAccess(supabase as unknown as SupabaseClient, {
      user_type: "MANAGER",
      user_id: event.id,
      user_identifier: managerId,
      action: "LOGIN",
      resource: `event:${event.id}`,
      status_code: 200,
      ...meta,
    });
    return { ok: true, eventId: event.id, eventName: event.name };
  }

  // 2. schools DB에서 username으로 찾기
  const school = await findSchoolByUsername(managerId);
  if (school && school.password === password) {
    const { data: schoolEvents } = await supabase
      .from("events")
      .select("id, name")
      .eq("manager_id", school.username);

    if (schoolEvents && schoolEvents.length > 0) {
      const ev = schoolEvents[0];
      await setManagerCookie(ev.id, ev.name, school.username);
      await logAccess(supabase as unknown as SupabaseClient, {
        user_type: "MANAGER",
        user_id: ev.id,
        user_identifier: school.username,
        action: "LOGIN",
        resource: `event:${ev.id}`,
        status_code: 200,
        ...meta,
      });
      return { ok: true, eventId: ev.id, eventName: ev.name };
    }
    return { ok: false, message: "배정된 행사가 없습니다. 관리자에게 문의하세요." };
  }

  await logAccess(supabase as unknown as SupabaseClient, {
    user_type: "MANAGER",
    user_identifier: managerId,
    action: "LOGIN_FAIL",
    resource: "manager",
    status_code: 401,
    ...meta,
  });
  return { ok: false, message: "아이디 또는 비밀번호가 틀렸습니다" };
}

async function setManagerCookie(eventId: string, eventName: string, managerId: string) {
  const cookieStore = await cookies();
  cookieStore.set("campnic_manager", JSON.stringify({
    eventId, eventName, managerId, loginAt: new Date().toISOString(),
  }), {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: 86400, path: "/",
  });
}
