"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifyPassword } from "@/lib/password";
import { logAccess, getRequestMeta } from "@/lib/audit-log";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PartnerLoginResult =
  | { ok: true }
  | { ok: false; error: string };

type PartnerRow = {
  id: string;
  name: string;
  password: string;
  status: string;
};

export async function partnerLoginAction(
  formData: FormData
): Promise<PartnerLoginResult> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!username || !password) {
    return { ok: false, error: "아이디와 비밀번호를 입력해주세요" };
  }

  const supabase = await createClient();
  const hdrs = await headers();
  const meta = getRequestMeta(hdrs);

  const queryAny = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: PartnerRow | null;
            error: unknown;
          }>;
        };
      };
    };
  };

  const { data: partner } = await queryAny
    .from("partners")
    .select("id, name, password, status")
    .eq("username", username)
    .maybeSingle();

  if (!partner) {
    await logAccess(supabase as unknown as SupabaseClient, {
      user_type: "PARTNER",
      user_identifier: username,
      action: "LOGIN_FAIL",
      resource: "partners",
      status_code: 404,
      ...meta,
    });
    return { ok: false, error: "존재하지 않는 계정입니다" };
  }

  const passwordOk = await verifyPassword(password, partner.password);
  if (!passwordOk) {
    await logAccess(supabase as unknown as SupabaseClient, {
      user_type: "PARTNER",
      user_id: partner.id,
      user_identifier: username,
      action: "LOGIN_FAIL",
      resource: "partners",
      status_code: 401,
      ...meta,
    });
    return { ok: false, error: "비밀번호가 일치하지 않습니다" };
  }
  if (partner.status === "PENDING") {
    return {
      ok: false,
      error: "승인 대기 중입니다. 관리자 승인 후 로그인 가능합니다",
    };
  }
  if (partner.status === "SUSPENDED") {
    return { ok: false, error: "정지된 계정입니다" };
  }
  if (partner.status === "CLOSED") {
    return { ok: false, error: "해지된 계정입니다" };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    "campnic_partner",
    JSON.stringify({
      id: partner.id,
      name: partner.name,
      username,
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

  await logAccess(supabase as unknown as SupabaseClient, {
    user_type: "PARTNER",
    user_id: partner.id,
    user_identifier: username,
    action: "LOGIN",
    resource: "partners",
    status_code: 200,
    ...meta,
  });

  return { ok: true };
}

export async function partnerLogoutAction() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("campnic_partner")?.value;
  let partnerInfo: { id?: string; username?: string } = {};
  if (raw) {
    try {
      partnerInfo = JSON.parse(raw);
    } catch {
      // ignore
    }
  }

  cookieStore.delete("campnic_partner");

  try {
    const supabase = await createClient();
    const hdrs = await headers();
    const meta = getRequestMeta(hdrs);
    await logAccess(supabase as unknown as SupabaseClient, {
      user_type: "PARTNER",
      user_id: partnerInfo.id,
      user_identifier: partnerInfo.username,
      action: "LOGOUT",
      resource: "partners",
      status_code: 200,
      ...meta,
    });
  } catch {
    // best-effort
  }

  redirect("/partner");
}
