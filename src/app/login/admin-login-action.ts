"use server";

import { cookies } from "next/headers";

const ADMIN_ID = process.env.ADMIN_ID ?? "admin";
const ADMIN_PW = process.env.ADMIN_PW ?? "12345";

export async function adminLoginAction(id: string, password: string) {
  if (id !== ADMIN_ID || password !== ADMIN_PW) {
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

  return { ok: true };
}
