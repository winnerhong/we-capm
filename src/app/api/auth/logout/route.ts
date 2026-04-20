import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAccess, getRequestMeta } from "@/lib/audit-log";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
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
