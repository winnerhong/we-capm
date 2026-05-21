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
  // Rate limit: IP 당 분당 20회. logout 은 brute-force 이슈 없지만 DoS 방지.
  const ip = getClientIp(request) ?? "unknown";
  const rl = rateLimit({
    key: `manager-logout:${ip}`,
    windowMs: 60_000,
    max: 20,
  });
  maybeGcBuckets();
  if (!rl.allowed) return tooManyRequests(rl);

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
  cookieStore.delete("campnic_org"); // 구 단일 쿠키 정리

  // 다중 기관 로그인 — 어느 기관에서 로그아웃했는지 referer/쿼리로 판별.
  //   특정 기관: 그 기관 쿠키만 삭제 (다른 탭 기관 세션은 유지).
  //   판별 불가: 모든 기관 쿠키 삭제 (전체 로그아웃).
  const logoutUrl = new URL(request.url);
  let logoutOrgId = logoutUrl.searchParams.get("org");
  if (!logoutOrgId) {
    const ref = request.headers.get("referer") ?? "";
    const m = ref.match(/\/org\/([^/?#]+)/);
    if (m) logoutOrgId = m[1];
  }
  if (logoutOrgId) {
    cookieStore.delete(`campnic_org_${logoutOrgId}`);
  } else {
    for (const c of cookieStore.getAll()) {
      if (c.name.startsWith("campnic_org_")) cookieStore.delete(c.name);
    }
  }

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
