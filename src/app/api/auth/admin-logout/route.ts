import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { logAccess, getRequestMeta } from "@/lib/audit-log";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  rateLimit,
  getClientIp,
  tooManyRequests,
  maybeGcBuckets,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  // Rate limit: IP 당 분당 20회. logout DoS 방지.
  const ip = getClientIp(request) ?? "unknown";
  const rl = rateLimit({
    key: `admin-logout:${ip}`,
    windowMs: 60_000,
    max: 20,
  });
  maybeGcBuckets();
  if (!rl.allowed) return tooManyRequests(rl);

  const cookieStore = await cookies();
  const adminRaw = cookieStore.get("campnic_admin")?.value;
  let adminId: string | undefined;
  if (adminRaw) {
    try {
      adminId = JSON.parse(adminRaw)?.id;
    } catch {
      // ignore
    }
  }

  cookieStore.delete("campnic_admin");
  cookieStore.delete("campnic_manager");
  cookieStore.delete("campnic_participant");
  cookieStore.delete("campnic_partner");
  cookieStore.delete("campnic_org");
  cookieStore.delete("campnic_user");

  try {
    const supabase = await createClient();
    const meta = getRequestMeta(request.headers);
    await logAccess(supabase as unknown as SupabaseClient, {
      user_type: "ADMIN",
      user_identifier: adminId,
      action: "LOGOUT",
      resource: "admin",
      status_code: 303,
      ...meta,
    });
  } catch {
    // best-effort
  }

  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
