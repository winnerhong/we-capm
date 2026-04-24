import { cookies } from "next/headers";
import { NextResponse } from "next/server";
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
    key: `partner-logout:${ip}`,
    windowMs: 60_000,
    max: 20,
  });
  maybeGcBuckets();
  if (!rl.allowed) return tooManyRequests(rl);

  const cookieStore = await cookies();
  const raw = cookieStore.get("campnic_partner")?.value;
  let partnerId: string | undefined;
  let username: string | undefined;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      partnerId = parsed?.id;
      username = parsed?.username;
    } catch {
      // ignore
    }
  }

  cookieStore.delete("campnic_partner");
  cookieStore.delete("campnic_admin");
  cookieStore.delete("campnic_manager");
  cookieStore.delete("campnic_participant");
  cookieStore.delete("campnic_org");
  cookieStore.delete("campnic_user");

  try {
    const supabase = await createClient();
    const meta = getRequestMeta(request.headers);
    await logAccess(supabase as unknown as SupabaseClient, {
      user_type: "PARTNER",
      user_id: partnerId,
      user_identifier: username,
      action: "LOGOUT",
      resource: "partners",
      status_code: 303,
      ...meta,
    });
  } catch {
    // best-effort
  }

  return NextResponse.redirect(
    new URL(
      "/partner",
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:1000"
    ),
    { status: 303 }
  );
}
