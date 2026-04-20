import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditUserType = "ADMIN" | "MANAGER" | "PARTNER" | "PARTICIPANT" | "PUBLIC";

export interface AuditLogEntry {
  user_type: AuditUserType;
  user_id?: string;
  user_identifier?: string; // phone/email/username
  action: string; // LOGIN, LOGOUT, VIEW_PROFILE, DELETE_ACCOUNT, etc
  resource?: string;
  ip_address?: string;
  user_agent?: string;
  status_code?: number;
}

export async function logAccess(
  supabase: SupabaseClient,
  entry: AuditLogEntry
): Promise<void> {
  try {
    const sb = supabase as unknown as {
      from: (t: string) => { insert: (d: unknown) => Promise<unknown> };
    };
    await sb.from("access_logs").insert(entry);
  } catch (e) {
    // Don't fail the request if audit logging fails
    console.error("[audit] Failed to log access:", e);
  }
}

/**
 * Helper to extract IP and UA from NextRequest
 */
export function getRequestMeta(headers: Headers): { ip_address?: string; user_agent?: string } {
  return {
    ip_address:
      headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headers.get("x-real-ip") ||
      undefined,
    user_agent: headers.get("user-agent") || undefined,
  };
}
