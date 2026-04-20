import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { logAccess, getRequestMeta } from "@/lib/audit-log";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
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
