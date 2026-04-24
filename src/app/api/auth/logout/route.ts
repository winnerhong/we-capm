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
    key: `participant-logout:${ip}`,
    windowMs: 60_000,
    max: 20,
  });
  maybeGcBuckets();
  if (!rl.allowed) return tooManyRequests(rl);

  const supabase = await createClient();

  let userId: string | undefined;
  let identifier: string | undefined;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id;
    identifier = data.user?.phone || data.user?.email || undefined;
  } catch {
    // ignore
  }

  await supabase.auth.signOut();

  try {
    const meta = getRequestMeta(request.headers);
    await logAccess(supabase as unknown as SupabaseClient, {
      user_type: "PARTICIPANT",
      user_id: userId,
      user_identifier: identifier,
      action: "LOGOUT",
      resource: "auth",
      status_code: 302,
      ...meta,
    });
  } catch {
    // best-effort
  }

  return NextResponse.redirect(new URL("/", request.url));
}
