import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

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
  injectOrgSession(request);
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth/send-sms-hook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
