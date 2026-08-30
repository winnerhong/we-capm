import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import {
  resolveActiveOrgPatch,
  ACTIVE_ORG_COOKIE_OPTS,
} from "@/lib/app-user/active-org-proxy";
import { seal, unseal } from "@/lib/session-cookie";

/**
 * 세션 쿠키 서명 검문소 — 요청마다 딱 한 번, 다른 무엇보다 먼저.
 *
 * 브라우저에는 서명된 값(<body>.<sig>)이 들어 있다. 여기서 서명을 확인하고
 * 통과한 것만 평문 JSON 으로 되돌려 request 쿠키에 다시 꽂는다.
 *   → requireOrg()·requirePartner()·requireAdminOrManager() 등 읽는 코드는
 *     예전 그대로 JSON.parse 만 하면 된다(40군데를 고치지 않아도 되는 이유).
 *   → 서명이 없거나 어긋난 쿠키는 아예 지운다. 읽는 쪽에서는 '로그인 안 됨'이 되어
 *     이미 있는 리다이렉트가 그대로 동작한다.
 *
 * ⚠ 이 함수가 안 돌면 로그인이 전부 풀린 것처럼 보인다. proxy() 의 첫 줄에서 유지할 것.
 * ⚠ 미들웨어 matcher 에서 빠지는 경로는 이 검문을 안 거친다. 지금 빠지는 건
 *   정적 파일과 /api/auth/send-sms-hook(Supabase 훅, 세션 쿠키를 안 읽는다)뿐이다.
 */
async function unsealSessionCookies(request: NextRequest) {
  for (const c of request.cookies.getAll()) {
    if (!c.name.startsWith("campnic_")) continue;
    const plain = await unseal(c.value);
    if (plain === null) request.cookies.delete(c.name);
    else request.cookies.set(c.name, plain);
  }
}

/**
 * 한 브라우저 다중 기관 로그인 지원.
 *
 * 기관 세션은 기관별 쿠키 `campnic_org_<orgId>` 로 저장된다 (브라우저가 여러
 * 기관 세션을 동시에 보관). 이 함수는 요청 URL 의 `/org/<orgId>/` 를 보고
 * 해당 기관 쿠키를 골라 그 요청에 한해 `campnic_org` 로 주입한다.
 *   → requireOrg() 등 기존 코드는 그대로 `campnic_org` 만 읽으면 된다.
 *   → request 쿠키만 수정하므로 브라우저의 실제 쿠키는 바뀌지 않는다 (탭별 독립).
 */
function injectOrgSession(request: NextRequest) {
  // 1) URL path 가 /org/<orgId>/... → 그 기관 쿠키 사용.
  // 2) 그 외 경로 (예: /api/org/impersonate-user) 는 ?org=<orgId> 쿼리로
  //    어느 기관에서 호출됐는지 지정 — 그 기관 쿠키를 주입.
  //    /org/[orgId] 페이지의 새 탭/팝업에서 운영자 API 를 호출할 때 필요.
  let orgId: string | null = null;
  const pathMatch = request.nextUrl.pathname.match(/^\/org\/([^/]+)/);
  if (pathMatch) {
    orgId = pathMatch[1];
  } else {
    const q = request.nextUrl.searchParams.get("org");
    if (q && /^[0-9a-fA-F-]{8,}$/.test(q)) orgId = q;
  }
  if (!orgId) return;

  const perOrg = request.cookies.get(`campnic_org_${orgId}`)?.value;
  if (perOrg) {
    request.cookies.set("campnic_org", perOrg);
    return;
  }

  // 폴백 — 구 단일 campnic_org 쿠키 (배포 전 로그인 세션).
  //   orgId 가 이 URL 과 같으면 그대로 사용, 다르면 이 요청에서 제거
  //   (다른 기관 세션으로 오인되는 것 방지).
  const legacy = request.cookies.get("campnic_org")?.value;
  if (!legacy) return;
  try {
    const parsed = JSON.parse(legacy) as { orgId?: string };
    if (parsed?.orgId === orgId) return;
  } catch {
    /* ignore */
  }
  request.cookies.delete("campnic_org");
}

export async function proxy(request: NextRequest) {
  // 서명 검문이 가장 먼저 — 아래 로직은 전부 '검증된 평문'을 전제로 돈다.
  await unsealSessionCookies(request);
  injectOrgSession(request);

  // 참가자 활성 기관 동기화 — URL 의 event_id 와 세션의 orgId 가 어긋나면 교정.
  //   요청 쿠키는 여기서 이미 바뀌므로(updateSession 의 NextResponse.next({request})
  //   가 이어받는다) 이번 렌더부터 올바른 기관이 보인다.
  //   대부분의 요청은 event_id 가 없어 즉시 null 로 빠진다.
  const activeOrgPatch = await resolveActiveOrgPatch(request);

  const response = await updateSession(request);
  if (activeOrgPatch) {
    // 브라우저로 나가는 값이므로 서명해서 내보낸다(request 쪽은 평문 그대로 둔다).
    response.cookies.set(
      "campnic_user",
      await seal(JSON.parse(activeOrgPatch)),
      ACTIVE_ORG_COOKIE_OPTS
    );
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth/send-sms-hook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
