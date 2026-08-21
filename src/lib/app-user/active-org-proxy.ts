// 미들웨어(Edge)에서 참가자의 활성 기관을 URL 의 event_id 에 맞춰 동기화.
//
// 왜 미들웨어인가:
//   참가자 앱(홈·스탬프북·미션·토리FM·빙고·토리톡)은 세션 쿠키의 orgId 를
//   컨텍스트로 읽는다. 그런데 `/home?event_id=` 로 직접 들어오는 경로(알림 링크,
//   북마크, 기관 전환 전에 만들어진 링크)는 쿠키를 거치지 않아 "행사는 B, 화면은
//   A" 상태로 굳는다.
//   - Server Component 렌더 중에는 쿠키를 쓸 수 없다.
//   - 페이지에서 redirect() 로 우회하면 렌더가 이미 스트리밍을 시작한 뒤라
//     soft redirect(RSC 페이로드 내장)가 되어 API 라우트로의 이동이 불안정하다.
//   미들웨어는 렌더 전에 돌고 요청·응답 쿠키를 모두 만질 수 있는 유일한 지점이다.
//
// 같은 패턴: proxy.ts 의 injectOrgSession (기관 운영자 세션을 URL 기준으로 주입).
//
// Edge 런타임 — next/headers 나 supabase 서버 클라이언트를 쓸 수 없어 REST 직접 호출.
// 읽기 전용이고 RLS 가 permissive 라 publishable(anon) 키로 충분하다.

import type { NextRequest } from "next/server";

const USER_COOKIE = "campnic_user";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const ACTIVE_ORG_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30,
  path: "/",
};

// 행사의 소속 기관과 기관명은 사실상 불변 — 인스턴스 수명 동안 캐시해
// 미들웨어에서 반복 조회하지 않는다.
const eventOrgCache = new Map<string, string>();
const orgNameCache = new Map<string, string>();

async function sbGet(path: string): Promise<unknown[] | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return null;
  try {
    const r = await fetch(`${base}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as unknown[];
  } catch {
    return null;
  }
}

async function eventOrgId(eventId: string): Promise<string | null> {
  const hit = eventOrgCache.get(eventId);
  if (hit) return hit;
  const rows = await sbGet(`org_events?select=org_id&id=eq.${eventId}&limit=1`);
  const orgId = (rows?.[0] as { org_id?: string } | undefined)?.org_id;
  if (!orgId) return null;
  eventOrgCache.set(eventId, orgId);
  return orgId;
}

async function orgName(orgId: string): Promise<string> {
  const hit = orgNameCache.get(orgId);
  if (hit !== undefined) return hit;
  const rows = await sbGet(`partner_orgs?select=org_name&id=eq.${orgId}&limit=1`);
  const name =
    (rows?.[0] as { org_name?: string | null } | undefined)?.org_name?.trim() ??
    "";
  orgNameCache.set(orgId, name);
  return name;
}

/** 소속 여부 — 캐시하지 않는다(방금 추가된 소속을 즉시 반영해야 하므로). */
async function isMember(userId: string, orgId: string): Promise<boolean> {
  const rows = await sbGet(
    `app_user_orgs?select=user_id&user_id=eq.${userId}&org_id=eq.${orgId}&limit=1`
  );
  return !!rows && rows.length > 0;
}

/**
 * URL 에 event_id 가 있고 그 행사의 기관이 현재 활성 기관과 다르면,
 * 요청 쿠키를 그 기관으로 바꾸고(= 이번 렌더에 즉시 반영) 브라우저에 저장할
 * 새 쿠키 값을 돌려준다.
 *
 * 반환값이 null 이면 할 일이 없었던 것 — 대부분의 요청이 여기로 떨어진다.
 * 소속이 아닌 기관으로는 절대 바꾸지 않는다(fail-closed).
 */
export async function resolveActiveOrgPatch(
  request: NextRequest
): Promise<string | null> {
  const eventId = request.nextUrl.searchParams.get("event_id");
  if (!eventId || !UUID_RE.test(eventId)) return null;

  const raw = request.cookies.get(USER_COOKIE)?.value;
  if (!raw) return null;

  let session: Record<string, unknown>;
  try {
    session = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  const userId = typeof session.id === "string" ? session.id : "";
  const currentOrgId =
    typeof session.orgId === "string" ? session.orgId : "";
  if (!userId || !currentOrgId) return null;

  const targetOrgId = await eventOrgId(eventId);
  if (!targetOrgId || targetOrgId === currentOrgId) return null;

  if (!(await isMember(userId, targetOrgId))) return null;

  const next = JSON.stringify({
    ...session,
    orgId: targetOrgId,
    orgName: await orgName(targetOrgId),
  });

  // 이번 요청의 렌더가 곧바로 새 기관을 보도록 request 쿠키도 갈아끼운다.
  // (proxy.ts 가 NextResponse.next({ request }) 로 이어받는다)
  request.cookies.set(USER_COOKIE, next);
  return next;
}
