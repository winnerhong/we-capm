import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasOrgMembership } from "@/lib/app-user/orgs";

export interface AppUserSession {
  id: string;
  phone: string;
  parentName: string;
  orgId: string;
  orgName: string;
  loginAt: string;
}

type RawAppUserCookie = {
  id?: string;
  phone?: string;
  parentName?: string;
  orgId?: string;
  orgName?: string;
  loginAt?: string;
};

function normalizeAppUserSession(
  raw: RawAppUserCookie
): AppUserSession | null {
  const id = String(raw.id ?? "");
  const phone = String(raw.phone ?? "");
  const orgId = String(raw.orgId ?? "");
  // 최소 필드 검증 — 하나라도 비면 세션 폐기
  if (!id || !phone || !orgId) return null;
  return {
    id,
    phone,
    parentName: String(raw.parentName ?? ""),
    orgId,
    orgName: String(raw.orgName ?? ""),
    loginAt: String(raw.loginAt ?? ""),
  };
}

async function readAppUserCookie(): Promise<AppUserSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("campnic_user")?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RawAppUserCookie;
    return normalizeAppUserSession(parsed);
  } catch {
    return null;
  }
}

/**
 * 참가자 세션 조회 — 없으면 null
 */
export async function getAppUser(): Promise<AppUserSession | null> {
  return readAppUserCookie();
}

/**
 * 참가자 세션 필수 — 없으면 /user-login으로 리다이렉트.
 * redirect()는 try/catch 바깥에서 호출 (NEXT_REDIRECT 삼킴 방지)
 */
export async function requireAppUser(): Promise<AppUserSession> {
  const session = await readAppUserCookie();
  if (!session) redirect("/user-login");
  return session;
}

/**
 * 이 참가자가 해당 기관 리소스(미션·스탬프북·빙고·토리톡 …)에 접근 가능한가.
 *
 * `session.orgId === resource.org_id` 비교를 대체한다. 세션의 orgId 는 **활성
 * 기관 하나**일 뿐이라, 두 기관에 소속된 보호자가 지금 A기관 컨텍스트에 있으면
 * B기관 리소스가 전부 막혀버린다. 소속 전체(app_user_orgs)로 판단해야 한다.
 *
 * 빠른 경로: 활성 기관과 같으면 DB 조회 없이 통과.
 */
export async function canAccessOrg(
  session: AppUserSession,
  orgId: string
): Promise<boolean> {
  if (!orgId) return false;
  if (session.orgId === orgId) return true;
  return hasOrgMembership(session.id, orgId);
}
