import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logAccess, getRequestMeta } from "@/lib/audit-log";
import {
  rateLimit,
  getClientIp,
  tooManyRequests,
  maybeGcBuckets,
} from "@/lib/rate-limit";

/**
 * ?redirect=... 상대 경로 검증 — user-login 과 동일 규칙.
 * open redirect 방지: protocol-relative·backslash·외부 URL 거부.
 */
function resolveSafeRedirect(request: Request, fallback: string): string {
  const raw = new URL(request.url).searchParams.get("redirect");
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (raw.length > 500) return fallback;
  return raw;
}

export async function POST(request: Request) {
  // Rate limit: IP 당 분당 20회. logout DoS 방지.
  const ip = getClientIp(request) ?? "unknown";
  const rl = rateLimit({
    key: `user-logout:${ip}`,
    windowMs: 60_000,
    max: 20,
  });
  maybeGcBuckets();
  if (!rl.allowed) return tooManyRequests(rl);

  const cookieStore = await cookies();
  const raw = cookieStore.get("campnic_user")?.value;
  let userId: string | undefined;
  let phoneTail: string | undefined;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { id?: string; phone?: string };
      userId = parsed?.id;
      if (parsed?.phone) {
        const digits = String(parsed.phone).replace(/\D/g, "");
        if (digits) phoneTail = digits.slice(-4);
      }
    } catch {
      // ignore
    }
  }

  cookieStore.delete("campnic_user");
  cookieStore.delete("campnic_admin");
  cookieStore.delete("campnic_manager");
  cookieStore.delete("campnic_participant");
  cookieStore.delete("campnic_partner");
  cookieStore.delete("campnic_org");

  try {
    const supabase = await createClient();
    const meta = getRequestMeta(request.headers);
    await logAccess(supabase as unknown as SupabaseClient, {
      user_type: "USER",
      user_id: userId,
      user_identifier: phoneTail,
      action: "LOGOUT",
      resource: "app_users",
      status_code: 303,
      ...meta,
    });
  } catch {
    // best-effort
  }

  const safeRedirect = resolveSafeRedirect(request, "/user-login");
  return NextResponse.redirect(
    new URL(
      safeRedirect,
      process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
    ),
    { status: 303 }
  );
}
