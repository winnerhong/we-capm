import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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
  const raw = cookieStore.get("campnic_org")?.value;
  if (!raw) redirect("/manager");
  try {
    return JSON.parse(raw) as OrgSession;
  } catch {
    redirect("/manager");
  }
}

/**
 * 기관 세션 조회 — 없으면 null
 */
export async function getOrg(): Promise<OrgSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("campnic_org")?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OrgSession;
  } catch {
    return null;
  }
}
