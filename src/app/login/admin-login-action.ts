"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { logAccess, getRequestMeta } from "@/lib/audit-log";
import type { SupabaseClient } from "@supabase/supabase-js";

const ADMIN_ID = process.env.ADMIN_ID ?? "admin";
const ADMIN_PW = process.env.ADMIN_PW ?? "12345";

export async function adminLoginAction(id: string, password: string) {
  const supabase = await createClient();
  const hdrs = await headers();
  const meta = getRequestMeta(hdrs);

  if (id !== ADMIN_ID || password !== ADMIN_PW) {
    await logAccess(supabase as unknown as SupabaseClient, {
      user_type: "ADMIN",
      user_identifier: id,
      action: "LOGIN_FAIL",
      resource: "admin",
      status_code: 401,
      ...meta,
    });
    return { ok: false, message: "아이디 또는 비밀번호가 틀렸습니다" };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    "campnic_admin",
    JSON.stringify({ id: ADMIN_ID, role: "ADMIN", loginAt: new Date().toISOString() }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    }
  );

  await logAccess(supabase as unknown as SupabaseClient, {
    user_type: "ADMIN",
    user_identifier: ADMIN_ID,
    action: "LOGIN",
    resource: "admin",
    status_code: 200,
    ...meta,
  });

  return { ok: true };
}
