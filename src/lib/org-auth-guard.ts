import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { openSession } from "@/lib/session-cookie";

export interface OrgSession {
  orgId: string;
  orgName: string;
  managerId: string; // partner_orgs.auto_username
  loginAt: string;
}

/**
 * 기관 세션 필수 — 없으면 /manager 로그인으로 리다이렉트
 */
export async function requireOrg(): Promise<OrgSession> {
  const cookieStore = await cookies();
  const session = await openSession<OrgSession>(
    cookieStore.get("campnic_org")?.value
  );
  if (!session) redirect("/manager");
  return session;
}

/**
 * 기관 세션 조회 — 없으면 null
 */
export async function getOrg(): Promise<OrgSession | null> {
  const cookieStore = await cookies();
  return openSession<OrgSession>(cookieStore.get("campnic_org")?.value);
}
