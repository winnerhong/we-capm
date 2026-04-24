import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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
