import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { logAccess, getRequestMeta } from "@/lib/audit-log";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const managerRaw = cookieStore.get("campnic_manager")?.value;
  let managerId: string | undefined;
  let eventId: string | undefined;
  if (managerRaw) {
    try {
      const parsed = JSON.parse(managerRaw);
      managerId = parsed?.managerId;
      eventId = parsed?.eventId;
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
      user_type: "MANAGER",
      user_id: eventId,
      user_identifier: managerId,
      action: "LOGOUT",
      resource: eventId ? `event:${eventId}` : "manager",
      status_code: 303,
      ...meta,
    });
  } catch {
    // best-effort
  }

  return NextResponse.redirect(new URL("/manager", request.url), { status: 303 });
}
