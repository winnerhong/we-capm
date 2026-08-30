// server-only: 행사 화면(/e/[eventId]/…)의 단일 관문.
//
// 설계 원칙 — **컨텍스트는 URL 이 100% 결정한다.**
//   예전에는 세션 쿠키의 orgId 하나가 "지금 어느 기관인지"를 들고 있었다.
//   그래서 (a) 어디서 들어왔느냐에 따라 화면이 달라지고, (b) 탭을 두 개 열면
//   마지막에 연 쪽이 이기고, (c) 행사는 B기관인데 기관 표시는 A기관인 어긋남이
//   생겼다. 행사 화면은 쿠키의 orgId 를 **읽지 않는다**. eventId 하나에서
//   기관·권한·표시가 전부 파생된다.
//
// 권한 판단도 하나로 통일:
//   ✗ user.orgId === resource.org_id
//   ○ isEventParticipant(eventId, user.id)
//
// 실패 처리:
//   미로그인   → /user-login?return=/e/{eventId}
//   행사 없음  → notFound()
//   미참가     → /join/event/{eventId} (참가 유도 — 초대장 링크와 같은 흐름)
//   보관된 행사 → /event-closed/{eventId} (완전히 닫힘)

import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getAppUser, type AppUserSession } from "@/lib/user-auth-guard";
import {
  loadOrgEventById,
  isEventParticipant,
} from "@/lib/org-events/queries";
import { loadOrgNameById } from "@/lib/org-partner";
import type { OrgEventRow } from "@/lib/org-events/types";
import {
  resolveEventAccess,
  type EventAccess,
} from "@/lib/org-events/event-access";
import {
  loadOrgFeatureFlags,
  canUse,
  type OrgFeatureMap,
} from "@/lib/features/org-switches";

export interface EventContext {
  user: AppUserSession;
  event: OrgEventRow;
  /** 이 행사를 주최한 기관. 화면의 모든 기관 종속 요소는 이 값을 쓴다. */
  orgId: string;
  orgName: string;
  /** 행사 하위 경로 빌더 — `href(\"/stampbook\")` → `/e/{id}/stampbook` */
  href: (subpath?: string) => string;
  /**
   * 지금 이 행사가 열려 있는지 — 회색·잠금 판단 전부.
   *
   * 화면마다 `event.status === "LIVE"` 를 각자 쓰면 한쪽만 고쳐지는 버그가
   * 난다(화면은 잠겼는데 서버 액션은 계속 받아준다든가). 여기서 한 번 풀어
   * 내려보내고, 페이지·레이아웃은 access 만 읽는다.
   */
  access: EventAccess;
  /**
   * 이 행사를 주최한 기관이 켜 둔 기능.
   *
   * access 와 성격이 다르다 —
   *   access  = "지금은" 못 쓴다(행사가 끝났다)      → 회색 + 이유
   *   features= "여기서는" 안 쓴다(기관이 안 산다)   → 아예 안 보인다
   * 보호자에게 지사 계약 사정은 알 필요 없는 정보고, 회색으로 남겨 두면
   * "우리 유치원은 왜 없어요" 만 만든다.
   */
  features: OrgFeatureMap;
  /** 이 기능이 이 행사에서 쓰이는가. 모르는 코드는 켜진 것으로 본다. */
  hasFeature: (code: string) => boolean;
}

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function eventHref(eventId: string, subpath = ""): string {
  const s = subpath.startsWith("/") ? subpath : subpath ? `/${subpath}` : "";
  return `/e/${eventId}${s}`;
}

/**
 * 행사 컨텍스트 확보. 모든 /e/[eventId] 페이지가 첫 줄에서 호출한다.
 *
 * redirect()/notFound() 는 내부적으로 throw 하므로 try/catch 로 감싸지 말 것.
 *
 * ## 요청당 한 번
 *   레이아웃도 부르고 그 안의 페이지도 부른다 — 즉 참가자 화면 **한 장마다 두
 *   번** 실행된다(계측으로 확인). 한 번이 행사·참가여부·기관명·기능스위치를
 *   읽으므로 그냥 두면 매 화면이 왕복 3회를 헛되이 더 낸다. 참가자는 행사장
 *   와이파이에서 이 앱을 쓴다 — 여기서 아낀 왕복이 체감으로 가장 크게 남는다.
 *
 *   레이아웃이 값을 받아 페이지로 내려보내는 방법도 있지만, App Router 에서
 *   레이아웃은 children 에 prop 을 줄 수 없다. cache() 가 유일하게 깔끔한 길이다.
 *
 *   redirect()/notFound() 는 throw 라서 거부된 프라미스가 캐시되는데, 두 번째
 *   호출도 같은 곳으로 보내야 하므로 그게 맞는 동작이다.
 */
export const requireEventContext = cache(async function requireEventContext(
  eventId: string
): Promise<EventContext> {
  if (!UUID_RE.test(eventId)) notFound();

  const user = await getAppUser();
  if (!user) {
    redirect(`/user-login?return=${encodeURIComponent(eventHref(eventId))}`);
  }

  const event = await loadOrgEventById(eventId).catch(() => null);
  if (!event) notFound();

  const joined = await isEventParticipant(eventId, user.id).catch(() => false);
  if (!joined) {
    // 참가자가 아니면 차단 대신 참가 흐름으로 — 초대장 링크와 동일한 경험.
    redirect(`/join/event/${eventId}`);
  }

  // 문을 잠그는 판단은 여기 한 곳에서만 한다. /e/{id}/** 전부가 이 함수를
  // 첫 줄에서 부르므로, 여기서 막으면 하위 화면을 하나하나 손댈 필요가 없다.
  const access = resolveEventAccess({
    status: event.status,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
  });
  if (!access.canEnter) {
    // 잠금 화면은 행사 그룹 **밖**에 둔다. 안에 두면 이 레이아웃이 다시
    // requireEventContext 를 불러 무한 리다이렉트가 된다.
    redirect(`/event-closed/${eventId}`);
  }

  // 기관 이름과 기능 스위치는 서로를 필요로 하지 않는다 — 줄줄이 기다리면
  // 참가자의 **모든** 화면이 그만큼 늦게 뜬다.
  const [orgName, features] = await Promise.all([
    loadOrgNameById(event.org_id, "소속 기관"),
    loadOrgFeatureFlags(event.org_id),
  ]);

  return {
    user,
    event,
    orgId: event.org_id,
    orgName,
    href: (subpath = "") => eventHref(eventId, subpath),
    access,
    features,
    hasFeature: (code: string) => canUse(features, code),
  };
});
