import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAccess, getRequestMeta } from "@/lib/audit-log";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
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
