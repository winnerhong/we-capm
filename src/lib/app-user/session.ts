// 참가자 세션 쿠키(campnic_user) 쓰기 — 단일 창구.
//
// 예전에는 5곳(user-login 정상/셀프가입, join/actions, dev-login,
// admin·org impersonate)이 쿠키 JSON 을 각자 복붙해서 만들었다. 활성 기관
// 전환 로직이 들어오면서 한 군데로 모은다.
//
// ── orgId 의 의미 ──────────────────────────────────────────────
// 쿠키의 orgId 는 "소속 기관" 이 아니라 **현재 활성 기관** 이다.
// 한 보호자가 여러 기관에 소속(app_user_orgs)될 수 있고, 참가자 앱
// (홈·스탬프북·미션·토리FM·빙고·토리톡)은 전부 이 값을 컨텍스트로 읽는다.
// 초대장·참가 링크로 들어오면 그 행사의 기관으로 전환된다.
//
// 읽기는 @/lib/user-auth-guard 의 getAppUser / requireAppUser 를 쓸 것.

import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { hasOrgAccess } from "@/lib/app-user/orgs";

export const USER_COOKIE = "campnic_user";

export const USER_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  // 30일
  maxAge: 60 * 60 * 24 * 30,
  path: "/",
};

export interface AppUserSessionInput {
  id: string;
  phone: string;
  parentName: string;
  /** 활성 기관. 보통 로그인 시점엔 홈 기관, 초대장 진입 시엔 그 행사의 기관. */
  orgId: string;
  /** 없으면 partner_orgs 에서 조회해 채운다. */
  orgName?: string;
}

/** 기관명 조회 — 실패해도 세션 발급은 막지 않는다. */
async function resolveOrgName(orgId: string): Promise<string> {
  if (!orgId) return "";
  try {
    const supabase = await createClient();
    const resp = (await (
      supabase.from("partner_orgs" as never) as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => {
            maybeSingle: () => Promise<{
              data: { org_name: string | null } | null;
            }>;
          };
        };
      }
    )
      .select("org_name")
      .eq("id", orgId)
      .maybeSingle()) as { data: { org_name: string | null } | null };
    return resp.data?.org_name?.trim() ?? "";
  } catch {
    return "";
  }
}

/**
 * 세션 쿠키 발급/갱신.
 * orgName 을 넘기지 않으면 partner_orgs 에서 조회해 채운다.
 */
export async function setAppUserSession(
  input: AppUserSessionInput
): Promise<void> {
  const orgName = input.orgName ?? (await resolveOrgName(input.orgId));
  const cookieStore = await cookies();
  cookieStore.set(
    USER_COOKIE,
    JSON.stringify({
      id: input.id,
      phone: input.phone,
      parentName: input.parentName,
      orgId: input.orgId,
      orgName,
      loginAt: new Date().toISOString(),
    }),
    USER_COOKIE_OPTS
  );
}

/**
 * 활성 기관 전환 — 로그인 상태를 유지한 채 orgId/orgName 만 교체.
 *
 * 호출 지점: 초대장 열람, 행사 참가, /home?event_id= 진입, 홈 기관 스위처.
 *
 * 안전장치:
 *  - 세션이 없으면 no-op (미로그인은 전환할 것이 없다)
 *  - 이미 그 기관이면 no-op (불필요한 Set-Cookie 방지)
 *  - **자격 없는 기관으로는 전환하지 않는다** (소속도 아니고 참가자도 아님). 이 값이 곧 앱 전역의 권한
 *    컨텍스트라, 검증 없이 바꾸면 임의 기관 데이터에 접근하게 된다.
 *
 * @returns 전환됐으면 true
 */
export async function switchActiveOrg(orgId: string): Promise<boolean> {
  if (!orgId) return false;

  const cookieStore = await cookies();
  const raw = cookieStore.get(USER_COOKIE)?.value;
  if (!raw) return false;

  let parsed: {
    id?: string;
    phone?: string;
    parentName?: string;
    orgId?: string;
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return false;
  }

  const id = String(parsed.id ?? "");
  if (!id) return false;
  if (parsed.orgId === orgId) return false;

  // 소속 검증 — 없으면 전환하지 않는다 (fail-closed)
  const allowed = await hasOrgAccess(id, orgId);
  if (!allowed) return false;

  await setAppUserSession({
    id,
    phone: String(parsed.phone ?? ""),
    parentName: String(parsed.parentName ?? ""),
    orgId,
  });
  return true;
}
